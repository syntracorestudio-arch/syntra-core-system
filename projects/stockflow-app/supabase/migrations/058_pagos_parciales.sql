-- ===========================================================================
-- 058 · Un pago parcial es un pago parcial
--
-- Sale de la verificación adversarial del panel de cobranza (regla 5b).
-- Dos hallazgos ALTOS, los dos sobre plata, los dos por la misma causa de
-- fondo: 057 modeló "el mes está pagado" como la EXISTENCIA de una fila, no
-- como una SUMA.
--
-- A1 · UN PAGO DE $1 BORRABA LA DEUDA DEL MES ENTERO.
--   `estado_suscripcion` (057) daba el mes por saldado si había una fila, sin
--   mirar el monto. Medido: con $180.000 de deuda, marcar $0 y $1 la dejó en
--   $60.000 — un peso borró ciento veinte mil.
--   Y el `unique (store_id, periodo)` impedía asentar el resto: el segundo pago
--   del mismo mes moría con `periodo_ya_pagado`.
--   Lo peor es que el diálogo del panel INVITA a pagar de menos ("un cliente
--   puede pagar de menos y eso hay que poder asentarlo tal cual"). O sea que la
--   UI ofrecía algo que el modelo no sabía representar.
--
-- A2 · UN PERÍODO EQUIVOCADO SE ACEPTABA EN SILENCIO.
--   Sólo se validaba el FORMATO de la fecha. En un `input type="date"` tipear
--   2025 en vez de 2026 es un click: la plata quedaba asentada, la deuda no
--   bajaba, y la UI decía "registrado". Sin forma de borrarlo desde el panel.
--
-- EL CAMBIO DE MODELO, en una línea: el mes se salda cuando la SUMA de sus
-- pagos alcanza el precio. "Pagado" pasa de ser un booleano implícito a ser una
-- cuenta.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · Varios pagos por mes — se cae el UNIQUE, no la protección
--
-- El `unique (store_id, periodo)` existía para que un doble click no asentara
-- el pago dos veces. Era una protección real y no se pierde: se muda a
-- `marcar_pago_suscripcion`, que ahora rechaza lo que EXCEDE el precio del mes.
--
--   · segundo click del mismo pago  ⇒ excede ⇒ rechazado (igual que antes)
--   · el resto de un pago parcial   ⇒ no excede ⇒ aceptado (antes, imposible)
--
-- La regla nueva es más precisa que la vieja: la vieja preguntaba "¿ya hay una
-- fila?", ésta pregunta "¿ya está pago?".
-- ---------------------------------------------------------------------------
alter table public.subscription_payments
  drop constraint if exists subscription_payments_store_id_periodo_key;

-- ---------------------------------------------------------------------------
-- 2 · estado_suscripcion — el mes se salda por SUMA
--
-- Cambian dos cosas respecto de 057:
--   · se compara `sum(monto)` contra el precio, en vez de mirar si hay fila;
--   · la deuda es lo que FALTA (`precio - pagado`), no `meses × precio`.
--
-- Se agrega `parcial` al resultado: un mes con $40.000 de $60.000 no es lo
-- mismo que uno sin pagar nada, y quien llama por teléfono necesita esa
-- diferencia — "te falta completar" no es "no pagaste".
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
    v_limite := v_mes + interval '9 days';   -- el día 10 de ese mes

    if v_hoy > v_limite then
      select coalesce(sum(monto), 0) into v_pagado
        from public.subscription_payments
       where store_id = p_store_id and periodo = v_mes;

      v_falta := v_sub.precio_mensual - v_pagado;

      if v_falta > 0 then
        v_meses := v_meses + 1;
        v_deuda := v_deuda + v_falta;
        if v_impago is null then v_impago := v_mes; end if;
        -- Pagó algo pero no todo: no es lo mismo que no haber pagado.
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
-- 3 · marcar_pago_suscripcion — el período tiene que existir de verdad
--
-- Tres cotas nuevas, todas por hallazgos medidos:
--
--   · El período no puede ser ANTERIOR a `cobra_desde` (A2: se aceptaba 2025).
--   · Ni POSTERIOR al mes en curso (A2: se aceptaba 2030).
--   · El pago no puede EXCEDER lo que falta del mes — acá vive la protección
--     del doble click que antes daba el UNIQUE.
--
-- Y una cota de contexto: no se puede pagar sobre un negocio SIN suscripción
-- (M1: quedaba plata asentada que ninguna pantalla mostraba nunca).
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
  v_sub    public.subscriptions;
  v_mes    date := date_trunc('month', p_periodo)::date;
  v_pagado numeric;
  v_falta  numeric;
  v_pago   public.subscription_payments;
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    raise exception 'sin_suscripcion';
  end if;

  if p_monto <= 0 then
    raise exception 'monto_invalido';
  end if;

  if v_mes < date_trunc('month', v_sub.cobra_desde)::date then
    raise exception 'periodo_anterior_al_alta';
  end if;

  if v_mes > date_trunc('month', current_date)::date then
    raise exception 'periodo_futuro';
  end if;

  select coalesce(sum(monto), 0) into v_pagado
    from public.subscription_payments
   where store_id = p_store_id and periodo = v_mes;

  v_falta := v_sub.precio_mensual - v_pagado;

  /* Ya está saldado: es el segundo click del mismo pago, o un mes que alguien
     quiso cobrar dos veces. Mismo error que antes daba el UNIQUE, para que el
     mensaje del panel no cambie. */
  if v_falta <= 0 then
    raise exception 'periodo_ya_pagado';
  end if;

  /* Pagar de MÁS no se asienta en silencio: o el monto está mal tipeado, o el
     período es otro. Las dos cosas se arreglan mirando, no guardando. */
  if p_monto > v_falta then
    raise exception 'monto_excede_lo_adeudado';
  end if;

  insert into public.subscription_payments (store_id, periodo, monto, marcado_por, medio, nota)
  values (p_store_id, v_mes, p_monto, p_actor, p_medio, p_nota)
  returning * into v_pago;

  return v_pago;
end;
$$;

revoke execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text)
  from public, authenticated, anon;
grant  execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4 · service_role puede LEER las tablas (M3)
--
-- 057 sólo revocó de `authenticated, anon`, y el ACL por defecto de este
-- proyecto deja a `service_role` sin SELECT ni INSERT. Hoy no se nota porque
-- /super lee la vista y llama RPCs `security definer` — pero la PRIMERA línea
-- de código que haga `admin.from("subscriptions")` (el aviso al dueño, un cron,
-- un export) revienta en runtime y no en `tsc`. Es una bomba de tiempo, no un
-- permiso faltante.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.subscriptions to service_role;
grant select, insert on public.subscription_payments to service_role;
