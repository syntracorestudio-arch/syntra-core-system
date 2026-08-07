-- StockFlow — Migración 045: Promociones (PR1, backend)
--
-- Contrato congelado en `docs/rpc-contracts.md` → "Promociones (migración 045)".
-- Plan aprobado: `docs/promociones-plan.md`.
--
-- Una promo = precio rebajado con fecha de fin sobre UN producto, opcionalmente
-- atado a un vencimiento, que **la caja cobra sola**.
--
-- LA REGLA QUE ORDENA TODO: el precio de promo lo resuelve el SERVIDOR. El POS
-- nunca lo manda. No es estilo — un `unit_price` enviado por el cliente exige
-- `can_apply_discount` (027:180-187), así que si la promo viajara por ahí, TODO
-- empleado sin ese flag recibiría `not_allowed` al vender un producto en promo.
-- La promo y el descuento manual son cosas distintas y no comparten permiso.
--
-- Migración ADITIVA. No toca los invariantes de `register_sale` (locks,
-- negativos, idempotencia, fingerprint, append-only): sólo la resolución de
-- precio. Los números 030-033 quedan reservados para la rama parqueada
-- `feat/stockflow-split-dos-electronicas`.

-- ===========================================================================
-- 1 · La entidad
--
-- SIN columna `status`: el estado se DERIVA de las fechas. Eso es lo que cumple
-- "no zombie promos" SIN un cron — pasada `ends_on` la promo deja de existir
-- para la resolución de precio sin que nadie tenga que marcarla. `ended_at`
-- existe sólo para el fin ANTICIPADO.
-- ===========================================================================
create table if not exists public.promos (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id)   on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,

  promo_price   numeric(12,2) not null check (promo_price >= 0),
  list_price    numeric(12,2) not null check (list_price  >= 0),
  cost_at_start numeric(12,2)          check (cost_at_start >= 0),

  starts_on     date not null,
  ends_on       date not null,

  expiry_id     uuid references public.stock_expiries(id) on delete set null,
  origin        text not null default 'manual' check (origin in ('manual', 'sugerida')),
  below_cost_ok boolean not null default false,

  ended_at      timestamptz,
  ended_reason  text check (ended_reason in ('manual', 'vencimiento', 'reemplazo')),

  created_by    uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint promos_rango_valido  check (ends_on >= starts_on),
  constraint promos_es_rebaja     check (promo_price < list_price)
);

comment on table public.promos is
  'Precio rebajado con fecha de fin sobre un producto. El estado se deriva de las '
  'fechas (no hay columna status): pasada ends_on la promo deja de aplicar sola.';
comment on column public.promos.list_price is
  'products.price CONGELADO al crear la promo. Es el "antes" del tachado y la base '
  'para medir lo que la promo costó en margen.';
comment on column public.promos.ended_at is
  'Sólo para el fin ANTICIPADO. Una promo que simplemente venció tiene ended_at null.';

-- Índices: el primero sirve la resolución de precio (el camino caliente, se
-- consulta en cada tile/escaneo/venta); el segundo, el listado de la sección.
create index if not exists promos_vivas_idx
  on public.promos (store_id, product_id) where ended_at is null;
create index if not exists promos_fin_idx
  on public.promos (store_id, ends_on) where ended_at is null;
create index if not exists promos_expiry_idx
  on public.promos (expiry_id) where expiry_id is not null;

-- RLS: lectura para miembros del negocio; escritura SÓLO por RPC (deny-all
-- directo, mismo criterio que sale_payments en 027).
alter table public.promos enable row level security;
alter table public.promos force row level security;

drop policy if exists promos_select on public.promos;
create policy promos_select on public.promos
  for select using (store_id in (select public.auth_member_stores()));

-- La RLS decide QUÉ filas; el GRANT decide si hay acceso a la tabla. Hacen falta
-- los dos: sin este grant, la policy no alcanza y sale "permission denied".
grant select on public.promos to authenticated;
grant select, insert, update, delete on public.promos to service_role;
revoke insert, update, delete on public.promos from authenticated, anon;

-- ===========================================================================
-- 2 · sale_items: dónde queda registrado que la línea fue en promo
--
-- Hoy sale_items tiene unit_price, unit_cost y line_total y NADA MÁS: una línea
-- con promo es indistinguible de una con el precio cambiado. Sin estas dos
-- columnas la atribución no se puede computar, y agregarlas después no recupera
-- el histórico. Es barato ahora e imposible después.
--
-- No corrompe la analítica de producto: unit_price sigue siendo el precio
-- REALMENTE cobrado, así que facturación y margen no cambian de semántica.
-- ===========================================================================
alter table public.sale_items
  add column if not exists promo_id   uuid references public.promos(id) on delete set null,
  add column if not exists list_price numeric(12,2) check (list_price >= 0);

comment on column public.sale_items.list_price is
  'Precio de lista al momento de la venta. Sólo se llena cuando se aplicó una '
  'promo (promo_id not null ⟺ list_price not null).';

-- FK nueva ⇒ índice explícito: Postgres no lo crea solo (baseline de escala).
create index if not exists sale_items_promo_idx
  on public.sale_items (promo_id) where promo_id is not null;

-- ===========================================================================
-- 3 · La regla de precio, en UN solo lugar
--
-- `promo_vigente` es la única definición de "qué promo aplica hoy". Las cuatro
-- RPCs que exponen precio la consumen; el cliente no calcula nada.
-- ===========================================================================
create or replace function public.promo_vigente(p_store_id uuid, p_product_id uuid)
returns public.promos
language sql stable security definer set search_path = public as $$
  select *
    from public.promos
   where store_id   = p_store_id
     and product_id = p_product_id
     and ended_at is null
     and starts_on <= current_date
     and ends_on   >= current_date
   order by created_at desc
   limit 1;
$$;

create or replace function public.promo_precio(p_store_id uuid, p_product_id uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
           (public.promo_vigente(p_store_id, p_product_id)).promo_price,
           (select price from public.products
             where id = p_product_id and store_id = p_store_id)
         );
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto (ver 016) → revocar y dar explícito.
revoke execute on function public.promo_vigente(uuid, uuid) from public;
revoke execute on function public.promo_precio(uuid, uuid)  from public;
grant  execute on function public.promo_vigente(uuid, uuid) to authenticated;
grant  execute on function public.promo_precio(uuid, uuid)  to authenticated;

-- ===========================================================================
-- 4 · create_promo — owner-only
-- ===========================================================================
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
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  if p_origin not in ('manual', 'sugerida') then
    raise exception 'invalid_origin';
  end if;

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
     or p_starts_on < current_date then
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

  if p_expiry_id is not null
     and not exists (select 1 from public.stock_expiries
                      where id = p_expiry_id and store_id = p_store_id
                        and product_id = p_product_id) then
    raise exception 'expiry_not_found';
  end if;

  -- Una promo viva por producto. "Viva" = no terminada y con rango que se solapa.
  select * into v_vieja from public.promos
   where store_id   = p_store_id
     and product_id = p_product_id
     and ended_at is null
     and ends_on   >= current_date       -- las ya vencidas no estorban
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
  values (p_store_id, p_product_id, p_promo_price, v_product.price,
          v_product.cost, p_starts_on, p_ends_on, p_expiry_id,
          p_origin, coalesce(p_below_cost_ok, false), v_member.id)
  returning * into v_promo;

  return jsonb_build_object(
    'promo_id',           v_promo.id,
    'replaced_promo_id',  v_repl,
    'estado',             case when v_promo.starts_on > current_date
                               then 'programada' else 'activa' end
  );
end;
$$;

revoke execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean) from public;
grant  execute on function public.create_promo(uuid, uuid, numeric, date, date, uuid, text, boolean, boolean) to authenticated;

-- ===========================================================================
-- 5 · end_promo — owner-only, idempotente
--
-- Devuelve `vuelve_a` para que la UI pueda decir "Terminar · vuelve a $1.800":
-- sin ese dato el dueño no sabe qué está aceptando.
-- ===========================================================================
create or replace function public.end_promo(p_store_id uuid, p_promo_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_promo  public.promos;
  v_precio numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select * into v_promo from public.promos
   where id = p_promo_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'promo_not_found';
  end if;

  select price into v_precio from public.products where id = v_promo.product_id;

  if v_promo.ended_at is not null then
    return jsonb_build_object('ya_terminada', true, 'vuelve_a', v_precio);
  end if;

  update public.promos
     set ended_at = now(), ended_reason = 'manual'
   where id = p_promo_id;

  return jsonb_build_object('ya_terminada', false, 'vuelve_a', v_precio);
end;
$$;

revoke execute on function public.end_promo(uuid, uuid) from public;
grant  execute on function public.end_promo(uuid, uuid) to authenticated;

-- ===========================================================================
-- 6 · register_sale — copia literal de 027 con UN cambio
--
-- El cambio: la resolución de precio de 027:189 pasa por `promo_vigente()`, y
-- cuando hay promo se graban promo_id + list_price en sale_items.
--
-- Todo lo demás queda IDÉNTICO: fingerprint, idempotencia, lock ordenado por id,
-- chequeo de stock negativo, fiado, append-only. El override manual del owner
-- (`unit_price` con can_apply_discount) GANA sobre la promo y NO se registra
-- como promo: es un descuento del que decide una persona, no del sistema.
-- ===========================================================================
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
          v_unit_price := v_promo.promo_price;
          v_promo_id   := v_promo.id;
          v_list_price := v_product.price;
        else
          v_unit_price := v_product.price;
        end if;
      end if;

      insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                     qty, unit_price, unit_cost, line_total,
                                     promo_id, list_price)
      values (v_sale.id, p_store_id, v_product.id, v_product.name,
              v_qty, v_unit_price, v_product.cost, v_unit_price * v_qty,
              v_promo_id, v_list_price);

      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       sale_id, created_by)
      values (p_store_id, v_product.id, -v_qty, 'sale', v_sale.id, v_member.id);
    end if;

    v_total := v_total + (v_unit_price * v_qty);
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

-- ===========================================================================
-- 7 · resolve_expiry — cierra el agujero de máquina de estados
--
-- Sin esto: el dueño resuelve el vencimiento ("se vendió" / "tuve que tirarlo")
-- y la promo ligada SIGUE descontando sobre la mercadería nueva. Es una fuga de
-- margen que nadie encuentra nunca.
--
-- Cuerpo idéntico al de 008 + el cierre de la promo.
-- ===========================================================================
create or replace function public.resolve_expiry(
  p_store_id   uuid,
  p_expiry_id  uuid,
  p_resolution text,
  p_waste_qty  numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_exp    public.stock_expiries;
  v_qty    numeric(12,3);
  v_cost   numeric(12,2);
  v_promos int := 0;   -- 045
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;
  if p_resolution not in ('sold','wasted') then
    raise exception 'invalid_resolution';
  end if;

  select * into v_exp from public.stock_expiries
   where id = p_expiry_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'expiry_not_found';
  end if;

  if v_exp.resolved_at is not null then
    return jsonb_build_object('already_resolved', true);
  end if;

  if p_resolution = 'wasted' then
    v_qty := coalesce(p_waste_qty, v_exp.qty);
    if v_qty > 0 then
      select cost into v_cost from public.products where id = v_exp.product_id;
      insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                       note, created_by)
      values (p_store_id, v_exp.product_id, -v_qty, 'waste', v_cost,
              format('vencido %s', v_exp.expiry_date), v_member.id);
    end if;
  end if;

  update public.stock_expiries
     set resolved_at = now(), resolution = p_resolution
   where id = p_expiry_id;

  -- 045 · el vencimiento se resolvió ⇒ la promo que lo liquidaba ya no tiene
  -- razón de existir.
  with cerradas as (
    update public.promos
       set ended_at = now(), ended_reason = 'vencimiento'
     where store_id  = p_store_id
       and expiry_id = p_expiry_id
       and ended_at is null
    returning 1
  )
  select count(*) into v_promos from cerradas;

  return jsonb_build_object('already_resolved', false,
                            'resolution', p_resolution,
                            'promos_terminadas', v_promos);
end;
$$;

grant execute on function public.resolve_expiry(uuid, uuid, text, numeric) to authenticated;

-- ===========================================================================
-- 8 · Las tres RPCs de catálogo dicen el precio REAL
--
-- Si el tile/la búsqueda/el escaneo mostraran el precio de lista mientras la
-- caja cobra el de promo, el botón diría "Cobrar $1.800" y el ticket $1.200 — y
-- en una venta dividida sería `split_sum_mismatch` y venta caída.
--
-- Cuerpos idénticos a los de 038 + precio efectivo, list_price y promo_id.
-- ===========================================================================

-- 8.a · productos_buscar
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
           'price', coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price),
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
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

-- 8.b · producto_por_codigo (el camino normal del cajero: escanear)
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
           'price', coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price),
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
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

-- 8.c · pos_destacados (los 24 tiles curados)
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
           'price', coalesce((public.promo_vigente(p_store_id, t.id)).promo_price, t.price),
           'list_price', (public.promo_vigente(p_store_id, t.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, t.id)).id,
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

-- ===========================================================================
-- 9 · promos_listado — la sección
--
-- Terminadas ACOTADAS A 30 DÍAS (cota de fecha del baseline de escala: la tabla
-- crece para siempre y la UI sólo muestra lo reciente).
--
-- "Lo que te costó" se devuelve SIEMPRE, también en las promos que salieron
-- bien. Es lo único que impide que la sección sea propaganda de sí misma.
-- ===========================================================================
create or replace function public.promos_listado(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
  v_costos boolean;
  v_res    jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  v_costos := (v_member.role = 'owner' or v_member.can_see_costs);

  with base as (
    select pr.*,
           p.name  as product_name,
           p.emoji as product_emoji,
           p.price as precio_actual,
           case
             when pr.ended_at is not null or pr.ends_on < current_date then 'terminada'
             when pr.starts_on > current_date                          then 'programada'
             else 'activa'
           end as estado
      from public.promos pr
      join public.products p on p.id = pr.product_id
     where pr.store_id = p_store_id
       and (pr.ended_at is null
            or pr.ended_at >= now() - interval '30 days')
       and pr.ends_on >= current_date - interval '30 days'
  ),
  medido as (
    select b.id as promo_id,
           coalesce(sum(i.qty), 0)                                    as unidades,
           coalesce(sum((i.unit_price - i.unit_cost) * i.qty), 0)      as ganancia,
           coalesce(sum((i.list_price - i.unit_price) * i.qty), 0)     as costo_promo
      from base b
      left join public.sale_items i on i.promo_id = b.id
      left join public.sales s
             on s.id = i.sale_id and s.status = 'completed'
             and s.sold_at >= current_date - interval '90 days'
     group by b.id
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
           'dias_restantes', greatest(b.ends_on - current_date, 0),
           'origin', b.origin,
           'below_cost_ok', b.below_cost_ok,
           'expiry_id', b.expiry_id,
           'ended_at', b.ended_at,
           'ended_reason', b.ended_reason,
           'unidades', m.unidades,
           -- La plata sólo para quien puede ver costos.
           'ganancia_recuperada', case when v_costos then m.ganancia end,
           'costo_promo',         case when v_costos then m.costo_promo end
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

-- ===========================================================================
-- 10 · promos_sugeridas — el motor determinista (sin LLM, sin elasticidad)
--
-- La cuenta:
--   ritmo_actual    = vendidas 14d / 14
--   ritmo_necesario = stock / días_hasta_vencer
-- Si ritmo_actual >= ritmo_necesario NO se sugiere nada: se agota solo y
-- descontarlo sería regalar margen.
--
-- LA ESCALERA ES UNA TABLA DE POLÍTICA, NO UNA OPTIMIZACIÓN. El sistema PUEDE
-- calcular que al ritmo actual no se vende; NO PUEDE saber que con −30% sí. Por
-- eso devuelve `ritmo_necesario` — para que la UI diga "necesitás ~2,7 por día"
-- y nunca "vas a vender los 8". Esa línea separa una sugerencia de una promesa.
-- ===========================================================================
create or replace function public.promos_sugeridas(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member   public.members;
  v_settings public.store_settings;
  v_dias     int;
  v_res      jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  if not (v_member.role = 'owner' or v_member.can_see_costs) then
    raise exception 'not_allowed';
  end if;

  select * into v_settings from public.store_settings where store_id = p_store_id;
  -- Ventana: lo que la UI de Vencimientos realmente usa, no "todo".
  v_dias := greatest(coalesce(v_settings.expiry_warning_days, 7), 7) * 2;

  with candidatos as (
    select e.id as expiry_id, e.expiry_date, e.qty as lote_qty,
           (e.expiry_date - current_date) as dias,
           p.id as product_id, p.name, p.emoji, p.price, p.cost, p.stock
      from public.stock_expiries e
      join public.products p on p.id = e.product_id
     where e.store_id = p_store_id
       and e.resolved_at is null
       and e.expiry_date >= current_date
       and e.expiry_date <= current_date + v_dias
       and p.status = 'active'
       and p.stock  > 0
       and p.price  > 0
       -- Sin promo viva: no se sugiere sobre lo que ya está en promo.
       and not exists (
         select 1 from public.promos pr
          where pr.store_id = p_store_id and pr.product_id = p.id
            and pr.ended_at is null and pr.ends_on >= current_date
       )
  ),
  ritmo as (
    select i.product_id, sum(i.qty) / 14.0 as por_dia
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= now() - interval '14 days'
       and i.product_id in (select product_id from candidatos)
     group by i.product_id
  ),
  cuenta as (
    select c.*,
           coalesce(r.por_dia, 0)                       as ritmo_actual,
           c.stock::numeric / greatest(c.dias, 1)       as ritmo_necesario,
           -- Escalera por urgencia (política, no optimización).
           case
             when c.dias <= 1 then 0.50
             when c.dias <= 3 then 0.35
             when c.dias <= 7 then 0.25
             else                  0.15
           end                                          as pct
      from candidatos c
      left join ritmo r on r.product_id = c.product_id
  ),
  precios as (
    select q.*,
           -- Pisos, en orden: margen mínimo del negocio → costo → bajo costo
           -- SÓLO con opt-in explícito del owner (que acá no se asume).
           greatest(
             public.round_price(q.price * (1 - q.pct),
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
           'price', s.price,
           'cost', s.cost,
           'sugerido', s.sugerido,
           'pct', round(s.pct * 100),
           'ritmo_actual', round(s.ritmo_actual, 2),
           'ritmo_necesario', round(s.ritmo_necesario, 2),
           'margen_unitario', case when s.cost is not null then s.sugerido - s.cost end,
           'plata_en_riesgo', case when s.cost is not null then s.cost * s.stock end,
           -- Si el sugerido no baja del precio actual, no hay promo que ofrecer.
           'aplicable', (s.sugerido < s.price)
         ) order by s.dias, s.name), '[]'::jsonb)
    into v_res
    from precios s
   where s.sugerido < s.price;

  return v_res;
end;
$$;

revoke execute on function public.promos_sugeridas(uuid) from public;
grant  execute on function public.promos_sugeridas(uuid) to authenticated;
