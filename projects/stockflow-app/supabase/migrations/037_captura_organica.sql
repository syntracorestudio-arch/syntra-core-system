-- =============================================================================
-- 037 · CAPTURA ORGÁNICA (onboarding F1a · PR A)
--
-- El kiosco sin datos previos (docs/onboarding-catalogo-plan.md §H) no importa
-- nada: onboardea VENDIENDO. Cada código que la caja no conoce se da de alta en
-- el acto. Esta migración pone las piezas de datos para que eso no ensucie nada:
--
--   1. `store_settings.margen_default_pct` — el margen con el que la caja
--      PROPONE el precio a partir del costo. El cajero confirma, no tipea:
--      un precio mal tipeado se cobra mal en cada venta futura.
--   2. `products.stock_confiable` — ¿sabemos cuánto hay en la góndola? Un
--      producto dado de alta en el mostrador arranca en 0 y vende hacia
--      negativo: sus alertas de stock MENTIRÍAN. Este flag las va a apagar
--      SOLO para esos productos (el consumo llega en 038; acá solo se declara
--      y se mantiene correcto).
--      DEFAULT TRUE y así quedan TODOS los productos existentes: ningún negocio
--      real pierde una alerta que hoy recibe.
--   3. `crear_producto_rapido()` — alta de mostrador atómica: producto + código
--      + (opcional) asiento inicial CON su costo, en una sola transacción.
--   4. `adjust_stock()` acepta el costo del asiento `initial` (antes lo omitía:
--      la carga inicial era invisible para el radar de costos y para "comprado").
--   5. Trigger de graduación: cuando a un producto le entra stock real
--      (ingreso, conteo o ajuste), pasa a confiable solo.
--
-- Aditiva. No toca ventas, cobros ni el corte del día.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Margen por defecto del negocio (uno global; por categoría es más adelante)
--
-- OJO, son dos ajustes distintos y conviene no confundirlos:
--   · `min_margin_pct`  (015) = umbral de ALERTA: por debajo, el margen se
--     considera erosionado y avisamos.
--   · `margen_default_pct` (acá) = el margen con el que PROPONEMOS el precio
--     al dar de alta en la caja.
-- Se expresa sobre el PRECIO (igual que el margen que muestra la app en cada
-- ficha), no sobre el costo: precio = costo / (1 - margen/100).
-- ---------------------------------------------------------------------------
alter table public.store_settings
  add column if not exists margen_default_pct numeric(5,2) not null default 35
    check (margen_default_pct >= 0 and margen_default_pct < 95);

comment on column public.store_settings.margen_default_pct is
  'Margen (sobre el precio) con el que la caja propone el precio de venta al dar de alta. Distinto de min_margin_pct, que es el umbral de alerta por erosión.';

-- ---------------------------------------------------------------------------
-- 2 · ¿Sabemos cuánto hay en la góndola?
--
-- `false` = el producto entró vendiendo y nadie contó: su stock es un número sin
-- respaldo. NO significa "producto malo" — se vende igual; lo que no vale son
-- sus señales de stock.
--
-- DEFAULT TRUE es deliberado y es la condición dura de esta migración: todo lo
-- que ya existe conserva sus alertas exactamente como hoy.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists stock_confiable boolean not null default true;

comment on column public.products.stock_confiable is
  'false = alta de mostrador sin conteo: el stock no tiene baseline y sus alertas mentirían. Gradúa solo con el primer asiento de stock real (ver trigger graduar_stock_confiable).';

-- Índice parcial: las consultas del modo puesta en marcha buscan justamente la
-- minoría no confiable. Parcial y chico — no un índice sobre todo el catálogo.
create index if not exists products_no_confiables_idx
  on public.products (store_id)
  where stock_confiable = false;

-- El cajero no puede tocar este flag a mano: lo maneja el sistema (RPC + trigger).
-- `products` ya tiene grant de UPDATE por columna (001); no sumamos esta.

-- ---------------------------------------------------------------------------
-- 3 · Graduación automática
--
-- Gradúa solo lo que implica haber MIRADO la góndola:
--   · `initial` → alta contando ("tengo 12")
--   · `adjust`  → conteo o corrección del dueño
--
-- `purchase` NO gradúa, y es la sutileza que decide si esto sirve o miente:
-- recibir 30 unidades es un DELTA sobre una base desconocida. Producto que nace
-- en 0, vende hasta −8 y recibe +30 queda en 22 para el sistema, mientras la
-- góndola tiene "lo que ya había + 22". El corrimiento es permanente y las
-- alertas seguirían mintiendo, solo que con otro número (docs §H.5). Lo que sí
-- gradúa es declarar el TOTAL en góndola al recibir — un ajuste-a-total, que
-- llega en F1b.
--
-- Las ventas y las mermas tampoco gradúan: restar de un número desconocido no
-- lo vuelve conocido.
-- ---------------------------------------------------------------------------
create or replace function public.graduar_stock_confiable()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason in ('initial', 'adjust') then
    update public.products
       set stock_confiable = true
     where id = new.product_id
       and stock_confiable = false;
  end if;
  return new;
end $$;

drop trigger if exists graduar_stock_confiable_trg on public.stock_ledger;
create trigger graduar_stock_confiable_trg
  after insert on public.stock_ledger
  for each row execute function public.graduar_stock_confiable();

-- ---------------------------------------------------------------------------
-- 4 · adjust_stock: el asiento `initial` ahora puede llevar su costo
--
-- Copia EXACTA de la definición vigente (008) con dos cambios quirúrgicos:
-- el parámetro opcional `p_unit_cost` y su uso en la rama `initial`. Los
-- llamadores existentes (5 argumentos) siguen funcionando: el nuevo tiene default.
-- ---------------------------------------------------------------------------
drop function if exists public.adjust_stock(uuid, uuid, numeric, text, text);

create or replace function public.adjust_stock(
  p_store_id   uuid,
  p_product_id uuid,
  p_delta      numeric,
  p_reason     text,
  p_note       text default null,
  p_unit_cost  numeric default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_stock  numeric(12,3);
  v_cost   numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_reason not in ('adjust','waste','initial') then
    raise exception 'invalid_reason';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta';
  end if;
  if p_reason = 'waste' and p_delta > 0 then
    raise exception 'invalid_delta';
  end if;

  select cost into v_cost from public.products
   where id = p_product_id and store_id = p_store_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  -- El costo se congela en las mermas (es lo que perdiste ese día) y ahora
  -- también en la carga inicial: sin él, la mercadería con la que arrancás no
  -- existe para el radar de costos ni para "comprado" en reportes.
  insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                   note, created_by)
  values (p_store_id, p_product_id, p_delta, p_reason,
          case
            when p_reason = 'waste' then v_cost
            when p_reason = 'initial' then coalesce(p_unit_cost, v_cost)
            else null
          end,
          p_note, v_member.id);

  select stock into v_stock from public.products where id = p_product_id;
  return v_stock;
end $$;

revoke execute on function public.adjust_stock(uuid, uuid, numeric, text, text, numeric) from public;
grant execute on function public.adjust_stock(uuid, uuid, numeric, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 5 · Alta de mostrador, atómica
--
-- Todo lo que hoy hace la server action en 4 llamadas sueltas (dedup, producto,
-- código, y NADA de stock) en una transacción, más el asiento inicial opcional.
-- Si el conteo falla, no queda un producto a medio nacer.
--
-- `p_cantidad` es OPCIONAL a propósito: en el mostrador hay un cliente esperando
-- y contar la góndola no es parte del trabajo. Sin cantidad: producto vendible,
-- `stock_confiable = false`. Con cantidad: baseline + producto confiable.
--
-- El aporte al catálogo público sigue en la capa de la app (necesita distinguir
-- vincular-EAN de aportar-nombre, y no debe abortar el alta si falla).
-- ---------------------------------------------------------------------------
create or replace function public.crear_producto_rapido(
  p_store_id    uuid,
  p_nombre      text,
  p_precio      numeric,
  p_costo       numeric default null,
  p_barcode     text default null,
  p_category_id uuid default null,
  p_cantidad    numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_nombre  text := nullif(btrim(p_nombre), '');
  v_code    text := nullif(btrim(p_barcode), '');
  v_existe  uuid;
  v_id      uuid;
  v_conf    boolean;
  v_prod    public.products;
begin
  v_member := public.rpc_member(p_store_id);

  -- Mismo permiso que recibir mercadería: quien puede meter stock puede dar de
  -- alta lo que está vendiendo. No es exclusivo del dueño — en el mostrador
  -- casi nunca está el dueño.
  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;

  if v_nombre is null then
    raise exception 'nombre_requerido';
  end if;
  if p_precio is null or p_precio < 0 then
    raise exception 'precio_invalido';
  end if;
  if p_cantidad is not null and p_cantidad < 0 then
    raise exception 'cantidad_invalida';
  end if;

  -- Anti-duplicado: si el código ya es de un producto del negocio, ESE es el
  -- producto. Duplicar parte el stock en dos fichas y ninguna refleja la góndola.
  if v_code is not null then
    select product_id into v_existe from public.product_barcodes
     where store_id = p_store_id and barcode = v_code;
    if v_existe is not null then
      select * into v_prod from public.products where id = v_existe;
      return jsonb_build_object(
        'id', v_prod.id, 'name', v_prod.name, 'price', v_prod.price, 'existing', true);
    end if;
  end if;

  -- La categoría tiene que ser del negocio (el FK no distingue inquilinos).
  if p_category_id is not null
     and not exists (select 1 from public.categories
                      where id = p_category_id and store_id = p_store_id) then
    raise exception 'categoria_invalida';
  end if;

  v_conf := p_cantidad is not null and p_cantidad > 0;

  -- `price_updated_at` se sella acá: el precio se acaba de decidir. Sin esto,
  -- todo el catálogo orgánico nacía marcado "precio viejo" (data_health).
  insert into public.products (store_id, name, price, cost, emoji, category_id,
                               stock_confiable, price_updated_at)
  values (p_store_id, v_nombre, p_precio, p_costo, '📦', p_category_id, v_conf, now())
  returning id into v_id;

  if v_code is not null then
    insert into public.product_barcodes (store_id, product_id, barcode)
    values (p_store_id, v_id, v_code);
  end if;

  -- Contó la góndola: queda el baseline, con su costo, y el producto gradúa.
  if v_conf then
    insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                     note, created_by)
    values (p_store_id, v_id, p_cantidad, 'initial', p_costo,
            'alta en la caja', v_member.id);
  end if;

  return jsonb_build_object(
    'id', v_id, 'name', v_nombre, 'price', p_precio, 'existing', false,
    'stock_confiable', v_conf);
end $$;

revoke execute on function public.crear_producto_rapido(uuid, text, numeric, numeric, text, uuid, numeric) from public;
grant execute on function public.crear_producto_rapido(uuid, text, numeric, numeric, text, uuid, numeric) to authenticated;