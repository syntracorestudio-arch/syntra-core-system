-- ===========================================================================
-- 057 · Suscripciones — quién me debe, contestado honestamente
--
-- Plan: docs/superadmin-suscripciones-plan.md §D.
--
-- DECISIONES DEL OWNER que este esquema materializa:
--   · $60.000 por mes, por negocio
--   · vence el día 10 de cada mes
--   · PRIMER MES GRATIS de prueba; se cobra desde el siguiente
--   · se cobra por TRANSFERENCIA A ALIAS y se marca a mano — sin integración
--
-- POR QUÉ DOS TABLAS Y NO UNA COLUMNA `pagado_hasta`.
--
-- La tentación es guardar un estado ("al día" / "debe") y pisarlo. Eso contesta
-- "¿me debe hoy?" y NADA más: no sabés desde cuándo, ni cuántos meses lleva, ni
-- si el mes pasado pagó tarde. Y cuando el dato se pisa, el historial no se
-- puede reconstruir — se perdió.
--
-- Acá el estado se DERIVA de los pagos asentados. Un pago es un hecho con
-- fecha; el estado es una opinión sobre esos hechos, y las opiniones se
-- recalculan. Cuesta una tabla más y compra la única pregunta que importa
-- cuando hay que cortarle el servicio a alguien: "¿desde cuándo?".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · subscriptions — el contrato con cada negocio
--
-- Una por negocio (PK = store_id). El precio vive acá y no en una constante:
-- el primer cliente casi seguro tenga un precio distinto del quinto, y un
-- descuento pactado no puede obligar a tocar código.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  store_id       uuid primary key references public.stores(id) on delete cascade,
  /* Precio mensual EN PESOS. `numeric` y no `integer`: hoy son montos redondos,
     pero un descuento del 15% deja centavos y redondearlos en silencio es la
     clase de error que después nadie encuentra. */
  precio_mensual numeric(12,2) not null check (precio_mensual >= 0),
  /* Hasta cuándo es gratis. El primer mes es de prueba, así que un alta de hoy
     no debe nada hasta el mes que viene. Nullable = sin prueba (alta directa). */
  prueba_hasta   date,
  /* Desde qué mes se cobra. Es el primer período facturable y se guarda
     explícito en vez de derivarlo de `created_at`: si un alta se hace un 28,
     "el mes que viene" es ambiguo y esto lo deja escrito. */
  cobra_desde    date not null,
  /* `activa` = el contrato corre · `cancelada` = se dio de baja y no se le
     cobra más. NO hay estado "debe": eso se deriva de los pagos. */
  estado         text not null default 'activa'
                 check (estado in ('activa', 'cancelada')),
  cancelada_el   timestamptz,
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2 · subscription_payments — un hecho por mes cobrado
--
-- `periodo` es el PRIMER DÍA del mes que se está pagando, no la fecha del pago.
-- Es la distinción que hace que el modelo no mienta: alguien puede pagar el mes
-- de agosto el 3 de septiembre, y las dos fechas importan por separado —
-- `periodo` dice QUÉ mes saldó, `pagado_el` dice CUÁNDO lo hizo.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  periodo      date not null,
  monto        numeric(12,2) not null check (monto >= 0),
  pagado_el    timestamptz not null default now(),
  medio        text not null default 'transferencia',
  /* Quién lo marcó. `set null` y no cascade: si ese superadmin se va algún día,
     el pago tiene que sobrevivir — es un hecho contable, no una preferencia. */
  marcado_por  uuid references public.profiles(id) on delete set null,
  nota         text,
  created_at   timestamptz not null default now(),
  /* Un mes no se puede pagar dos veces. Sin esto, marcar el mismo pago dos
     veces por un doble click deja al cliente "al día" por partida doble y la
     suma de ingresos miente. */
  unique (store_id, periodo)
);

/* `periodo` siempre es día 1: normalizarlo en la base y no en el código evita
   que dos caminos distintos guarden 2026-08-01 y 2026-08-15 para el mismo mes,
   que rompería el UNIQUE de arriba sin que nadie entienda por qué. */
alter table public.subscription_payments
  drop constraint if exists subscription_payments_periodo_dia1;
alter table public.subscription_payments
  add constraint subscription_payments_periodo_dia1
  check (extract(day from periodo) = 1);

create index if not exists subscription_payments_store_idx
  on public.subscription_payments (store_id, periodo desc);

-- ---------------------------------------------------------------------------
-- 3 · RLS — esto es de SYNTRA, no del cliente
--
-- Sin policies y con RLS activa, `authenticated` no ve NADA. Sólo el
-- `service_role` (el panel /super) las toca.
--
-- Decisión deliberada: el dueño NO lee estas tablas. Lo que él tiene que ver
-- —"debés el mes de agosto"— llega por su aviso, redactado para él. Darle acceso
-- a la tabla de cobranza expone el precio de los demás si algún día hay más de
-- un plan.
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

revoke all on public.subscriptions from authenticated, anon;
revoke all on public.subscription_payments from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4 · estado_suscripcion — la opinión, derivada de los hechos
--
-- Devuelve por negocio: en qué está, cuántos meses debe y desde cuál.
--
-- La regla del día 10 vive acá: un mes NO se considera vencido hasta que pasó
-- su día 10. Si hoy es 5 de agosto, agosto todavía no se debe — está corriendo.
-- ---------------------------------------------------------------------------
create or replace function public.estado_suscripcion(p_store_id uuid, p_hoy date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy    date := coalesce(p_hoy, current_date);
  v_sub    public.subscriptions;
  v_mes    date;
  v_limite date;
  v_impago date := null;
  v_meses  int := 0;
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    return jsonb_build_object('estado', 'sin_suscripcion');
  end if;

  if v_sub.estado = 'cancelada' then
    return jsonb_build_object('estado', 'cancelada', 'cancelada_el', v_sub.cancelada_el);
  end if;

  -- Todavía en el mes de prueba: no debe nada y no hay que molestarlo.
  if v_sub.prueba_hasta is not null and v_hoy <= v_sub.prueba_hasta then
    return jsonb_build_object(
      'estado', 'prueba',
      'prueba_hasta', v_sub.prueba_hasta,
      'precio', v_sub.precio_mensual
    );
  end if;

  /* Se recorre mes a mes desde el primer período facturable hasta hoy, y se
     busca el más viejo SIN pago cuyo día 10 ya pasó. Es un loop sobre pocos
     meses (un cliente de 3 años son 36 vueltas) y se lee igual que la regla
     de negocio, que es lo que va a tener que revisar alguien en dos años. */
  v_mes := date_trunc('month', v_sub.cobra_desde)::date;
  while v_mes <= date_trunc('month', v_hoy)::date loop
    v_limite := v_mes + interval '9 days';  -- el día 10 de ese mes

    if v_hoy > v_limite
       and not exists (
         select 1 from public.subscription_payments
          where store_id = p_store_id and periodo = v_mes
       )
    then
      v_meses := v_meses + 1;
      if v_impago is null then v_impago := v_mes; end if;
    end if;

    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  if v_meses = 0 then
    return jsonb_build_object(
      'estado', 'al_dia',
      'precio', v_sub.precio_mensual,
      'proximo_vencimiento', (date_trunc('month', v_hoy)::date + interval '9 days')::date
    );
  end if;

  return jsonb_build_object(
    'estado', 'debe',
    'precio', v_sub.precio_mensual,
    'meses_impagos', v_meses,
    'desde', v_impago,
    'deuda', v_meses * v_sub.precio_mensual,
    -- Días desde que venció el más viejo: es lo que decide el escalón.
    'dias_de_atraso', (v_hoy - (v_impago + interval '9 days')::date)
  );
end;
$$;

revoke execute on function public.estado_suscripcion(uuid, date) from public, authenticated, anon;
grant  execute on function public.estado_suscripcion(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- 5 · La vista del panel — negocios + salud + cobranza, en una consulta
--
-- Extiende `admin_stores` (019:45-55) en vez de reemplazarla, y de paso arregla
-- dos cosas que la auditoría encontró:
--
--   · `ultima_venta` NO filtraba por estado (019:50), a diferencia de `ventas`
--     que sí exige 'completed'. Era la única de las cinco agregaciones sin
--     filtro: una venta ANULADA contaba como pulso, y "última venta" es
--     justamente la señal de abandono.
--   · Ninguna agregación tenía ventana temporal: "1347 ventas" es desde
--     siempre y no distingue un cliente activo de uno que vendió mucho hace un
--     año. Se agrega `ventas_30d`.
-- ---------------------------------------------------------------------------
/* `drop` y no `create or replace`: Postgres no deja INSERTAR una columna en el
   medio de una vista existente (falla con "cannot change name of view column").
   Nada depende de esta vista salvo /super, que la consulta por nombre. */
drop view if exists public.admin_stores;
create view public.admin_stores as
  select s.id, s.name, s.slug, s.status, s.created_at,
         (select count(*) from public.members m where m.store_id = s.id and m.status = 'active') as miembros,
         (select count(*) from public.products p where p.store_id = s.id and p.status = 'active') as productos,
         (select count(*) from public.sales v where v.store_id = s.id and v.status = 'completed') as ventas,
         -- 057 · sólo ventas COMPLETADAS: una anulada no es pulso de uso.
         (select max(v.sold_at) from public.sales v
           where v.store_id = s.id and v.status = 'completed') as ultima_venta,
         -- 057 · la ventana que distingue "activo" de "vendió mucho hace un año".
         (select count(*) from public.sales v
           where v.store_id = s.id and v.status = 'completed'
             and v.sold_at >= now() - interval '30 days') as ventas_30d,
         (select m.display_name from public.members m
           where m.store_id = s.id and m.role = 'owner' and m.status = 'active' limit 1) as dueno,
         s.vertical,
         s.ai_assistant_enabled,
         -- 057 · la cobranza, al lado de la salud: son la misma decisión semanal.
         public.estado_suscripcion(s.id) as suscripcion
    from public.stores s;

revoke all on public.admin_stores from authenticated, anon;
grant select on public.admin_stores to service_role;

-- ---------------------------------------------------------------------------
-- 6 · Marcar un pago — el acto manual, con su rastro
--
-- Idempotente por el UNIQUE: marcar dos veces el mismo mes levanta un error
-- claro en vez de duplicar el ingreso.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_pago_suscripcion(
  p_store_id uuid,
  p_periodo  date,
  p_monto    numeric,
  p_actor    uuid,
  p_medio    text default 'transferencia',
  p_nota     text default null
) returns public.subscription_payments
language plpgsql security definer set search_path = public as $$
declare
  v_pago public.subscription_payments;
begin
  insert into public.subscription_payments (store_id, periodo, monto, marcado_por, medio, nota)
  values (p_store_id, date_trunc('month', p_periodo)::date, p_monto, p_actor, p_medio, p_nota)
  returning * into v_pago;
  return v_pago;
exception when unique_violation then
  raise exception 'periodo_ya_pagado';
end;
$$;

revoke execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text)
  from public, authenticated, anon;
grant  execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text)
  to service_role;
