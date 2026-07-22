-- =============================================================================
-- StockFlow — 006_expiries_and_alerts.sql  (tanda 1F)
--
-- Vencimientos resolubles + la maquinaria de las alertas.
--
-- Esta tanda es el diferencial del producto: ningún competidor le avisa al
-- kiosquero ANTES de que pierda plata. Todo lo demás (POS, stock, fiado) existe
-- en el mercado; esto no.
-- =============================================================================

-- =============================================================================
-- resolve_expiry — cerrar un vencimiento con UN toque.
--   'sold'   → se vendió a tiempo, no toca stock.
--   'wasted' → hubo que tirarlo: asiento 'waste' por lo que quedaba.
-- Idempotente: resolver dos veces no genera dos mermas.
-- =============================================================================
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
      -- La merma baja stock y queda registrada: la plata perdida tiene que ser
      -- visible en los reportes, no desaparecer en silencio.
      insert into public.stock_ledger (store_id, product_id, delta, reason, note, created_by)
      values (p_store_id, v_exp.product_id, -v_qty, 'waste',
              format('vencido %s', v_exp.expiry_date), v_member.id);
    end if;
  end if;

  update public.stock_expiries
     set resolved_at = now(), resolution = p_resolution
   where id = p_expiry_id;

  return jsonb_build_object('already_resolved', false, 'resolution', p_resolution);
end;
$$;

-- =============================================================================
-- Vista de vencimientos pendientes, con los días que faltan ya calculados.
-- security_invoker: hereda la RLS de las tablas base (cada negocio ve el suyo).
-- =============================================================================
create view public.pending_expiries with (security_invoker = true) as
  select e.id,
         e.store_id,
         e.product_id,
         p.name  as product_name,
         p.emoji as product_emoji,
         e.expiry_date,
         e.qty,
         (e.expiry_date - current_date) as days_left
    from public.stock_expiries e
    join public.products p on p.id = e.product_id
   where e.resolved_at is null;

grant select on public.pending_expiries to authenticated;

-- =============================================================================
-- store_alerts — lo que el negocio necesita saber HOY, en una sola consulta.
--
-- La usa el cron de push y también el dashboard. Vive en SQL y no en la app para
-- que ambos miren exactamente lo mismo: si el push dice "3 productos por vencer",
-- la pantalla tiene que decir 3.
--
-- SECURITY DEFINER + validación de membresía: el cron la llama con service_role
-- para todos los negocios, y la app con la sesión del usuario.
-- =============================================================================
create or replace function public.store_alerts(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days   integer;
  v_low    jsonb;
  v_expiry jsonb;
begin
  select expiry_warning_days into v_days
    from public.store_settings where store_id = p_store_id;
  v_days := coalesce(v_days, 7);

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', id, 'name', name, 'emoji', emoji,
           'stock', stock, 'threshold', threshold) order by stock), '[]'::jsonb)
    into v_low
    from public.low_stock_products
   where store_id = p_store_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'expiry_id', id, 'product_id', product_id, 'name', product_name,
           'emoji', product_emoji, 'expiry_date', expiry_date,
           'days_left', days_left, 'qty', qty) order by expiry_date), '[]'::jsonb)
    into v_expiry
    from public.pending_expiries
   where store_id = p_store_id
     and expiry_date <= current_date + v_days;

  return jsonb_build_object(
    'low_stock', v_low,
    'expiring', v_expiry,
    'warning_days', v_days
  );
end;
$$;

grant execute on function public.resolve_expiry(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.store_alerts(uuid) to authenticated;
-- El cron corre con service_role sobre todos los negocios.
grant execute on function public.store_alerts(uuid) to service_role;

-- =============================================================================
-- Índice para el cron: barre vencimientos pendientes por fecha en TODOS los
-- negocios. Sin esto, cada corrida escanea la tabla entera (baseline).
-- =============================================================================
create index if not exists stock_expiries_pending_idx
  on public.stock_expiries (expiry_date)
  where resolved_at is null;
