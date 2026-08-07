-- ===========================================================================
-- 047 · Promociones (PR3) — lo que la sección necesita del backend
--
-- Aditiva: no cambia el esquema de `promos` ni de `sale_items`. Recrea cinco
-- funciones de 045 y agrega una helper. Cinco arreglos, en orden de gravedad:
--
--   B5 · EL DÍA SE CORTA EN LA TIMEZONE DEL NEGOCIO, no en la del servidor.
--        045 usó `current_date` en 14 lugares. El resto de la app (007, 008,
--        009, 013, 017, 018, 022, 027, 034, 038) resuelve el día con
--        `(now() at time zone stores.timezone)::date`. Mi desvío, mío el bug.
--        En Argentina (UTC−3) `current_date` se adelanta a las 21:00 hora
--        local: una promo "hasta el vie 14" DEJABA DE APLICAR el viernes a las
--        21:00 — con el cartel puesto en la góndola y el kiosco todavía
--        abierto. Es exactamente el desfasaje cartel↔caja que esta feature
--        existe para evitar, tres horas por día, todos los días.
--
--   B1 · El segundo escalón era inejecutable. `promos_sugeridas` excluía todo
--        producto con promo viva, así que el sistema NUNCA podía volver a
--        avisar — que es justo la decisión que tomó el owner (él firma cada
--        escalón, ningún precio cambia solo). Ahora el motor evalúa también lo
--        que ya está en promo, con dos cotas para no contradecirse a sí mismo.
--
--   B3 · La medición contaba VENTAS ANULADAS. Los predicados `status` y
--        `sold_at` vivían en el `on` de un `left join`: al anular una venta el
--        registro de `sales` deja de matchear, pero la fila de `sale_items`
--        sobrevive con su `qty` y el `sum` la sumaba igual. Una promo cuya
--        única venta se anuló declaraba unidades vendidas y plata cobrada.
--
--   B2 · Duración mínima (decisión del owner): 3 días, O hasta el vencimiento
--        ligado, lo que sea MÁS CORTO. Liquidar algo que vence en 2 días tiene
--        que poder durar 2 días. Sin cota en la RPC la regla es decorativa.
--
--   B4 · `promos_listado` no devolvía `cost_at_start` ni el tamaño del lote, y
--        sin eso la medición no puede decir qué había en juego.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0 · store_hoy — una sola definición de "hoy" para todo lo de promos
--
-- Existe para que el arreglo B5 no sea catorce lugares donde alguien puede
-- olvidarse. `stable` para que el planner la trate como constante dentro de la
-- consulta: `promo_vigente` la llama por fila en `pos_destacados`.
-- ---------------------------------------------------------------------------
create or replace function public.store_hoy(p_store_id uuid)
returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
           (select timezone from public.stores where id = p_store_id),
           'America/Argentina/Buenos_Aires'))::date;
$$;

revoke execute on function public.store_hoy(uuid) from public;
grant  execute on function public.store_hoy(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1 · promo_vigente — B5
--
-- Sigue siendo la ÚNICA definición de qué promo aplica hoy (la consumen
-- `register_sale` y las 3 RPCs de catálogo). Sólo cambia de dónde sale "hoy".
-- ---------------------------------------------------------------------------
create or replace function public.promo_vigente(p_store_id uuid, p_product_id uuid)
returns public.promos
language sql stable security definer set search_path = public as $$
  select *
    from public.promos
   where store_id   = p_store_id
     and product_id = p_product_id
     and ended_at is null
     and starts_on <= public.store_hoy(p_store_id)
     and ends_on   >= public.store_hoy(p_store_id)
   order by created_at desc
   limit 1;
$$;

revoke execute on function public.promo_vigente(uuid, uuid) from public;
grant  execute on function public.promo_vigente(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · create_promo — B2 + B5
--
-- Cuerpo idéntico al de 045 salvo el bloque de fechas. Dos reglas nuevas:
--
--   · promo_too_short   — piso de duración. Frena el latigazo de precio: un
--     precio que sube al otro día le enseña al cliente que los carteles no
--     valen. El piso cede ante el vencimiento porque liquidar algo que vence
--     pasado mañana es legítimo y es medio motivo de la feature.
--
--   · promo_after_expiry — techo. Una promo atada a un lote no puede
--     sobrevivirlo: pasada esa fecha estaría liquidando mercadería NUEVA al
--     precio de la vieja (riesgo 8 del plan). Atar el lote ES decir "esta
--     promo es por este lote"; el que quiera un precio bajo permanente no ata
--     nada. `resolve_expiry` ya cierra la promo cuando el lote se resuelve
--     antes de tiempo; esto cubre el caso en que nadie lo resuelve.
-- ---------------------------------------------------------------------------
create or replace function public.create_promo(
  p_store_id      uuid,
  p_product_id    uuid,
  p_promo_price   numeric,
  p_starts_on     date,
  p_ends_on       date,
  p_expiry_id     uuid    default null,
  p_origin        text    default 'manual',
  p_below_cost_ok boolean default false,
  p_reemplazar    boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member   public.members;
  v_product  public.products;
  v_vieja    public.promos;
  v_promo    public.promos;
  v_repl     uuid;
  v_hoy      date;
  v_vence    date;
  v_min_fin  date;
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  if p_origin not in ('manual', 'sugerida') then
    raise exception 'invalid_origin';
  end if;

  v_hoy := public.store_hoy(p_store_id);

  -- Lock de la fila del producto: cierra la carrera de dos altas simultáneas
  -- sobre el mismo producto (mismo patrón que register_sale, 027:133-141).
  select * into v_product from public.products
   where id = p_product_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'product_not_found';
  end if;
  if v_product.status <> 'active' then
    raise exception 'product_not_found';
  end if;

  if p_starts_on is null or p_ends_on is null
     or p_ends_on < p_starts_on
     or p_starts_on < v_hoy then
    raise exception 'invalid_range';
  end if;

  if p_promo_price is null or p_promo_price < 0 or p_promo_price >= v_product.price then
    raise exception 'invalid_amount';
  end if;

  -- Piso de costo: la POLÍTICA es del owner, no del algoritmo. Por defecto no se
  -- vende bajo costo; con opt-in explícito sí ("recuperar algo vs. perder todo").
  if v_product.cost is not null
     and p_promo_price < v_product.cost
     and not coalesce(p_below_cost_ok, false) then
    raise exception 'below_cost';
  end if;

  if p_expiry_id is not null then
    select expiry_date into v_vence from public.stock_expiries
     where id = p_expiry_id and store_id = p_store_id
       and product_id = p_product_id;
    if not found then
      raise exception 'expiry_not_found';
    end if;
  end if;

  -- 047 · duración: 3 días, o hasta el vencimiento ligado, lo que sea MÁS CORTO.
  v_min_fin := p_starts_on + 2;
  if v_vence is not null then
    v_min_fin := least(v_min_fin, v_vence);
    if p_ends_on > v_vence then
      raise exception 'promo_after_expiry';
    end if;
  end if;
  if p_ends_on < v_min_fin then
    raise exception 'promo_too_short';
  end if;

  -- Una promo viva por producto. "Viva" = no terminada y con rango que se solapa.
  select * into v_vieja from public.promos
   where store_id   = p_store_id
     and product_id = p_product_id
     and ended_at is null
     and ends_on   >= v_hoy              -- las ya vencidas no estorban
     and starts_on <= p_ends_on
     and ends_on   >= p_starts_on
   limit 1;

  if found then
    if not coalesce(p_reemplazar, false) then
      raise exception 'promo_overlap';
    end if;
    update public.promos
       set ended_at = now(), ended_reason = 'reemplazo'
     where id = v_vieja.id;
    v_repl := v_vieja.id;
  end if;

  insert into public.promos (store_id, product_id, promo_price, list_price,
                             cost_at_start, starts_on, ends_on, expiry_id,
                             origin, below_cost_ok, created_by)
  values (p_store_id, p_product_id, p_promo_price,
          -- El precio de lista se hereda de la promo reemplazada: si no, el
          -- segundo escalón congelaría como "lista" el precio ya rebajado y el
          -- tachado del POS mostraría una rebaja más chica de la que hubo.
          coalesce(v_vieja.list_price, v_product.price),
          v_product.cost, p_starts_on, p_ends_on, p_expiry_id,
          p_origin, coalesce(p_below_cost_ok, false), v_member.id)
  returning * into v_promo;

  return jsonb_build_object(
    'promo_id',           v_promo.id,
    'replaced_promo_id',  v_repl,
    'estado',             case when v_promo.starts_on > v_hoy
                               then 'programada' else 'activa' end
  );
end;
$$;

revoke execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean) from public;
grant  execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 · promos_listado — B3 + B4 + B5
--
-- B3 es el arreglo que importa: la atribución pasa de dos `left join` en
-- cascada a un `join` real dentro de un escalar correlacionado. Con el `left
-- join`, anular una venta dejaba la fila de `sale_items` sumando igual.
--
-- `precio_actual` sale de `products.price` a propósito y NO de `list_price`:
-- si el dueño cambió el precio durante la promo, el congelado miente y la UI
-- prometería un retorno a un precio que ya no existe.
-- ---------------------------------------------------------------------------
create or replace function public.promos_listado(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
  v_costos boolean;
  v_hoy    date;
  v_res    jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  v_costos := (v_member.role = 'owner' or v_member.can_see_costs);
  v_hoy    := public.store_hoy(p_store_id);

  with base as (
    select pr.*,
           p.name  as product_name,
           p.emoji as product_emoji,
           p.price as precio_actual,
           e.qty         as lote_qty,
           e.expiry_date as lote_vence,
           case
             when pr.ended_at is not null or pr.ends_on < v_hoy then 'terminada'
             when pr.starts_on > v_hoy                          then 'programada'
             else 'activa'
           end as estado
      from public.promos pr
      join public.products p on p.id = pr.product_id
      left join public.stock_expiries e on e.id = pr.expiry_id
     where pr.store_id = p_store_id
       and (pr.ended_at is null
            or pr.ended_at >= now() - interval '30 days')
       and pr.ends_on >= v_hoy - interval '30 days'
  ),
  medido as (
    select b.id as promo_id,
           -- 047 · `join` real, no `left join` con predicados en el `on`: una
           -- venta anulada tiene que desaparecer de la cuenta, no quedar con su
           -- `sale_items` colgando. Acotado a 90 días (baseline de escala).
           (select coalesce(sum(i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.promo_id = b.id
               and s.status = 'completed'
               and s.sold_at >= now() - interval '90 days') as unidades,
           (select coalesce(sum((i.unit_price - i.unit_cost) * i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.promo_id = b.id
               and s.status = 'completed'
               and s.sold_at >= now() - interval '90 days') as ganancia,
           (select coalesce(sum(i.unit_price * i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.promo_id = b.id
               and s.status = 'completed'
               and s.sold_at >= now() - interval '90 days') as cobrado,
           (select coalesce(sum((i.list_price - i.unit_price) * i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.promo_id = b.id
               and s.status = 'completed'
               and s.sold_at >= now() - interval '90 days') as costo_promo
      from base b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id,
           'estado', b.estado,
           'product_id', b.product_id,
           'product_name', b.product_name,
           'product_emoji', b.product_emoji,
           'promo_price', b.promo_price,
           'list_price', b.list_price,
           'precio_actual', b.precio_actual,
           'starts_on', b.starts_on,
           'ends_on', b.ends_on,
           'dias_restantes', greatest(b.ends_on - v_hoy, 0),
           'origin', b.origin,
           'below_cost_ok', b.below_cost_ok,
           'expiry_id', b.expiry_id,
           'lote_vence', b.lote_vence,
           'ended_at', b.ended_at,
           'ended_reason', b.ended_reason,
           'unidades', m.unidades,
           -- La plata sólo para quien puede ver costos.
           'cobrado',             case when v_costos then m.cobrado end,
           'ganancia_recuperada', case when v_costos then m.ganancia end,
           'costo_promo',         case when v_costos then m.costo_promo end,
           -- 047 · B4 · qué había en juego. El lote NO se cruza con las
           -- unidades vendidas: sin FIFO por lote, decir "vendiste 6 de las 8
           -- del lote" sería inventar una atribución que el dato no tiene.
           'lote_qty',            b.lote_qty,
           'lote_al_costo',       case when v_costos and b.lote_qty is not null
                                       then b.cost_at_start * b.lote_qty end,
           'cost_at_start',       case when v_costos then b.cost_at_start end
         ) order by
             case b.estado when 'activa' then 0 when 'programada' then 1 else 2 end,
             b.ends_on), '[]'::jsonb)
    into v_res
    from base b
    join medido m on m.promo_id = b.id;

  return v_res;
end;
$$;

revoke execute on function public.promos_listado(uuid) from public;
grant  execute on function public.promos_listado(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · promos_sugeridas — B1 + B5
--
-- Sigue siendo determinista y sigue sin prometer nada: calcula el ritmo que
-- HARÍA FALTA, nunca el que va a haber. Lo nuevo es que también mira lo que ya
-- está en promo, para poder proponer el SEGUNDO ESCALÓN.
--
-- Tres cotas para que el re-escalón no se vuelva ruido ni una contradicción:
--
--   1. Mínimo 2 días completos desde que arrancó la promo. Un sistema que al
--      día siguiente dice "no alcanza" sobre el precio que él mismo sugirió
--      pierde autoridad, y encima mide sobre una muestra de un día.
--   2. El ritmo se mide DESDE `starts_on`, no a 14 días. La ventana de 14 días
--      está contaminada por los días previos a la rebaja: subestimaría el
--      efecto del precio que el dueño ya firmó y pediría bajar de más.
--   3. La escalera se calcula sobre el precio de LISTA, no sobre el vigente.
--      Aplicar −35% al precio ya rebajado compone los descuentos y llega al
--      costo sin que nadie lo haya decidido.
-- ---------------------------------------------------------------------------
create or replace function public.promos_sugeridas(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member   public.members;
  v_settings public.store_settings;
  v_dias     int;
  v_hoy      date;
  v_tz       text;
  v_res      jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  if not (v_member.role = 'owner' or v_member.can_see_costs) then
    raise exception 'not_allowed';
  end if;

  select * into v_settings from public.store_settings where store_id = p_store_id;
  v_hoy := public.store_hoy(p_store_id);
  select coalesce(timezone, 'America/Argentina/Buenos_Aires') into v_tz
    from public.stores where id = p_store_id;
  -- Ventana: lo que la UI de Vencimientos realmente usa, no "todo".
  v_dias := greatest(coalesce(v_settings.expiry_warning_days, 7), 7) * 2;

  with candidatos as (
    select e.id as expiry_id, e.expiry_date, e.qty as lote_qty,
           (e.expiry_date - v_hoy) as dias,
           p.id as product_id, p.name, p.emoji, p.price, p.cost, p.stock,
           pr.id         as promo_vigente_id,
           pr.promo_price,
           pr.starts_on  as promo_starts_on,
           pr.ends_on    as promo_ends_on,
           -- Base de la escalera y precio que hay que mejorar.
           coalesce(pr.list_price, p.price)  as precio_lista,
           coalesce(pr.promo_price, p.price) as precio_efectivo,
           -- Ventana de medición del ritmo (cota 2).
           case when pr.id is null then 14
                else greatest(v_hoy - pr.starts_on, 1) end as dias_ventana,
           -- El arranque de la promo se ancla a la medianoche DEL NEGOCIO: un
           -- `::timestamptz` a secas usaría la del servidor y arrastraría las
           -- ventas de las últimas horas previas a la rebaja.
           case when pr.id is null then now() - interval '14 days'
                else pr.starts_on::timestamp at time zone v_tz end as ventana_desde
      from public.stock_expiries e
      join public.products p on p.id = e.product_id
      -- 047 · B1 · antes esto era un `not exists` que sacaba de la lista todo
      -- lo que ya estaba en promo. Con eso, el segundo escalón no existía.
      left join public.promos pr
             on pr.store_id   = p_store_id
            and pr.product_id = p.id
            and pr.ended_at is null
            and pr.starts_on <= v_hoy
            and pr.ends_on   >= v_hoy
     where e.store_id = p_store_id
       and e.resolved_at is null
       and e.expiry_date >= v_hoy
       and e.expiry_date <= v_hoy + v_dias
       and p.status = 'active'
       and p.stock  > 0
       and p.price  > 0
       -- Cota 1: no contradecirse al día siguiente de la propia sugerencia.
       and (pr.id is null or v_hoy - pr.starts_on >= 2)
  ),
  ritmo as (
    select c.expiry_id,
           -- Escalar correlacionado con `join` real: una venta anulada NO cuenta
           -- (misma trampa que B3 en promos_listado).
           (select coalesce(sum(i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.product_id = c.product_id
               and s.store_id   = p_store_id
               and s.status     = 'completed'
               and s.sold_at   >= c.ventana_desde)::numeric
             / greatest(c.dias_ventana, 1)              as por_dia,
           (select coalesce(sum(i.qty), 0)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
             where i.promo_id = c.promo_vigente_id
               and s.status   = 'completed'
               and s.sold_at >= c.ventana_desde)        as unidades_desde_promo
      from candidatos c
  ),
  cuenta as (
    select c.*,
           r.por_dia                                    as ritmo_actual,
           r.unidades_desde_promo,
           c.stock::numeric / greatest(c.dias, 1)       as ritmo_necesario,
           -- Escalera por urgencia (política, no optimización).
           case
             when c.dias <= 1 then 0.50
             when c.dias <= 3 then 0.35
             when c.dias <= 7 then 0.25
             else                  0.15
           end                                          as pct
      from candidatos c
      join ritmo r on r.expiry_id = c.expiry_id
  ),
  precios as (
    select q.*,
           -- Pisos, en orden: margen mínimo del negocio → costo → bajo costo
           -- SÓLO con opt-in explícito del owner (que acá no se asume).
           greatest(
             public.round_price(q.precio_lista * (1 - q.pct),
                                coalesce(v_settings.reprice_rounding, 0)),
             case
               when q.cost is null then 0
               when q.dias <= 1    then q.cost          -- cerca del vencimiento: hasta el costo
               else public.round_price(
                      q.cost * (1 + coalesce(v_settings.min_margin_pct, 25) / 100.0),
                      coalesce(v_settings.reprice_rounding, 0))
             end
           ) as sugerido
      from cuenta q
     where q.ritmo_actual < q.ritmo_necesario     -- si se agota solo, NO se sugiere
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'expiry_id', s.expiry_id,
           'product_id', s.product_id,
           'name', s.name,
           'emoji', s.emoji,
           'expiry_date', s.expiry_date,
           'dias', s.dias,
           'stock', s.stock,
           'lote_qty', s.lote_qty,
           'price', s.precio_efectivo,
           'list_price', s.precio_lista,
           'cost', s.cost,
           'sugerido', s.sugerido,
           'pct', round(s.pct * 100),
           'ritmo_actual', round(s.ritmo_actual, 2),
           'ritmo_necesario', round(s.ritmo_necesario, 2),
           'margen_unitario', case when s.cost is not null then s.sugerido - s.cost end,
           'plata_en_riesgo', case when s.cost is not null then s.cost * s.stock end,
           -- 047 · el segundo escalón: la UI necesita nombrar lo que el dueño ya
           -- decidió ("lo pusiste a $1.440 el lunes") antes de proponer nada.
           'es_reescalon',         (s.promo_vigente_id is not null),
           'promo_vigente_id',     s.promo_vigente_id,
           'promo_price_actual',   s.promo_price,
           'promo_starts_on',      s.promo_starts_on,
           'promo_ends_on',        s.promo_ends_on,
           'unidades_desde_promo', s.unidades_desde_promo,
           'aplicable', (s.sugerido < s.precio_efectivo)
         ) order by s.dias, s.name), '[]'::jsonb)
    into v_res
    from precios s
   -- Tiene que MEJORAR el precio que rige hoy. En un re-escalón eso además
   -- garantiza que nunca se proponga un escalón menos profundo que el vigente.
   where s.sugerido < s.precio_efectivo;

  return v_res;
end;
$$;

revoke execute on function public.promos_sugeridas(uuid) from public;
grant  execute on function public.promos_sugeridas(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5 · promos_carteles — la lista que se mira parado frente a la góndola
--
-- Vista de LECTURA, deliberadamente pobre: nombre, precio nuevo, precio viejo
-- y hasta cuándo. Nada de costo, margen, stock ni el motivo del descuento — un
-- cartel que dice "está por vencer" no vende.
--
-- Sólo lo ACTIVO hoy. Las programadas quedan afuera a propósito: un cartel
-- puesto hoy con el precio de mañana es el desfasaje cartel↔caja que esta
-- feature existe para evitar.
--
-- No exige `can_see_costs`: no hay un solo costo acá, y el que pone los
-- carteles en la góndola muchas veces no es el dueño.
-- ---------------------------------------------------------------------------
create or replace function public.promos_carteles(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy date;
  v_res jsonb;
begin
  perform public.rpc_member(p_store_id);
  v_hoy := public.store_hoy(p_store_id);

  select coalesce(jsonb_agg(jsonb_build_object(
           'promo_id',  pr.id,
           'name',      p.name,
           'emoji',     p.emoji,
           'precio',    pr.promo_price,
           'antes',     pr.list_price,
           'ends_on',   pr.ends_on,
           'termina_hoy', (pr.ends_on = v_hoy)
         ) order by p.name), '[]'::jsonb)
    into v_res
    from public.promos pr
    join public.products p on p.id = pr.product_id
   where pr.store_id = p_store_id
     and pr.ended_at is null
     and pr.starts_on <= v_hoy
     and pr.ends_on   >= v_hoy;

  return v_res;
end;
$$;

revoke execute on function public.promos_carteles(uuid) from public;
grant  execute on function public.promos_carteles(uuid) to authenticated;