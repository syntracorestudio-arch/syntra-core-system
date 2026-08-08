-- ===========================================================================
-- 048 · Promociones Fase 2 — precio por cantidad ("2 x $1.000")
--
-- Plan firme: docs/promociones-fase2-analisis.md. Decisiones del owner
-- (2026-08-08): semántica POR GRUPOS ("2 x $1.000" llevando 3 = $1.600, la
-- 3ra a lista) · una promo viva por producto de CUALQUIER tipo · el motor de
-- sugerencias no toca las promos de cantidad.
--
-- La decisión técnica que sostiene todo: `promo_price` sigue siendo POR
-- UNIDAD dentro del grupo (2 x $1.000 => min_qty 2, promo_price 500). Así
-- `line_total = unit_price * qty` queda exacto SIEMPRE y el gate del split
-- (tolerancia 0,01) nunca ve un centavo de deriva. La división exacta del
-- precio de grupo la exige el alta; acá no hay fracciones posibles.
--
-- Aditiva: una columna + recrea register_sale (045), las 3 RPCs de catálogo
-- (046) y create_promo/promos_listado/promos_carteles/promos_sugeridas (047).
-- ===========================================================================

alter table public.promos
  add column if not exists min_qty int not null default 1
  check (min_qty between 1 and 24);

-- La firma de create_promo cambia (gana p_min_qty): sin el drop quedaría una
-- sobrecarga de 9 argumentos conviviendo con la de 10 y toda llamada por
-- nombre se volvería ambigua.
drop function if exists public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean);


create or replace function public.create_promo(
  p_store_id      uuid,
  p_product_id    uuid,
  p_promo_price   numeric,
  p_starts_on     date,
  p_ends_on       date,
  p_expiry_id     uuid    default null,
  p_origin        text    default 'manual',
  p_below_cost_ok boolean default false,
  p_reemplazar    boolean default false,
  p_min_qty       int     default 1
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

  -- 048 - promo de cantidad: min_qty unidades al unitario p_promo_price.
  -- El precio de GRUPO lo divide la UI (exige division exacta); aca solo se
  -- valida el rango. 24 = un pack grande de kiosco; mas que eso es venta
  -- mayorista, otra feature.
  if p_min_qty is null or p_min_qty < 1 or p_min_qty > 24 then
    raise exception 'invalid_qty';
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
                             origin, below_cost_ok, created_by, min_qty)
  values (p_store_id, p_product_id, p_promo_price,
          -- El precio de lista se hereda de la promo reemplazada: si no, el
          -- segundo escalón congelaría como "lista" el precio ya rebajado y el
          -- tachado del POS mostraría una rebaja más chica de la que hubo.
          coalesce(v_vieja.list_price, v_product.price),
          v_product.cost, p_starts_on, p_ends_on, p_expiry_id,
          p_origin, coalesce(p_below_cost_ok, false), v_member.id, p_min_qty)
  returning * into v_promo;

  return jsonb_build_object(
    'promo_id',           v_promo.id,
    'replaced_promo_id',  v_repl,
    'estado',             case when v_promo.starts_on > v_hoy
                               then 'programada' else 'activa' end
  );
end;
$$;

revoke execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean, int) from public;
grant  execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean, int) to authenticated;

-- ---------------------------------------------------------------------------
-- register_sale — cuerpo de 045 con el SPLIT DE LÍNEA de 048 (bloques
-- marcados 048 inline). Todo lo demás idéntico: fingerprint, idempotencia,
-- lock ordenado, fiado, append-only, override manual que gana.
-- ---------------------------------------------------------------------------
create or replace function public.register_sale(
  p_store_id        uuid,
  p_items           jsonb,
  p_payment_method  text,
  p_idempotency_key text,
  p_client_id       uuid default null,
  p_paid            boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member      public.members;
  v_settings    public.store_settings;
  v_sale        public.sales;
  v_existing    public.sales;
  v_item        jsonb;
  v_product     public.products;
  v_client      public.clients;
  v_product_ids uuid[] := '{}';
  v_qty         numeric(12,3);
  v_unit_price  numeric(12,2);
  v_total       numeric(12,2) := 0;
  v_negative    jsonb := '[]'::jsonb;
  v_balance     numeric(12,2);
  v_over_limit  boolean := false;
  v_is_free     boolean;
  v_fingerprint text;
  v_promo       public.promos;      -- 045
  v_promo_id    uuid;               -- 045
  v_list_price  numeric(12,2);      -- 045
  v_qty_promo   numeric(12,3);      -- 048
  v_qty_lista   numeric(12,3);      -- 048
  v_line_total  numeric(12,2);      -- 048
begin
  v_member := public.rpc_member(p_store_id);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  -- Huella del carrito (H1): estable e independiente del orden + medio + cliente.
  select md5(
           coalesce(string_agg(
             coalesce(i->>'product_id', 'libre') || ':' ||
             coalesce(i->>'qty', '1') || ':' ||
             coalesce(i->>'unit_price', i->>'free_amount', ''),
             '|' order by coalesce(i->>'product_id', ''),
                          coalesce(i->>'free_amount', ''),
                          coalesce(i->>'unit_price', ''),
                          coalesce(i->>'qty', '')
           ), '')
           || '#' || p_payment_method || '#' || coalesce(p_client_id::text, '')
         )
    into v_fingerprint
    from jsonb_array_elements(p_items) i;

  -- Idempotencia atada al carrito (H1): replay del mismo carrito ok; key reusada
  -- para otro carrito ⇒ error, nunca éxito silencioso.
  select * into v_existing from public.sales
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.cart_fingerprint is not null
       and v_existing.cart_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_key_reused';
    end if;
    return jsonb_build_object(
      'sale_id', v_existing.id, 'total', v_existing.total,
      'replayed', true, 'over_limit', false, 'negative_stock', '[]'::jsonb
    );
  end if;

  if p_payment_method not in ('cash','qr','card','transfer','account','split') then
    raise exception 'invalid_payment_method';
  end if;

  if p_payment_method = 'account' then
    if not (v_member.role = 'owner' or v_member.can_sell_on_credit) then
      raise exception 'not_allowed';
    end if;
    if p_client_id is null then
      raise exception 'client_required';
    end if;
    select * into v_client from public.clients
     where id = p_client_id and store_id = p_store_id;
    if not found then
      raise exception 'client_not_found';
    end if;
  end if;

  select * into v_settings from public.store_settings where store_id = p_store_id;

  -- Lockeo de productos ORDENADO POR ID (anti-deadlock).
  select coalesce(array_agg(distinct (i->>'product_id')::uuid), '{}')
    into v_product_ids
    from jsonb_array_elements(p_items) i
   where i->>'product_id' is not null;

  if array_length(v_product_ids, 1) > 0 then
    perform 1 from public.products
     where id = any(v_product_ids) order by id for update;
  end if;

  insert into public.sales (store_id, member_id, client_id, total, payment_method,
                            idempotency_key, cart_fingerprint)
  values (p_store_id, v_member.id,
          case when p_payment_method = 'account' then p_client_id else null end,
          0, p_payment_method, p_idempotency_key, v_fingerprint)
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_is_free := (v_item->>'product_id') is null;
    v_qty := coalesce((v_item->>'qty')::numeric, 1);

    if v_qty <= 0 then
      raise exception 'invalid_qty';
    end if;

    if v_is_free then
      v_unit_price := (v_item->>'free_amount')::numeric;
      if v_unit_price is null or v_unit_price <= 0 then
        raise exception 'invalid_amount';
      end if;

      -- Una línea de monto libre no tiene producto: nunca lleva promo.
      insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                     qty, unit_price, unit_cost, line_total)
      values (v_sale.id, p_store_id, null,
              coalesce(nullif(v_item->>'name',''), 'Venta rápida'),
              v_qty, v_unit_price, null, v_unit_price * v_qty);
    else
      select * into v_product from public.products
       where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
      if not found then
        raise exception 'product_not_found';
      end if;
      -- M4: un cobro YA PAGADO registra aunque el producto esté archivado.
      if v_product.status <> 'active' and not p_paid then
        raise exception 'product_archived';
      end if;

      v_promo_id   := null;   -- 045
      v_list_price := null;   -- 045
      v_qty_promo  := 0;      -- 048
      v_qty_lista  := v_qty;  -- 048

      if (v_item->>'unit_price') is not null then
        if not (v_member.role = 'owner' or v_member.can_apply_discount) then
          raise exception 'not_allowed';
        end if;
        v_unit_price := (v_item->>'unit_price')::numeric;
        if v_unit_price < 0 then
          raise exception 'invalid_amount';
        end if;
      else
        -- 045 · acá y en ningún otro lado se decide el precio de promo.
        v_promo := public.promo_vigente(p_store_id, v_product.id);
        if v_promo.id is not null then
          -- 048 · SEMÁNTICA POR GRUPOS (decisión del owner): "2 x $1.000"
          -- llevando 3 = $1.600 — sólo los grupos COMPLETOS van al precio de
          -- promo, el resto a lista. promo_price es POR UNIDAD dentro del
          -- grupo, así que cada fila queda exacta (unit_price · qty, sin
          -- fracciones) y el gate del split nunca ve un centavo de deriva.
          -- min_qty = 1 degenera en la promo simple de siempre.
          v_qty_promo := floor(v_qty / v_promo.min_qty) * v_promo.min_qty;
          v_qty_lista := v_qty - v_qty_promo;
          if v_qty_promo > 0 then
            v_promo_id   := v_promo.id;
            v_list_price := v_product.price;
            v_unit_price := v_promo.promo_price;
          else
            -- qty < min_qty: no se llegó al umbral — TODO a lista, sin promo.
            v_unit_price := v_product.price;
          end if;
        else
          v_unit_price := v_product.price;
        end if;
      end if;

      -- 048 · una línea del carrito puede volverse DOS filas: las unidades en
      -- promo (con promo_id + list_price) y el resto a lista (sin promo — el
      -- invariante promo_id ⟺ list_price se sostiene). El void devuelve stock
      -- por fila, así que cubre las dos sin tocarlo; la medición suma sólo la
      -- fila con promo_id, que es exactamente lo rebajado.
      v_line_total := 0;
      if v_promo_id is not null and v_qty_promo > 0 then
        insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                       qty, unit_price, unit_cost, line_total,
                                       promo_id, list_price)
        values (v_sale.id, p_store_id, v_product.id, v_product.name,
                v_qty_promo, v_promo.promo_price, v_product.cost,
                v_promo.promo_price * v_qty_promo,
                v_promo_id, v_list_price);
        v_line_total := v_line_total + v_promo.promo_price * v_qty_promo;
        if v_qty_lista > 0 then
          insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                         qty, unit_price, unit_cost, line_total)
          values (v_sale.id, p_store_id, v_product.id, v_product.name,
                  v_qty_lista, v_product.price, v_product.cost,
                  v_product.price * v_qty_lista);
          v_line_total := v_line_total + v_product.price * v_qty_lista;
        end if;
      else
        insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                       qty, unit_price, unit_cost, line_total,
                                       promo_id, list_price)
        values (v_sale.id, p_store_id, v_product.id, v_product.name,
                v_qty, v_unit_price, v_product.cost, v_unit_price * v_qty,
                null, null);
        v_line_total := v_unit_price * v_qty;
      end if;

      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       sale_id, created_by)
      values (p_store_id, v_product.id, -v_qty, 'sale', v_sale.id, v_member.id);
    end if;

    if v_is_free then
      v_total := v_total + (v_unit_price * v_qty);
    else
      v_total := v_total + v_line_total;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale.id returning * into v_sale;

  -- Stock negativo (informa; con allow_negative_stock=false rechaza... salvo que la
  -- plata YA haya entrado: un cobro pagado no se rechaza por stock — M4).
  if array_length(v_product_ids, 1) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('product_id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
      into v_negative
      from public.products
     where id = any(v_product_ids) and stock < 0;

    if not p_paid
       and coalesce(v_settings.allow_negative_stock, true) = false
       and jsonb_array_length(v_negative) > 0 then
      raise exception 'insufficient_stock';
    end if;
  end if;

  if p_payment_method = 'account' then
    insert into public.client_ledger (store_id, client_id, delta, reason, sale_id,
                                      created_by)
    values (p_store_id, p_client_id, -v_total, 'sale', v_sale.id, v_member.id);

    select coalesce(sum(delta), 0) into v_balance
      from public.client_ledger where client_id = p_client_id;

    v_over_limit := v_client.credit_limit is not null
                    and (-v_balance) > v_client.credit_limit;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'total', v_sale.total,
    'replayed', false,
    'over_limit', v_over_limit,
    'client_balance', v_balance,
    'negative_stock', v_negative
  );
end;
$$;

grant execute on function public.register_sale(uuid, jsonb, text, text, uuid, boolean) to authenticated;

create or replace function public.productos_buscar(
  p_store_id           uuid,
  p_q                  text default null,
  p_categoria          uuid default null,
  p_limit              int  default 50,
  p_offset             int  default 0,
  p_solo_sin_categoria boolean default false,
  p_solo_sin_control   boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit  int;
  v_offset int;
  v_q      text;
  v_desde  timestamptz := now() - interval '14 days';
  v_items  jsonb;
  v_total  int;
begin
  perform public.rpc_member(p_store_id);

  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_q      := nullif(btrim(coalesce(p_q, '')), '');

  with filtrados as (
    select p.id, p.name, p.emoji, p.color, p.price, p.cost, p.stock,
           p.low_stock_threshold, p.category_id, p.stock_confiable,
           c.name as category_name
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.store_id = p_store_id
       and p.status = 'active'
       and (case
              when p_solo_sin_categoria then p.category_id is null
              else (p_categoria is null or p.category_id = p_categoria)
            end)
       and (not p_solo_sin_control or not p.stock_confiable)
       and (
         v_q is null
         or public.unaccent_simple(p.name) like '%' || public.unaccent_simple(v_q) || '%'
         or exists (
           select 1 from public.product_barcodes b
            where b.store_id = p_store_id
              and b.product_id = p.id
              and b.barcode like v_q || '%'
         )
       )
  ),
  ritmo as (
    select i.product_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
       and i.product_id in (select id from filtrados)
     group by i.product_id
  ),
  pagina as (
    select f.*, coalesce(r.vendidas, 0) as vendidas_14d
      from filtrados f
      left join ritmo r on r.product_id = f.id
     order by coalesce(r.vendidas, 0) desc, f.name
     limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'emoji', p.emoji, 'color', p.color,
           -- 045 · precio EFECTIVO; list_price/promo_id sólo si hay promo.
           'price', case when coalesce((public.promo_vigente(p_store_id, p.id)).min_qty, 1) > 1
                         -- 048 - con promo de cantidad, a 1 unidad NO hay rebaja: el
                         -- precio expuesto es el de LISTA (un tachado seria mentira).
                         then p.price
                         else coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price) end,
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, p.id)).ends_on,
           'promo_min_qty', (public.promo_vigente(p_store_id, p.id)).min_qty,
           'promo_unit_price', (public.promo_vigente(p_store_id, p.id)).promo_price,
           'cost', p.cost, 'stock', p.stock,
           'low_stock_threshold', p.low_stock_threshold,
           'category_id', p.category_id, 'category_name', p.category_name,
           'stock_confiable', p.stock_confiable,
           'vendidas_14d', p.vendidas_14d,
           'vendidas_30d', coalesce((
             select sum(i.qty)
               from public.sale_items i
               join public.sales s on s.id = i.sale_id
              where s.store_id = p_store_id
                and s.status = 'completed'
                and s.sold_at >= now() - interval '30 days'
                and i.product_id = p.id
           ), 0)
         ) order by p.vendidas_14d desc, p.name), '[]'::jsonb),
         (select count(*) from filtrados)
    into v_items, v_total
    from pagina p;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

grant execute on function public.productos_buscar(uuid, text, uuid, int, int, boolean, boolean) to authenticated;

create or replace function public.producto_por_codigo(
  p_store_id uuid,
  p_codigo   text
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_codigo text;
  v_res    jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate de miembro → not_a_member

  v_codigo := nullif(btrim(coalesce(p_codigo, '')), '');
  if v_codigo is null then
    return null;
  end if;

  select jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'emoji', p.emoji,
           'color', p.color,
           -- 045 · el escaneo trae el precio de promo YA resuelto, siempre fresco.
           'price', case when coalesce((public.promo_vigente(p_store_id, p.id)).min_qty, 1) > 1
                         -- 048 - con promo de cantidad, a 1 unidad NO hay rebaja: el
                         -- precio expuesto es el de LISTA (un tachado seria mentira).
                         then p.price
                         else coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price) end,
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, p.id)).ends_on,
           'promo_min_qty', (public.promo_vigente(p_store_id, p.id)).min_qty,
           'promo_unit_price', (public.promo_vigente(p_store_id, p.id)).promo_price,
           'stock', p.stock,
           'stock_confiable', p.stock_confiable,
           'category_id', p.category_id,
           'category_name', c.name,
           'archivado', (p.status <> 'active'),
           'barcodes', coalesce(
             (select jsonb_agg(b2.barcode order by b2.barcode)
                from public.product_barcodes b2
               where b2.store_id = p_store_id and b2.product_id = p.id),
             '[]'::jsonb)
         )
    into v_res
    from public.product_barcodes b
    join public.products p
      on p.id = b.product_id and p.store_id = b.store_id
    left join public.categories c on c.id = p.category_id
   where b.store_id = p_store_id
     and b.barcode  = v_codigo;

  return v_res;   -- null si no hay match (la caja recién ahí ofrece alta rápida)
end;
$$;

grant execute on function public.producto_por_codigo(uuid, text) to authenticated;

create or replace function public.pos_destacados(p_store_id uuid, p_limit int default 24)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int;
  v_desde timestamptz := now() - interval '14 days';
  v_res   jsonb;
begin
  perform public.rpc_member(p_store_id);

  v_limit := least(greatest(coalesce(p_limit, 24), 1), 60);

  with ritmo as (
    select i.product_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
     group by i.product_id
  ),
  top as (
    select p.id, p.name, p.emoji, p.color, p.price, p.stock, p.stock_confiable,
           p.category_id, c.name as category_name,
           coalesce(r.vendidas, 0) as vendidas_14d
      from public.products p
      left join public.categories c on c.id = p.category_id
      left join ritmo r on r.product_id = p.id
     where p.store_id = p_store_id
       and p.status = 'active'
       -- Fallback para el kiosco nuevo: si no vendió nada todavía, al menos que
       -- los tiles muestren lo que tiene precio y stock.
       and (coalesce(r.vendidas, 0) > 0 or (p.price > 0 and p.stock > 0))
     order by coalesce(r.vendidas, 0) desc, p.name
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'emoji', t.emoji, 'color', t.color,
           -- 045 · el tile dice el precio que la caja va a cobrar.
           'price', case when coalesce((public.promo_vigente(p_store_id, t.id)).min_qty, 1) > 1
                         -- 048 - con promo de cantidad, a 1 unidad NO hay rebaja: el
                         -- precio expuesto es el de LISTA (un tachado seria mentira).
                         then t.price
                         else coalesce((public.promo_vigente(p_store_id, t.id)).promo_price, t.price) end,
           'list_price', (public.promo_vigente(p_store_id, t.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, t.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, t.id)).ends_on,
           'promo_min_qty', (public.promo_vigente(p_store_id, t.id)).min_qty,
           'promo_unit_price', (public.promo_vigente(p_store_id, t.id)).promo_price,
           'stock', t.stock,
           'stock_confiable', t.stock_confiable,
           'category_id', t.category_id, 'category_name', t.category_name,
           'vendidas_14d', t.vendidas_14d,
           'barcodes', coalesce(
             (select jsonb_agg(b.barcode order by b.barcode)
                from public.product_barcodes b
               where b.store_id = p_store_id and b.product_id = t.id),
             '[]'::jsonb)
         ) order by t.vendidas_14d desc, t.name), '[]'::jsonb)
    into v_res
    from top t;

  return v_res;
end;
$$;

grant execute on function public.pos_destacados(uuid, int) to authenticated;

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
           'min_qty', b.min_qty,
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
           'min_qty',   pr.min_qty,
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
       -- 048 - el motor NO toca promos de cantidad (decision del owner):
       -- nacen de pelear un precio, no de un vencimiento, y un re-escalon
       -- sobre un "2 x $1.000" exigiria comparar ritmos contra una rebaja
       -- condicional, matematica que el motor no tiene. Se excluyen enteras.
       and (pr.id is null or pr.min_qty = 1)
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
