-- =============================================================================
-- StockFlow — 015_margen_reposicion.sql  (Fase 2, tanda 2B)
-- "Este producto ya no te deja plata."
--
-- El problema que resuelve, y que ningún competidor muestra:
--
--   Comprás la Coca a $900 y la vendés a $1.300 → 31% de margen. Tres meses
--   después la reponés a $1.180 y el precio de venta sigue en $1.300. Tu reporte
--   dice que ganás 31% porque mira el costo con el que se vendió; en realidad
--   ganás 9%. El kiosquero se entera cuando no le cierra la caja a fin de mes.
--
-- El costo de reposición ya lo tenemos: `register_purchase` pisa `products.cost`
-- con el costo de cada compra. Lo que falta es COMPARARLO contra el precio y
-- contra el margen que el dueño tenía cuando puso ese precio.
--
-- No inventamos un "margen ideal": usamos el que él mismo eligió cuando fijó el
-- precio. Es su decisión, no nuestra opinión.
-- =============================================================================

-- ---------- Umbral configurable ----------
alter table public.store_settings
  add column if not exists min_margin_pct numeric(5,2) not null default 25
    check (min_margin_pct >= 0 and min_margin_pct < 100);

comment on column public.store_settings.min_margin_pct is
  'Margen mínimo aceptable (% sobre el precio). Por debajo, el producto se marca como erosionado.';

-- Índice parcial para "qué costaba antes de tal fecha": el índice general de
-- stock_ledger no filtra por reason y acá el 90% de los asientos son ventas.
--
-- 'initial' entra junto a 'purchase': la carga inicial de stock también lleva el
-- costo que el dueño pagó, y en un kiosco recién arrancado puede ser el ÚNICO
-- costo registrado. Dejarla afuera hacía invisible la erosión en los productos
-- que nunca se repusieron por el sistema.
create index if not exists stock_ledger_costos_idx
  on public.stock_ledger (product_id, created_at desc)
  where reason in ('purchase', 'initial') and unit_cost is not null;

-- =============================================================================
-- margenes_erosionados — los productos que ya no dejan lo que deberían.
--
-- Ordenados por PLATA POR MES, no por porcentaje: un chicle con 5% de margen que
-- vende 2 unidades importa mucho menos que la gaseosa con 18% que vende 300. El
-- kiosquero tiene que ver primero lo que le mueve la aguja.
-- =============================================================================
--
-- Va partida en dos a propósito: el CÁLCULO no verifica quién pregunta, y el
-- control de acceso vive en la función que expone. El cron de avisos corre con
-- service_role y sin usuario — no hay `auth.uid()` que valga— así que necesita
-- entrar por una puerta que no dependa de una sesión. Duplicar la consulta para
-- eso sería garantizar que las dos versiones se separen con el tiempo.
create or replace function public.margenes_erosionados_core(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_settings public.store_settings;
  v_min      numeric;
  v_redondeo numeric;
  v_productos jsonb;
begin
  select * into v_settings from public.store_settings where store_id = p_store_id;
  v_min      := coalesce(v_settings.min_margin_pct, 25);
  v_redondeo := coalesce(v_settings.reprice_rounding, 50);

  with base as (
    select
      p.id, p.name, p.emoji, p.color,
      p.price,
      p.cost as costo_hoy,
      p.price_updated_at,
      -- Margen de HOY: precio contra lo que sale reponerlo ahora.
      round((p.price - p.cost) / nullif(p.price, 0) * 100, 1) as margen_hoy,
      /* Costo vigente cuando el dueño fijó este precio.

         Si NUNCA lo tocó (`price_updated_at` null), el costo de referencia es el
         de la PRIMERA compra, no el de la última: ese precio se puso cuando el
         producto entró y no se movió más. Tomar la última compra daría
         "costo_original = costo_hoy" y la erosión sería invisible justo en los
         productos que más la sufren — los que nadie remarcó nunca. */
      case
        when p.price_updated_at is null then (
          select l.unit_cost from public.stock_ledger l
           where l.product_id = p.id and l.reason in ('purchase','initial')
             and l.unit_cost is not null
           order by l.created_at asc limit 1
        )
        else (
          select l.unit_cost from public.stock_ledger l
           where l.product_id = p.id and l.reason in ('purchase','initial')
             and l.unit_cost is not null
             and l.created_at <= p.price_updated_at
           order by l.created_at desc limit 1
        )
      end as costo_original,
      -- Cuánto se movió en el último mes: define si esto importa o es anecdótico.
      coalesce((
        select sum(i.qty)
          from public.sale_items i
          join public.sales s on s.id = i.sale_id
         where i.product_id = p.id
           and s.store_id = p_store_id
           and s.status = 'completed'
           and s.sold_at >= now() - interval '30 days'   -- cota dura de fecha
      ), 0) as unidades_30d
    from public.products p
   where p.store_id = p_store_id
     and p.status = 'active'
     and p.cost is not null
     and p.cost > 0
     and p.price > 0
  ),
  calculado as (
    select b.*,
      round((b.price - b.costo_original) / nullif(b.price, 0) * 100, 1) as margen_original,
      -- Objetivo: recuperar el margen que él mismo eligió. Si ese margen era más
      -- bajo que su mínimo (o no lo podemos saber), usamos el mínimo.
      greatest(
        coalesce(round((b.price - b.costo_original) / nullif(b.price, 0) * 100, 1), v_min),
        v_min
      ) as objetivo
    from base b
  ),
  sugerido as (
    select c.*,
      public.round_price(c.costo_hoy / nullif(1 - c.objetivo / 100, 0), v_redondeo) as precio_sugerido
    from calculado c
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.plata_por_mes desc, x.margen_hoy), '[]'::jsonb)
    into v_productos
  from (
    select
      s.id, s.name, s.emoji, s.color,
      s.price          as precio,
      s.costo_hoy,
      s.margen_hoy,
      s.costo_original,
      s.margen_original,
      s.unidades_30d,
      s.precio_sugerido,
      s.price_updated_at as precio_desde,
      -- Lo que deja de entrar por mes por no haber remarcado. Con ventas en 0 da
      -- 0: el producto aparece igual, pero al final de la lista.
      round(greatest(s.precio_sugerido - s.price, 0) * s.unidades_30d, 2) as plata_por_mes
    from sugerido s
   where s.margen_hoy < v_min
      -- También el que cayó MUY por debajo de su propio margen, aunque siga
      -- arriba del mínimo: perder 20 puntos es una señal aunque quede en 30%.
      or (s.margen_original is not null and s.margen_hoy < s.margen_original - 10)
   limit 100
  ) x;

  return jsonb_build_object(
    'min_margen', v_min,
    'redondeo', v_redondeo,
    'productos', v_productos,
    'total_por_mes', (
      select coalesce(sum((p->>'plata_por_mes')::numeric), 0)
        from jsonb_array_elements(v_productos) p
    )
  );
end;
$$;

-- =============================================================================
-- aplicar_precio — remarcar UN producto al precio sugerido.
--
-- El remarcado masivo por % ya existe (005), pero acá el ajuste es distinto en
-- cada producto: cada uno perdió margen a su ritmo. Un +15% global dejaría a unos
-- cortos y a otros caros.
-- =============================================================================
create or replace function public.aplicar_precio(
  p_store_id uuid,
  p_product_id uuid,
  p_precio numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_actual numeric;
begin
  v_member := public.rpc_member(p_store_id);
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select price into v_actual from public.products
   where id = p_product_id and store_id = p_store_id;
  if not found then
    raise exception 'product_not_found';
  end if;

  if p_precio is null or p_precio <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Cota de cordura, igual que bulk_reprice: un precio 10 veces mayor es un dedo
  -- que se fue de más, no una decisión comercial.
  if p_precio > v_actual * 5 then
    raise exception 'price_too_high';
  end if;

  update public.products
     set price = p_precio,
         price_updated_at = now()
   where id = p_product_id and store_id = p_store_id;
end;
$$;

-- Puerta pública: exige ser del negocio y tener permiso de ver costos.
create or replace function public.margenes_erosionados(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  -- El margen es información de costos: el empleado no la ve.
  if not (v_member.role = 'owner' or v_member.can_see_costs) then
    raise exception 'not_allowed';
  end if;

  return public.margenes_erosionados_core(p_store_id);
end;
$$;

grant execute on function public.margenes_erosionados(uuid) to authenticated;

/* El core hay que REVOCARLO, no basta con no otorgarlo: Postgres da EXECUTE a
   PUBLIC por defecto en toda función nueva. Sin este revoke, un cajero sin
   permiso de ver costos llama al core directamente y lee el costo y el margen de
   todo el catálogo — salteando por completo el control de la puerta pública.
   Verificado: antes de esta línea, devolvía los datos. */
revoke execute on function public.margenes_erosionados_core(uuid) from public;
grant  execute on function public.margenes_erosionados_core(uuid) to service_role;
grant execute on function public.aplicar_precio(uuid, uuid, numeric) to authenticated;
