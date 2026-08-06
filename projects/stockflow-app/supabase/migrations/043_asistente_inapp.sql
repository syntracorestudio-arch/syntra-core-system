-- =============================================================================
-- StockFlow — 043_asistente_inapp.sql  (Asistente IA · Fase 3, página in-app)
--
-- El análisis deja de vivir solo en el email del 1°: pasa a GUARDARSE y a
-- mostrarse dentro de la app. Esta tabla es la memoria del asistente — cada
-- análisis generado (por el cron mensual, el semanal o el botón "Actualizar")
-- queda acá con su costo en tokens.
--
-- La decisión de costo que esta tabla hace ESTRUCTURAL (no una promesa):
--
--   · El análisis se sirve GUARDADO. Generar uno nuevo es la excepción.
--   · El índice único parcial (store_id, dia) sobre origen='manual' impone
--     "una actualización manual por día y por negocio" A NIVEL BASE — dos
--     requests simultáneos no pueden colarse: uno gana el insert, el otro
--     recibe 23505. El claim se inserta ANTES de llamar al modelo, así el
--     perdedor ni siquiera gasta la llamada.
--   · Cota estructural resultante: ≤31 manuales + ~5 semanales + 1 mensual
--     por negocio/mes. Con Haiku (~USD 0,006 por análisis) el peor caso es
--     ~USD 0,22 por negocio por mes. No hace falta un contador de presupuesto:
--     la aritmética la garantiza el unique.
--
-- `estado` existe por el claim: 'generando' reserva el turno del día, 'ok' lo
-- confirma con el análisis adentro, 'fallido' lo libera (el índice parcial lo
-- excluye, así un fallo del modelo no te bloquea hasta mañana).
--
-- Additiva. La corre el owner en el SQL Editor (local: psql del contenedor).
-- =============================================================================

create table if not exists public.asistente_analisis (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  -- Quién lo generó: el email del 1°, el cron de los lunes o el botón del dueño.
  origen      text not null check (origen in ('mensual', 'semanal', 'manual')),
  -- Día del negocio (en SU zona) en que se generó. Es la clave de la cota diaria.
  dia         date not null,
  -- Rango analizado (mes cerrado para 'mensual'; mes-en-curso para el resto).
  period_from date not null,
  period_to   date not null,
  estado      text not null default 'generando' check (estado in ('generando', 'ok', 'fallido')),
  -- El JSON del análisis verificado (Analisis de analisis.ts). Null mientras genera.
  analisis    jsonb,
  modelo      text,
  tokens_in   int,
  tokens_out  int,
  created_at  timestamptz not null default now(),
  -- Un análisis 'ok' sin contenido sería una fila mentirosa.
  constraint analisis_ok_con_contenido check (estado <> 'ok' or analisis is not null)
);

-- La cota dura: UNA actualización manual por día y por negocio. Los estados
-- 'generando' y 'ok' ocupan el turno; 'fallido' lo libera para reintentar.
create unique index if not exists asistente_analisis_manual_por_dia
  on public.asistente_analisis (store_id, dia)
  where origen = 'manual' and estado in ('generando', 'ok');

-- La página lee "los últimos N": índice que sirve exactamente esa query.
create index if not exists asistente_analisis_historial
  on public.asistente_analisis (store_id, created_at desc);

alter table public.asistente_analisis enable row level security;
alter table public.asistente_analisis force  row level security;

-- El dueño LEE los análisis de su negocio. Escribir, nunca desde el browser:
-- toda escritura pasa por server actions/crons con service_role, donde viven el
-- claim, la llamada al modelo y la verificación.
create policy asistente_analisis_select_owner on public.asistente_analisis for select
  using (public.auth_has_role(store_id, array['owner']));

grant select on public.asistente_analisis to authenticated;                        -- la RLS filtra a owner
grant select, insert, update, delete on public.asistente_analisis to service_role; -- server-side
revoke insert, update, delete on public.asistente_analisis from authenticated, anon;