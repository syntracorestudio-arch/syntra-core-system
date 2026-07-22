-- =============================================================================
-- StockFlow — 005_bulk_reprice.sql  (tanda 1E)
--
-- Remarcado masivo por porcentaje. En Argentina remarcar es tarea SEMANAL: sin
-- esto el kiosquero toca producto por producto, abandona a la tercera semana y
-- los precios (y con ellos el margen) dejan de ser ciertos.
--
-- Va por RPC y no por UPDATE desde la app por dos razones: es una operación
-- masiva que debe ser atómica (o se remarca todo o nada), y queremos que quede
-- auditada — quién remarcó, cuánto y sobre qué.
-- =============================================================================

-- Redondeo "comercial": hacia arriba al múltiplo más cercano. Un kiosco no
-- vende a $1.847; vende a $1.850. El múltiplo lo configura cada negocio.
create or replace function public.round_price(p_value numeric, p_step numeric)
returns numeric
language sql immutable as $$
  select case
    when p_step is null or p_step <= 0 then round(p_value, 2)
    else ceil(p_value / p_step) * p_step
  end;
$$;

-- =============================================================================
-- bulk_reprice — sube (o baja) precios en bloque.
--   p_category_id null = todo el catálogo activo.
--   p_pct: +12.5 = +12,5%. Negativo permitido (liquidación).
--   p_rounding null = el redondeo configurado del negocio.
-- Devuelve cuántos productos cambiaron.
-- =============================================================================
create or replace function public.bulk_reprice(
  p_store_id    uuid,
  p_pct         numeric,
  p_category_id uuid default null,
  p_rounding    numeric default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_member   public.members;
  v_step     numeric(12,2);
  v_count    integer;
  v_scope    text;
begin
  v_member := public.rpc_member(p_store_id);

  -- Los precios son del dueño. Un empleado con descuentos habilitados puede
  -- ajustar UNA venta, no la lista entera.
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  if p_pct is null or p_pct = 0 then
    raise exception 'invalid_pct';
  end if;
  -- Cota de cordura: un 0 de más en el formulario no puede multiplicar por 10
  -- los precios de todo el kiosco.
  if p_pct < -90 or p_pct > 500 then
    raise exception 'pct_out_of_range';
  end if;

  if p_category_id is not null then
    perform 1 from public.categories
     where id = p_category_id and store_id = p_store_id;
    if not found then
      raise exception 'category_not_found';
    end if;
  end if;

  select coalesce(p_rounding, reprice_rounding, 0) into v_step
    from public.store_settings where store_id = p_store_id;

  update public.products
     set price = public.round_price(price * (1 + p_pct / 100.0), v_step),
         price_updated_at = now()
   where store_id = p_store_id
     and status = 'active'
     and (p_category_id is null or category_id = p_category_id)
     and price > 0;   -- un producto en $0 no se remarca por porcentaje

  get diagnostics v_count = row_count;

  -- Auditoría: el dueño tiene que poder ver qué pasó con sus precios.
  if v_count > 0 then
    select case when p_category_id is null then 'todo el catálogo'
                else (select name from public.categories where id = p_category_id)
           end
      into v_scope;

    insert into public.notifications (store_id, member_id, type, title, body)
    values (p_store_id, v_member.id, 'reprice',
            format('Remarcaste %s producto%s', v_count, case when v_count = 1 then '' else 's' end),
            format('%s%s%% sobre %s', case when p_pct > 0 then '+' else '' end,
                   trim(to_char(p_pct, 'FM999990.9')), v_scope));
  end if;

  return v_count;
end;
$$;

grant execute on function public.round_price(numeric, numeric) to authenticated;
grant execute on function public.bulk_reprice(uuid, numeric, uuid, numeric) to authenticated;
