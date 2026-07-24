-- =============================================================================
-- StockFlow — 019_asistente.sql  (tier "Asistente IA de negocio")
--
-- Prepara el add-on PAGO del asistente: dos columnas en `stores` y su reflejo en
-- la vista del panel de superadmin. NO trae todavía el motor de reporte ni el
-- email (eso es el PR2) — esto es solo el dato + el interruptor.
--
-- Va TODO junto y ADITIVO (dos ALTER + recreación de la vista). No se toca ninguna
-- migración vieja: 010 (donde nace `admin_stores` y `create_store`) ya está
-- aplicada y nunca se re-corre. La vista se re-crea acá agregando columnas AL FINAL
-- (único cambio que `create or replace view` permite sin dropear).
--
--   • vertical: el rubro del negocio. Hoy todo es kiosco, pero el asistente
--     generaliza a dietética/petshop ajustando UMBRALES y ETIQUETAS por rubro
--     (nunca las fórmulas). CHECK cerrado, default seguro 'kiosco' → los negocios
--     existentes quedan clasificados sin migrar dato.
--   • ai_assistant_enabled: el flag del add-on. Default false → nadie lo tiene
--     hasta que superadmin lo prende. Es la puerta del cron mensual (PR2) y el
--     registro de consentimiento del dueño a que su reporte se procese.
--
-- Gobierno del flag: lo maneja SOLO superadmin por service_role (patrón de
-- `cambiarEstado`). El dueño lo lee vía la policy `stores_select` (010) pero no
-- tiene action que lo escriba; si en el futuro aparece un update owner-facing de
-- `stores`, endurecer a nivel columna. Additivo: aplicar DESPUÉS de 018. Lo corre
-- el owner en el SQL Editor (hoy: Docker local).
-- =============================================================================

-- =============================================================================
-- 1. Columnas nuevas en stores — additivas, con default → cero backfill.
-- =============================================================================
alter table public.stores
  add column if not exists vertical text not null default 'kiosco'
    check (vertical in ('kiosco', 'dietetica', 'petshop', 'otro'));

alter table public.stores
  add column if not exists ai_assistant_enabled boolean not null default false;

-- =============================================================================
-- 2. Vista admin_stores — mismo cuerpo que 010 + las dos columnas nuevas AL FINAL.
--
-- Se re-emite el revoke/grant: `create or replace view` conserva los privilegios,
-- pero repetirlos es idempotente y deja el contrato explícito (la vista cruza
-- tenants a propósito y NO se otorga a `authenticated`).
-- =============================================================================
create or replace view public.admin_stores as
  select s.id, s.name, s.slug, s.status, s.created_at,
         (select count(*) from public.members m where m.store_id = s.id and m.status = 'active') as miembros,
         (select count(*) from public.products p where p.store_id = s.id and p.status = 'active') as productos,
         (select count(*) from public.sales v where v.store_id = s.id and v.status = 'completed') as ventas,
         (select max(v.sold_at) from public.sales v where v.store_id = s.id) as ultima_venta,
         (select m.display_name from public.members m
           where m.store_id = s.id and m.role = 'owner' and m.status = 'active' limit 1) as dueno,
         s.vertical,
         s.ai_assistant_enabled
    from public.stores s;

revoke all on public.admin_stores from authenticated, anon;
grant select on public.admin_stores to service_role;