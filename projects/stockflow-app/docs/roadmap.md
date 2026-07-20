# StockFlow — Roadmap por fases

> **Estado:** Fase 0 en curso. Cada fase: objetivo, entregables, riesgos, QA y qué
> queda fuera. **1 PR por tanda**; migraciones `NNN_*.sql` numeradas que el owner
> aplica en el SQL Editor (numeración final se fija al abrir cada tanda). Trabajo
> visual = variantes vivas + OK del owner en su navegador antes de commit.
> `syntra-scale-security-baseline` es **normativa en todas las tandas** — no es una
> tanda, es el estándar de cada una.

---

## Fase 0 — Docs *(en curso)*

- **Objetivo:** congelar scope, reglas, modelo de datos, contratos RPC y material
  comercial ANTES de todo código.
- **Entregables:** `README.md`, `docs/{prd,business-rules,database,rpc-contracts,
  roadmap}.md`, `docs/commercial/{pitch,demo-script}.md`.
- **QA:** revisión y aprobación del owner. **Queda fuera:** todo código, SQL, deps,
  Supabase, env.
- **Pendientes del owner al cierre de esta fase:** referencias de paleta dark ·
  crear Supabase project + envs · precio del SaaS · cliente piloto · (Fase 0/1E)
  definir fuente del catálogo EAN argentino.

## Fase 1 — MVP por tandas

- **1A — Scaffold.** Next + TS estricto + Tailwind v4 + shadcn; auth (@supabase/ssr,
  clon estructura `src/lib/supabase/` de StudioFlow); middleware con matcher
  completo y `getUser()` que degrada; **headers de seguridad en `next.config.ts`
  desde el día 1** (canónico StudioFlow); shells por rol (`/pos`, `/admin`,
  `/super`) con ruteo post-login; **tema dark white-label** (tokens en globals.css,
  acento por negocio en runtime, clon `accent.ts`) sobre las referencias del owner.
  QA: tsc/lint/build + gate visual del shell (1920 + 390). Fuera: toda tabla de
  negocio.
- **1B — Schema + RLS.** `001_initial_schema` (TODO el modelo de `database.md`:
  tablas + **índices completos** + vistas + triggers + `rate_limits` +
  `check_rate_limit`) + `002_rls_policies` (helpers + FORCE en todo) + seed mínimo
  2 tenants (UUIDs fijos). QA: **tests de aislamiento cross-tenant** y de
  append-only (update/delete a ledgers debe fallar). Fuera: RPCs de negocio.
- **1C 🔴 — RPCs de venta y fiado.** `003_sale_rpcs` (register_sale,
  register_purchase, void_sale, adjust_stock) + `004_fiado_rpcs`
  (register_client_payment) según `rpc-contracts.md` congelado. QA (gate duro):
  concurrencia (N ventas simultáneas mismo producto), idempotencia bajo carrera,
  void de venta fiada, modo estricto de stock. **La tanda más riesgosa: errores acá
  corrompen stock.**
- **1D 🔴 — POS.** Pantalla de venta: grilla rápidos (emoji+color) + búsqueda +
  carrito + cobro 1 tap + monto libre + alta rápida (<10 s) + **escáner** (USB
  keyboard-wedge + cámara `BarcodeDetector` con fallback zxing). QA: venta <5 taps,
  AC <15 s / <300 ms por ítem, 360/390px primero, gate visual vivo. Riesgo: UX de
  velocidad real y compatibilidad del detector en Android.
- **1E — Catálogo e ingreso.** CRUD productos/categorías/códigos, ingreso de
  mercadería (con costo y vencimiento opcional), **remarcado masivo por %**
  (RPC `bulk_reprice` + preview). QA: margen sugerido correcto, permisos staff.
- **1F 🟡 — Vencimientos + Web Push.** Vista "Por vencer" + `resolve_expiry`;
  migración `push_subscriptions`; `sw.js` con handler push + deep-links (clon
  StudioFlow 029 + fixes badge/urgency #126-128); cron route
  `/api/cron/alerts` (digest 09:00 ART, `CRON_SECRET`) + push inmediato post-venta
  con dedupe. QA: push real en Android (canal/sonido, checklist StudioFlow).
- **1G — Fiado.** Clientes, ficha con ledger visible, cobrar (parcial), límite con
  aviso. QA: saldos derivados exactos contra fixtures.
- **1H — Dashboard del dueño.** Las 7 señales del PRD; **toda query con cota de
  fecha + Promise.all** (baseline). QA: números validados contra seed; carga <2 s.
- **1I — Demo + load test (gate pre-cliente).** Seed rico "Kiosco El Trébol"
  (`demo-script.md`) + **load test** (k6: p95 y errores de register_sale bajo
  concurrencia; carrera del invariante: N ventas simultáneas del último ítem con
  modo estricto ⇒ exactamente stock). Sin números, no hay primer cliente.

## Fase 2 — Cobro y profundidad

- MercadoPago por-tenant (clon completo StudioFlow 015–017: OAuth/token cifrado
  AES-256-GCM, webhook HMAC + idempotencia doble + binding monto/tenant, QR
  dinámico en caja) · reportes avanzados (márgenes por categoría, mermas, curva
  horaria) · cash_sessions reales (apertura/arqueo) si hay demanda · "precio sin
  tocar hace X días" · recordatorio de fiado por WhatsApp (n8n:
  automation-architect → n8n-workflow-engineer → reliability-guard) · exploración
  AFIP (los hooks ya existen). **Queda fuera:** granel, offline.

## Fase 3+ — Verticales y escala

- Dietética (granel/pesables/balanza, `sale_unit` + attrs ya preparados) · pet shop
  · cola offline de ventas (solo si la instrumentación de fallos de red de Fase 1
  lo justifica con datos) · multi-sucursal · portal del cliente de fiado · panel
  superadmin completo + billing SaaS (patrón StudioFlow Fase 5).

## Dependencias

1B ← 1A · 1C ← 1B (y `rpc-contracts.md` congelado) · 1D ← 1C · 1E-1H ← 1C ·
1F ← referencias push StudioFlow · 1I ← todas · Fase 2 ← MVP operando en un
negocio real.
