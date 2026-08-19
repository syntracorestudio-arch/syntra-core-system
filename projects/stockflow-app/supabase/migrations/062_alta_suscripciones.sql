-- ===========================================================================
-- 062 · Alta y edición de suscripciones — sin tipear fechas, sin re-tarifar
--
-- Cierra dos cosas de la verificación adversarial que tienen la misma raíz:
-- el operador podía escribir a mano datos que el sistema puede derivar.
--
-- M4 · LAS SUSCRIPCIONES SE CARGABAN A MANO EN LA BASE.
--   No había alta en ningún lado: las filas se insertaban con SQL. El
--   verificador midió dos tipeos plausibles y sus consecuencias:
--
--     cobra_desde = '2026-08-20' (la fecha del alta, no el mes)
--       → el 25 de agosto: CORTE, con 15 días de atraso, a un cliente de 5 días
--
--     prueba_hasta = '2026-08-15' con cobra_desde = '2026-08-01'
--       → el 16 debe $60.000 del mes que le habíamos regalado
--
--   Es el mismo antipatrón que 056 sacó del superadmin: si el único camino es
--   editar la base, un error de tipeo se convierte en una decisión de negocio.
--
--   EL ARREGLO NO ES VALIDAR MEJOR, ES NO PREGUNTAR. El alta pide precio y si
--   lleva prueba; las fechas las calcula la base. Un campo que no existe no se
--   puede tipear mal.
--
-- M2 · SUBIR EL PRECIO RE-TARIFABA LA DEUDA VIEJA.
--   `deuda` se calculaba como meses × precio ACTUAL. Subirle la cuota a alguien
--   que debe tres meses le subía retroactivamente lo adeudado, sin que nadie
--   pagara ni dejara de pagar.
--
--   Decisión del owner: los meses adeudados quedan CONGELADOS al precio que
--   tenían. Para eso hace falta saber qué precio regía cada mes — de ahí la
--   tabla de historia. Un precio sin fecha no puede contestar "¿cuánto valía
--   agosto?", y esa es exactamente la pregunta de una discusión por plata.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · subscription_prices — qué precio regía cada mes
--
-- `desde` es el primer mes en que rige (día 1). El precio de un mes es el de la
-- fila más reciente con `desde <= ese mes`.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_prices (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  desde      date not null,
  precio     numeric(12,2) not null check (precio >= 0),
  motivo     text,
  fijado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, desde)
);

alter table public.subscription_prices
  drop constraint if exists subscription_prices_desde_dia1;
alter table public.subscription_prices
  add constraint subscription_prices_desde_dia1 check (extract(day from desde) = 1);

alter table public.subscription_prices enable row level security;
revoke all on public.subscription_prices from authenticated, anon;
grant select, insert on public.subscription_prices to service_role;

/* Backfill: las suscripciones que ya existen estrenan su historia con el precio
   que tienen hoy, vigente desde su primer mes facturable. Sin esto, el cálculo
   de deuda de un cliente viejo se quedaría sin precio y daría cero. */
insert into public.subscription_prices (store_id, desde, precio, motivo)
select s.store_id, date_trunc('month', s.cobra_desde)::date, s.precio_mensual,
       'Precio inicial (backfill 062)'
  from public.subscriptions s
 where not exists (
   select 1 from public.subscription_prices p where p.store_id = s.store_id
 );

-- ---------------------------------------------------------------------------
-- 2 · precio_del_mes — el precio que regía en un mes dado
-- ---------------------------------------------------------------------------
create or replace function public.precio_del_mes(p_store_id uuid, p_mes date)
returns numeric
language sql stable security definer set search_path = public as $$
  select precio from public.subscription_prices
   where store_id = p_store_id and desde <= date_trunc('month', p_mes)::date
   order by desde desc
   limit 1;
$$;

revoke execute on function public.precio_del_mes(uuid, date) from public, authenticated, anon;
grant  execute on function public.precio_del_mes(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- 3 · estado_suscripcion — cada mes vale lo que valía
--
-- Único cambio respecto de 058: el precio deja de ser `v_sub.precio_mensual`
-- (el de HOY) y pasa a ser el que regía en ese mes.
-- ---------------------------------------------------------------------------
create or replace function public.estado_suscripcion(p_store_id uuid, p_hoy date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy     date := coalesce(p_hoy, current_date);
  v_sub     public.subscriptions;
  v_mes     date;
  v_limite  date;
  v_pagado  numeric;
  v_precio  numeric;
  v_falta   numeric;
  v_impago  date := null;
  v_meses   int := 0;
  v_deuda   numeric := 0;
  v_parcial boolean := false;
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    return jsonb_build_object('estado', 'sin_suscripcion');
  end if;

  if v_sub.estado = 'cancelada' then
    return jsonb_build_object('estado', 'cancelada', 'cancelada_el', v_sub.cancelada_el);
  end if;

  if v_sub.prueba_hasta is not null and v_hoy <= v_sub.prueba_hasta then
    return jsonb_build_object(
      'estado', 'prueba',
      'prueba_hasta', v_sub.prueba_hasta,
      'precio', v_sub.precio_mensual
    );
  end if;

  v_mes := date_trunc('month', v_sub.cobra_desde)::date;
  while v_mes <= date_trunc('month', v_hoy)::date loop
    v_limite := v_mes + interval '9 days';

    if v_hoy > v_limite then
      select coalesce(sum(monto), 0) into v_pagado
        from public.subscription_payments
       where store_id = p_store_id and periodo = v_mes;

      /* 062 · el precio de ESE mes, no el de hoy. Subirle la cuota a alguien
         que debe tres meses no puede subirle retroactivamente lo adeudado:
         decisión del owner, y además es lo defendible en una discusión. */
      v_precio := coalesce(public.precio_del_mes(p_store_id, v_mes), v_sub.precio_mensual);
      v_falta  := v_precio - v_pagado;

      if v_falta > 0 then
        v_meses := v_meses + 1;
        v_deuda := v_deuda + v_falta;
        if v_impago is null then v_impago := v_mes; end if;
        if v_pagado > 0 then v_parcial := true; end if;
      end if;
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
    'deuda', v_deuda,
    'parcial', v_parcial,
    'dias_de_atraso', (v_hoy - (v_impago + interval '9 days')::date)
  );
end;
$$;

revoke execute on function public.estado_suscripcion(uuid, date) from public, authenticated, anon;
grant  execute on function public.estado_suscripcion(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- 4 · crear_suscripcion — precio y prueba; las fechas las calcula la base
--
-- `p_con_prueba` = true (el default del negocio: el primer mes es gratis):
--   la prueba dura UN MES desde el alta, y se cobra desde el mes siguiente al
--   que termina. Alta el 30 de agosto ⇒ gratis hasta el 30 de septiembre ⇒
--   cobra desde octubre. Así "un mes gratis" es un mes de verdad para todos, y
--   no dos días para el que firmó a fin de mes.
-- ---------------------------------------------------------------------------
create or replace function public.crear_suscripcion(
  p_store_id    uuid,
  p_precio      numeric,
  p_actor       uuid,
  p_con_prueba  boolean default true,
  p_notas       text default null
) returns public.subscriptions
language plpgsql security definer set search_path = public as $$
declare
  v_hoy    date := current_date;
  v_prueba date;
  v_cobra  date;
  v_sub    public.subscriptions;
begin
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'negocio_inexistente';
  end if;
  if exists (select 1 from public.subscriptions where store_id = p_store_id) then
    raise exception 'ya_tiene_suscripcion';
  end if;
  if p_precio is null or p_precio <= 0 then
    raise exception 'precio_invalido';
  end if;

  if p_con_prueba then
    v_prueba := (v_hoy + interval '1 month')::date;
    v_cobra  := (date_trunc('month', v_prueba) + interval '1 month')::date;
  else
    v_prueba := null;
    v_cobra  := date_trunc('month', v_hoy)::date;
  end if;

  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde, notas)
  values (p_store_id, p_precio, v_prueba, v_cobra, p_notas)
  returning * into v_sub;

  insert into public.subscription_prices (store_id, desde, precio, motivo, fijado_por)
  values (p_store_id, v_cobra, p_precio, 'Precio inicial', p_actor);

  return v_sub;
end;
$$;

revoke execute on function public.crear_suscripcion(uuid, numeric, uuid, boolean, text)
  from public, authenticated, anon;
grant  execute on function public.crear_suscripcion(uuid, numeric, uuid, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5 · cambiar_precio_suscripcion — rige desde el mes que viene
--
-- Nunca desde el mes en curso: si alguien ya pagó agosto y a mitad de mes le
-- subimos la cuota, pasaría a deber la diferencia de un mes que ya saldó.
-- El precio nuevo empieza a correr el 1 del mes siguiente, que además es lo
-- que uno le dice por teléfono ("desde el mes que viene").
-- ---------------------------------------------------------------------------
create or replace function public.cambiar_precio_suscripcion(
  p_store_id uuid,
  p_precio   numeric,
  p_motivo   text,
  p_actor    uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_desde date := (date_trunc('month', current_date) + interval '1 month')::date;
begin
  if not exists (select 1 from public.subscriptions where store_id = p_store_id) then
    raise exception 'sin_suscripcion';
  end if;
  if p_precio is null or p_precio <= 0 then
    raise exception 'precio_invalido';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'motivo_requerido';
  end if;

  insert into public.subscription_prices (store_id, desde, precio, motivo, fijado_por)
  values (p_store_id, v_desde, p_precio, trim(p_motivo), p_actor)
  on conflict (store_id, desde) do update
     set precio = excluded.precio, motivo = excluded.motivo, fijado_por = excluded.fijado_por;

  /* `precio_mensual` sigue siendo "el precio vigente" para la UI y para el
     próximo vencimiento; la deuda vieja la resuelve la historia. */
  update public.subscriptions
     set precio_mensual = p_precio, updated_at = now()
   where store_id = p_store_id;

  return jsonb_build_object('desde', v_desde, 'precio', p_precio);
end;
$$;

revoke execute on function public.cambiar_precio_suscripcion(uuid, numeric, text, uuid)
  from public, authenticated, anon;
grant  execute on function public.cambiar_precio_suscripcion(uuid, numeric, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6 · cancelar / reactivar
--
-- Cancelar NO borra: deja de cobrar y deja de reclamar, pero la historia de
-- pagos queda. Un cliente que se fue y vuelve tiene que poder mirarse.
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_suscripcion(
  p_store_id uuid,
  p_motivo   text,
  p_actor    uuid,
  p_reactivar boolean default false
) returns public.subscriptions
language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions;
begin
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'motivo_requerido';
  end if;

  update public.subscriptions
     set estado       = case when p_reactivar then 'activa' else 'cancelada' end,
         cancelada_el = case when p_reactivar then null else now() end,
         notas        = trim(p_motivo),
         updated_at   = now()
   where store_id = p_store_id
  returning * into v_sub;

  if not found then
    raise exception 'sin_suscripcion';
  end if;

  return v_sub;
end;
$$;

revoke execute on function public.cancelar_suscripcion(uuid, text, uuid, boolean)
  from public, authenticated, anon;
grant  execute on function public.cancelar_suscripcion(uuid, text, uuid, boolean)
  to service_role;
