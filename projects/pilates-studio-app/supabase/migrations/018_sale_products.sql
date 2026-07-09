-- =============================================================================
-- StudioFlow — 018_sale_products.sql  (Fase 3, Slice B)
-- Productos vendibles que NO son packs de crédito: membresía, abono y clase suelta.
-- Los packs siguen en `passes` (crédito-based). Esta tabla da PRECIO + duración a los
-- conceptos que hoy el admin cargaba a mano, para poder venderlos ONLINE (checkout MP)
-- y aplicarlos vía apply_online_payment (016).
--   · membership/abono → crean una `memberships` con validez = duration_days.
--   · drop_in          → 1 crédito por 30 días (la duración se ignora, la fija el RPC).
-- Mismo patrón de RLS que `passes`: lectura por tenant, escritura admin/recepción.
-- Aditiva y no destructiva.
-- =============================================================================

create table if not exists public.sale_products (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null references public.studios(id) on delete cascade,
  name          text not null,
  concept       text not null check (concept in ('membership','abono','drop_in')),
  price         numeric(12,2) not null check (price >= 0),
  duration_days int check (duration_days is null or duration_days > 0), -- null/ignorado en drop_in
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index sale_products_studio_active_idx on public.sale_products (studio_id, active);

alter table public.sale_products enable row level security;
alter table public.sale_products force row level security;

create policy sale_products_select on public.sale_products for select
  using (studio_id in (select public.auth_member_studios()));
create policy sale_products_write_admin on public.sale_products for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- Fin 018_sale_products.sql
