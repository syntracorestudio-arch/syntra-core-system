-- ============================================================
-- SYNTRA CORE — Migración 0001: tabla de leads
-- Ejecutar en Supabase: SQL Editor → pegar → Run.
-- ============================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  email       text        not null,
  company     text,
  message     text        not null,
  source      text        not null default 'website',
  -- Estado para gestión comercial (escalable hacia un CRM)
  status      text        not null default 'new'
                check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  created_at  timestamptz not null default now()
);

-- Índices para consultas frecuentes (orden cronológico y filtrado por estado)
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx     on public.leads (status);

-- ============================================================
-- Row Level Security
-- RLS activo + SIN políticas públicas => ningún rol anónimo/autenticado
-- puede leer ni escribir. La inserción ocurre solo server-side con la
-- SERVICE ROLE KEY, que omite RLS de forma segura.
-- ============================================================
alter table public.leads enable row level security;

-- (Opcional) Lectura para usuarios internos cuando exista panel/CRM:
-- create policy "internal read" on public.leads
--   for select to authenticated using (true);
