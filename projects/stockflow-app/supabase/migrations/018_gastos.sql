-- =============================================================================
-- StockFlow — 018_gastos.sql  (feature Egresos)
--
-- Los gastos operativos —alquiler, luz, sueldos, impuestos— que separan el margen
-- bruto de la ganancia REAL. Sin esto, Reportes muestra el bruto como si fuera lo
-- que le queda al dueño: la mentira por exceso más cara del producto.
--
-- Va TODO junto y ADITIVO en esta migración (tabla + índices + RLS + 3 RPCs). En
-- particular `reportes_summary` (009) NO se toca: las migraciones viejas ya están
-- aplicadas y nunca se re-corren, así que editarlas no llega a la DB viva. El
-- reporte de gastos es una función APARTE (`reportes_expenses`), espejo exacto de
-- `reportes_medios` (017): la página de Reportes la llama en el mismo Promise.all.
--
-- Imputación por `incurred_on`, NO por `created_at`: es la fecha a la que el gasto
-- pertenece (igual que `sales.sold_at`). Cargás hoy el alquiler de marzo → pesa en
-- marzo. Los reportes bucketean por ahí.
--
-- Regla anti-doble-conteo (business-rules §11): el set de categorías es CERRADO por
-- CHECK y NO existe —ni puede crearse— 'merchandise'/'purchase'. El costo de la
-- mercadería ya impacta por el margen bruto (sale_items.unit_cost); cargarlo también
-- como gasto lo restaría dos veces. `expenses` es exclusivamente estructura operativa.
--
-- Visibilidad SOLO-DUEÑO de verdad: a diferencia de costo/margen (columna en filas
-- compartidas que solo se oculta en UI), `expenses` es una tabla entera sin caso de
-- uso del staff → se cierra por RLS owner-only. Staff del mismo store: 0 filas.
-- Cross-tenant: 0 filas. Toda escritura pasa por RPCs SECURITY DEFINER.
--
-- Contratos: docs/rpc-contracts.md (register_expense / void_expense /
-- reportes_expenses). Aplicar DESPUÉS de 017. Lo corre el owner en el SQL Editor.
-- =============================================================================

-- =============================================================================
-- 1. Tabla expenses — append-only, estilo header de `sales`.
-- =============================================================================
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  -- El CHECK ES la garantía anti-doble-conteo: sin 'merchandise'/'purchase' jamás.
  category     text not null check (category in
                 ('rent','utilities','salary','taxes','supplies','maintenance','other')),
  amount       numeric(12,2) not null check (amount > 0),
  incurred_on  date not null,                 -- fecha de imputación al período
  note         text,
  is_recurring boolean not null default false, -- solo informativo; jamás genera asientos
  status       text not null default 'active' check (status in ('active','voided')),
  voided_at    timestamptz,
  voided_by    uuid references public.members(id),
  void_reason  text,
  created_by   uuid not null references public.members(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- 2. Índices. El de reporte es PARCIAL sobre activos: todo reporte de gastos filtra
--    por rango + status='active'. Los de FK son de mantenimiento (baja de member):
--    el baseline pide índice en TODA FK — Postgres no los crea solo.
-- =============================================================================
create index expenses_store_incurred_idx on public.expenses (store_id, incurred_on)
  where status = 'active';
create index expenses_created_by_idx on public.expenses (created_by);
create index expenses_voided_by_idx  on public.expenses (voided_by) where voided_by is not null;

-- `updated_at` genérico (mismo trigger que stores/members/products/clients/settings).
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- 3. RLS — owner-only. SELECT gobernado por policy; CERO escritura (solo RPCs).
--    force: ni el owner de la tabla (postgres) se saltea la policy salvo por las
--    RPCs SECURITY DEFINER. El GRANT SELECT es imprescindible: sin privilegio de
--    tabla la policy ni se evalúa (dos capas, igual que 001 §11).
-- =============================================================================
alter table public.expenses enable row level security;
alter table public.expenses force  row level security;

create policy expenses_select_owner on public.expenses for select
  using (public.auth_has_role(store_id, array['owner']));
-- Sin policies de insert/update/delete a propósito: toda escritura pasa por
-- register_expense / void_expense (SECURITY DEFINER). No agregar acá.

-- Privilegios de tabla explícitos (no heredados de la plataforma).
grant select on public.expenses to authenticated;                       -- la RLS filtra a owner
grant select, insert, update, delete on public.expenses to service_role; -- server-side
-- Append-only duro: además de no dar el privilegio, lo revocamos (cinturón + tirante).
revoke update, delete on public.expenses from authenticated, anon;

-- =============================================================================
-- 4. register_expense — cargar un gasto operativo. Owner-only (patrón adjust_stock).
-- =============================================================================
create or replace function public.register_expense(
  p_store_id     uuid,
  p_category     text,
  p_amount       numeric,
  p_incurred_on  date,
  p_note         text default null,
  p_is_recurring boolean default false
) returns public.expenses
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_tz      text;
  v_today   date;
  v_expense public.expenses;
begin
  v_member := public.rpc_member(p_store_id);

  -- El staff nunca carga ni ve gastos (RLS owner-only + este chequeo).
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  -- Defensa en profundidad: además del CHECK de la tabla y del Zod client-side.
  if p_category not in ('rent','utilities','salary','taxes','supplies','maintenance','other') then
    raise exception 'invalid_category';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_today := (now() at time zone v_tz)::date;

  -- Ni futuro ni por debajo del piso de 24 meses (coherente con la cota de lectura).
  if p_incurred_on is null or p_incurred_on > v_today or p_incurred_on < v_today - 730 then
    raise exception 'invalid_date';
  end if;

  insert into public.expenses (store_id, category, amount, incurred_on, note,
                               is_recurring, created_by)
  values (p_store_id, p_category, p_amount, p_incurred_on, p_note,
          coalesce(p_is_recurring, false), v_member.id)
  returning * into v_expense;

  return v_expense;
end;
$$;

-- =============================================================================
-- 5. void_expense — anular. NUNCA borra ni edita monto/categoría/fecha: marca la
--    fila. Idempotente: anular dos veces devuelve lo mismo sin efectos.
-- =============================================================================
create or replace function public.void_expense(
  p_store_id   uuid,
  p_expense_id uuid,
  p_reason     text default null
) returns public.expenses
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_expense public.expenses;
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select * into v_expense from public.expenses
   where id = p_expense_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'expense_not_found';
  end if;

  -- Ya anulado → idempotente: devolver tal cual, sin cambios.
  if v_expense.status = 'voided' then
    return v_expense;
  end if;

  update public.expenses
     set status = 'voided', voided_at = now(), voided_by = v_member.id,
         void_reason = p_reason
   where id = v_expense.id
   returning * into v_expense;

  return v_expense;
end;
$$;

-- =============================================================================
-- 6. reportes_expenses — gastos del período para Reportes. ESPEJO de reportes_medios
--    (017): aparte, aditiva, con la misma cota dura de 24 meses. `net_profit` NO
--    sale de acá: lo computa la página (bruto − expenses) porque es dueña de las
--    reglas de degradación honesta (business-rules §11).
-- =============================================================================
create or replace function public.reportes_expenses(
  p_store_id uuid,
  p_from     date,
  p_to       date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
  v_tz       text;
  v_total    numeric(12,2);
  v_by_cat   jsonb;
  v_ever     boolean;
begin
  -- Owner-only, NO solo membresía: la función es SECURITY DEFINER (se saltea la
  -- RLS owner-only de `expenses`), así que sin este chequeo un staff podría
  -- llamarla directo y leer los agregados de gastos (sueldos, alquiler) que la
  -- tabla le oculta. Mismo gate que register_expense / void_expense.
  v_member := public.rpc_member(p_store_id);
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');

  -- Cota dura de lectura: 24 meses, igual que reportes_summary (009) / reportes_medios.
  p_from := greatest(p_from, (now() at time zone v_tz)::date - 730);

  -- Total activo del período. Imputado por incurred_on, NUNCA created_at.
  select coalesce(sum(amount), 0) into v_total
    from public.expenses
   where store_id = p_store_id and status = 'active'
     and incurred_on between p_from and p_to;

  -- Desglose por categoría, desc por total; solo categorías con gasto en el período.
  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'total', total)
           order by total desc), '[]'::jsonb)
    into v_by_cat
    from (
      select category, sum(amount) as total
        from public.expenses
       where store_id = p_store_id and status = 'active'
         and incurred_on between p_from and p_to
       group by category
    ) c;

  -- ¿Cargó gastos ALGUNA vez (cualquier fecha)? Decide "sin neto" vs "CTA cargá gastos".
  select exists (
    select 1 from public.expenses
     where store_id = p_store_id and status = 'active'
  ) into v_ever;

  return jsonb_build_object(
    'expenses', v_total,
    'expenses_by_category', v_by_cat,
    'expenses_loaded_ever', v_ever
  );
end;
$$;

-- =============================================================================
-- 7. Grants: las RPCs son la única puerta de escritura/lectura agregada de gastos.
--    La RLS owner-only + el chequeo de rol dentro de cada RPC hacen el filtro real.
-- =============================================================================
grant execute on function public.register_expense(uuid, text, numeric, date, text, boolean) to authenticated;
grant execute on function public.void_expense(uuid, uuid, text) to authenticated;
grant execute on function public.reportes_expenses(uuid, date, date) to authenticated;