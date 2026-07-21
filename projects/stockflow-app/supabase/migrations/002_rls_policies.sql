-- =============================================================================
-- StockFlow — 002_rls_policies.sql  (tanda 1B)
-- Helpers anti-recursión + enable/force RLS + policies por rol.
-- Aplicar DESPUÉS de 001_initial_schema.sql. Lo corre el owner en el SQL Editor.
--
-- DECISIÓN CENTRAL (docs/database.md §7): las tablas transaccionales
-- (sales, sale_items, stock_ledger, client_ledger) tienen SELECT y NADA MÁS.
-- Toda escritura pasa por las RPCs SECURITY DEFINER de la tanda 1C. Nadie
-- inserta un asiento suelto: es la garantía de integridad más fuerte del diseño
-- y evita el churn de policies correctivas que StudioFlow sufrió en su 007.
--
-- Las funciones SECURITY DEFINER son propiedad de `postgres` (BYPASSRLS en
-- Supabase) → operan por encima de RLS de forma controlada.
-- =============================================================================

-- ---------- Helpers (SECURITY DEFINER, search_path fijo → anti-recursión/hijack) ----------

create or replace function public.auth_member_stores()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select store_id from public.members
  where profile_id = auth.uid() and status = 'active'
$$;

create or replace function public.auth_has_role(p_store uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where profile_id = auth.uid()
      and store_id   = p_store
      and status     = 'active'
      and role       = any(p_roles)
  )
$$;

create or replace function public.auth_my_member_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where profile_id = auth.uid() and status = 'active'
$$;

-- El owner siempre puede; al staff hay que habilitarlo con el flag.
-- Ej.: auth_can(store, 'can_receive_stock')
create or replace function public.auth_can(p_store uuid, p_flag text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  execute format(
    'select exists (select 1 from public.members
       where profile_id = auth.uid() and store_id = $1 and status = ''active''
         and (role = ''owner'' or %I))', p_flag
  ) into v_ok using p_store;
  return coalesce(v_ok, false);
end;
$$;

-- ---------- enable + force RLS en TODAS las tablas ----------

alter table public.stores             enable row level security;
alter table public.profiles           enable row level security;
alter table public.members            enable row level security;
alter table public.store_settings     enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_barcodes   enable row level security;
alter table public.clients            enable row level security;
alter table public.sales              enable row level security;
alter table public.sale_items         enable row level security;
alter table public.stock_ledger       enable row level security;
alter table public.client_ledger      enable row level security;
alter table public.stock_expiries     enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_limits        enable row level security;

alter table public.stores             force row level security;
alter table public.profiles           force row level security;
alter table public.members            force row level security;
alter table public.store_settings     force row level security;
alter table public.categories         force row level security;
alter table public.products           force row level security;
alter table public.product_barcodes   force row level security;
alter table public.clients            force row level security;
alter table public.sales              force row level security;
alter table public.sale_items         force row level security;
alter table public.stock_ledger       force row level security;
alter table public.client_ledger      force row level security;
alter table public.stock_expiries     force row level security;
alter table public.notifications      force row level security;
alter table public.push_subscriptions force row level security;
alter table public.rate_limits        force row level security;

-- ============================ stores ============================
create policy stores_select on public.stores for select
  using (id in (select public.auth_member_stores()));
create policy stores_update_owner on public.stores for update
  using      (public.auth_has_role(id, array['owner']))
  with check (public.auth_has_role(id, array['owner']));

-- ============================ profiles ============================
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid());
-- El dueño ve los profiles de la gente de SU negocio (pantalla de equipo).
create policy profiles_select_team on public.profiles for select
  using (exists (
    select 1 from public.members m
    where m.profile_id = public.profiles.id
      and m.store_id in (select public.auth_member_stores())
      and public.auth_has_role(m.store_id, array['owner'])
  ));
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================ members ============================
create policy members_select on public.members for select
  using (store_id in (select public.auth_member_stores()));
create policy members_write_owner on public.members for all
  using      (public.auth_has_role(store_id, array['owner']))
  with check (public.auth_has_role(store_id, array['owner']));

-- ============================ store_settings ============================
create policy settings_select on public.store_settings for select
  using (store_id in (select public.auth_member_stores()));
create policy settings_write_owner on public.store_settings for all
  using      (public.auth_has_role(store_id, array['owner']))
  with check (public.auth_has_role(store_id, array['owner']));

-- ============================ categories ============================
create policy categories_select on public.categories for select
  using (store_id in (select public.auth_member_stores()));
create policy categories_write_owner on public.categories for all
  using      (public.auth_has_role(store_id, array['owner']))
  with check (public.auth_has_role(store_id, array['owner']));

-- ============================ products ============================
-- Todo el equipo LEE el catálogo (el POS lo necesita).
-- Editar precios/costos y archivar: solo el dueño.
-- Alta rápida desde la caja: el staff con permiso de recibir mercadería puede
-- INSERTAR (journey "escaneás algo que no existe", PRD §4c) pero no UPDATE.
create policy products_select on public.products for select
  using (store_id in (select public.auth_member_stores()));
-- El `and (category_id is null or ...)` evita colgar el producto de una categoría
-- de OTRO negocio: la membresía sola no alcanza para cerrar el cruce de tenants.
create policy products_insert on public.products for insert
  with check (
    public.auth_can(store_id, 'can_receive_stock')
    and (
      category_id is null
      or exists (select 1 from public.categories c
                  where c.id = category_id and c.store_id = products.store_id)
    )
  );
create policy products_update_owner on public.products for update
  using      (public.auth_has_role(store_id, array['owner']))
  with check (public.auth_has_role(store_id, array['owner']));
create policy products_delete_owner on public.products for delete
  using (public.auth_has_role(store_id, array['owner']));

-- ============================ product_barcodes ============================
create policy barcodes_select on public.product_barcodes for select
  using (store_id in (select public.auth_member_stores()));
-- Mismo cierre de tenant que products_insert: el código tiene que pegarse a un
-- producto DEL MISMO negocio.
create policy barcodes_insert on public.product_barcodes for insert
  with check (
    public.auth_can(store_id, 'can_receive_stock')
    and exists (select 1 from public.products p
                 where p.id = product_id and p.store_id = product_barcodes.store_id)
  );
create policy barcodes_delete_owner on public.product_barcodes for delete
  using (public.auth_has_role(store_id, array['owner']));

-- ============================ clients ============================
-- El staff con permiso de fiar crea el cliente en el mostrador (2 campos).
create policy clients_select on public.clients for select
  using (store_id in (select public.auth_member_stores()));
create policy clients_insert on public.clients for insert
  with check (public.auth_can(store_id, 'can_sell_on_credit'));
create policy clients_update on public.clients for update
  using      (public.auth_can(store_id, 'can_sell_on_credit'))
  with check (public.auth_can(store_id, 'can_sell_on_credit'));

-- ============================ TRANSACCIONALES: solo lectura ============================
-- Sin insert/update/delete a propósito. La escritura es exclusiva de las RPCs
-- de la tanda 1C (register_sale, register_purchase, void_sale, adjust_stock,
-- register_client_payment). No agregar policies de escritura acá.

create policy sales_select on public.sales for select
  using (store_id in (select public.auth_member_stores()));

create policy sale_items_select on public.sale_items for select
  using (store_id in (select public.auth_member_stores()));

create policy stock_ledger_select on public.stock_ledger for select
  using (store_id in (select public.auth_member_stores()));

create policy client_ledger_select on public.client_ledger for select
  using (store_id in (select public.auth_member_stores()));

-- ============================ stock_expiries ============================
-- Lectura para todos; alta con permiso de recibir mercadería.
-- Resolver ("se vendió" / "tirar") va por RPC porque puede generar un asiento waste.
create policy expiries_select on public.stock_expiries for select
  using (store_id in (select public.auth_member_stores()));
create policy expiries_insert on public.stock_expiries for insert
  with check (
    public.auth_can(store_id, 'can_receive_stock')
    and exists (select 1 from public.products p
                 where p.id = product_id and p.store_id = stock_expiries.store_id)
  );

-- ============================ notifications ============================
-- Dirigidas al member; las de member_id null son avisos del negocio (las ve el dueño).
create policy notifications_select on public.notifications for select
  using (
    store_id in (select public.auth_member_stores())
    and (
      member_id in (select public.auth_my_member_ids())
      or (member_id is null and public.auth_has_role(store_id, array['owner']))
    )
  );
-- El dueño también marca como leídos los avisos del negocio (member_id null):
-- si no, ve notificaciones que no puede sacarse de encima nunca.
create policy notifications_update_own on public.notifications for update
  using (
    member_id in (select public.auth_my_member_ids())
    or (member_id is null and public.auth_has_role(store_id, array['owner']))
  )
  with check (
    member_id in (select public.auth_my_member_ids())
    or (member_id is null and public.auth_has_role(store_id, array['owner']))
  );

-- ============================ push_subscriptions ============================
-- Cada uno administra las suscripciones de SUS dispositivos. El envío es server-side
-- con el admin client (bypassa RLS).
create policy push_select_own on public.push_subscriptions for select
  using (member_id in (select public.auth_my_member_ids()));
create policy push_insert_own on public.push_subscriptions for insert
  with check (member_id in (select public.auth_my_member_ids()));
-- UPDATE es imprescindible: `endpoint` es UNIQUE y el flujo normal de Web Push es
-- un upsert (el browser rota la subscription y hay que refrescar claves/last_seen).
-- Sin esta policy el upsert falla por RLS y sin upsert falla por la unique.
create policy push_update_own on public.push_subscriptions for update
  using      (member_id in (select public.auth_my_member_ids()))
  with check (member_id in (select public.auth_my_member_ids()));
create policy push_delete_own on public.push_subscriptions for delete
  using (member_id in (select public.auth_my_member_ids()));

-- ============================ rate_limits ============================
-- Sin policies: RLS forzada y ninguna policy ⇒ inaccesible para authenticated/anon.
-- Solo la RPC check_rate_limit (SECURITY DEFINER) y el service_role la tocan.

-- ============================ NOTA: alta de negocios ============================
-- `stores` NO tiene policy de INSERT, y `members_write_owner` exige ser ya owner del
-- store → un usuario nuevo no puede crearse un negocio solo (chicken-and-egg).
-- Es DELIBERADO: el onboarding es un acto de SYNTRA (service_role / RPC de alta con
-- código de invitación), no un self-service abierto. La RPC `create_store` llega en
-- la tanda 1C junto con el resto; hasta entonces los negocios se dan de alta por seed.
