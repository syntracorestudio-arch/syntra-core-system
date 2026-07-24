# Plan — StockFlow: tier opcional "Asistente IA de negocio"

> PLAN ONLY: sin código, sin migraciones. Próxima migración disponible = **019**.
> Verificado contra el código real por auditorías de exploración (2026-07-24).

## Contexto (por qué)

StockFlow se vende a distintos rubros (kiosco, dietética, pet shop…). Queremos **dos
planes**: con-asistente y sin-asistente. El asistente analiza la operación del negocio,
detecta dolores y oportunidades de ganancia, y **el 1° de cada mes le manda al dueño por
email un reporte analítico completo**. Es un **add-on pago**, activable **por negocio desde
el panel superadmin** (checkbox al crear y flippable después para sumarlo a un negocio
existente).

**Hallazgo que define el plan:** casi todo el análisis YA está computado. StockFlow tiene
7 RPCs analíticas SECURITY DEFINER que devuelven `jsonb` **agregado, acotado a 24 meses y
con el día cortado en la zona del negocio**. El asistente **consume esos JSON**, no
recalcula ni toca tablas base. Lo único greenfield es: transporte de email (no existe),
un campo `vertical` en `stores` (no existe) y el toggle por negocio (no existe).

---

## 1. Auditoría de reuso — qué análisis YA existe

Todas las RPCs son SECURITY DEFINER, gate `rpc_member`/owner, día en tz del negocio,
**piso duro de 730 días**. El asistente las llama y ensambla el reporte con sus JSON.

| Capacidad | La provee hoy | Qué devuelve (reuso directo) |
| --- | --- | --- |
| **P&L del período + delta vs período anterior** | `reportes_summary(store,from,to)` `009` | `money`: sold, tickets, units, profit, margin_pct, cost_coverage, purchased, shelf_value, prev_sold, vs_prev_pct |
| **Top movers por unidades y por $ de ganancia** | `reportes_summary` | `top_units[8]`, `top_profit[8]` (con margin_pct), `by_category`, `by_weekday`, `by_slot` (4 franjas) |
| **Stock muerto / plata congelada** | `reportes_summary` | `dead_stock` (sin venta 30d, valuado a costo), `shelf_value` |
| **Merma / desperdicio $** | `reportes_summary` | `waste` (a costo, top items) |
| **Fiado en la calle + aging (≥30d) + top deudores** | `reportes_summary` + vista `client_balances` | `credit.{given,collected,overdue[10]}` |
| **Erosión de margen / $ perdidos por mes sin remarcar** | `margenes_erosionados(store)` `015` | por producto: margen_hoy vs original, precio_sugerido, `plata_por_mes`, `total_por_mes` — **la inteligencia de costos más profunda ya construida** |
| **Salud del dato** (sin costo, precios viejos) | `reportes_summary` | `data_health.{cost_coverage,products_without_cost,stale_prices}` |
| **Mix de medios de pago del período** | `reportes_medios(store,from,to)` `017` | `by_method` (fiado excluido, cobros de fiado imputados a su medio real), `on_credit` |
| **Gastos/opex por categoría (owner-only)** | `reportes_expenses(store,from,to)` `018` | `expenses`, `expenses_by_category`, `expenses_loaded_ever` |
| **Hoy: facturado, entró en caja, ganancia, vs promedio 28d, restock por rotación** | `dashboard_summary(store)` `008` | `today`, `by_method`, `restock`, `credit`, `low_stock`, `expiring` |
| **Alertas stock bajo + por vencer** | `store_alerts(store)` `006` (granted a service_role — el cron ya lo usa) | `low_stock`, `expiring`, `warning_days` |
| **Cierre de caja diario** | `cierre_caja(store,fecha)` `013` | facturado, entró, fiado, cobros, esperado, anuladas, by_method |

**Vistas disponibles:** `client_balances`, `low_stock_products`, `pending_expiries`,
`daily_totals` (esta última **no la usa ninguna página hoy** — lista para el asistente).

**Insight neto:** el "net profit del mes" = `reportes_summary.money.profit` (bruto) −
`reportes_expenses.expenses` (opex). Ya se calcula así client-side en Reportes.

### Derivable HOY (reusar) vs. requiere query NUEVA

- **Derivable hoy con las RPCs de arriba (≈90% del reporte mensual):** todo el P&L, márgenes,
  top movers por ganancia, stock muerto, merma, fiado con aging, erosión de margen con
  $/mes, salud del dato, mix de medios, opex por categoría, alertas.
- **Requiere query nueva (fuera del MVP, va a Fase 2+):** series de tendencia multi-período
  (hoy solo hay período actual + 1 anterior), RFM/recencia por cliente, análisis de canasta
  ("se venden juntos"), tendencia de velocidad por producto, granularidad horaria (hoy solo
  4 franjas), rotación catálogo-completa, performance por vendedor (`sales.member_id` existe,
  falta el agregado), forecasting/anomalías, tasa de anulación por período.

> Regla de reuso: el asistente **consume los `jsonb` ya agregados**; nunca re-query de
> `sales`/`sale_items`/ledgers crudos. Coincide con la intención de las migraciones
> ("una sola definición", cero agregación client-side) y con scale-security-baseline
> (toda lectura ya viene acotada).

---

## 2. Arquitectura del "análisis" — 3 opciones + recomendación

| Opción | Cómo | Costo run | Beneficio | Riesgo |
| --- | --- | --- | --- | --- |
| **(a) Determinista** | SQL/heurística sobre los JSON existentes: reglas (top movers, margen que cae, stock lento, fiado en riesgo, opex creciente, pérdidas por vencimiento, ritmo de ventas). Copy con plantillas por umbral. | **$0 LLM**, 0 alucinación | Verdad exacta, explicable, auditable, barato | Narrativa "de plantilla"; menos calidez de lenguaje |
| **(b) LLM puro** | Se le pasan métricas a la API de Claude y genera insights + recomendaciones priorizadas + narrativa. | Tokens/mes/negocio | Lenguaje natural rico, priorización flexible | **Puede inventar números**, costo por reporte, dato sale del tenant |
| **(c) Híbrido** | Los números duros se computan determinísticamente (ground truth = los JSON de §1). El LLM SOLO convierte esos números en narrativa legible y priorizada, recibiéndolos **como hechos inmutables** (no puede inventar cifras). | Tokens/mes/negocio (solo narrativa) | Números exactos + prosa premium; el LLM nunca calcula | Costo LLM (bajo), gobernanza de datos (§6) |

**Recomendación MVP = (a) Determinista.** Los JSON de §1 ya son el 90% del reporte; un
composer determinista + plantilla de email entrega valor real **con costo marginal ~$0 y
cero riesgo de alucinación o de fuga de datos**. Se lanza rápido y se prueba el apetito del
cliente sin comprometer privacidad.

**Recomendación producto maduro = (c) Híbrido.** Cuando el determinista esté validado, se
suma una capa LLM que **recibe los números ya calculados como hechos** y solo redacta la
narrativa priorizada ("tu margen cayó 4 pts por los cigarrillos; remarcá y recuperás
$X/mes"). Barato (§7), premium, y **ground-truth-safe** porque el LLM no ve tablas ni
calcula — reescribe. Nunca (b) LLM puro: el riesgo de inventar cifras sobre plata del dueño
es inaceptable.

Justificación (exactitud/costo/esfuerzo): (a) gana en exactitud y costo, pierde en calidez;
(c) mantiene la exactitud de (a) (números deterministas) y suma la calidez de (b) a costo de
centavos; (b) es el único que arriesga exactitud → descartado siempre.

---

## 3. Multi-vertical

**No existe campo vertical/rubro en `stores`** (verificado: columnas = id, name, slug,
timezone, branding, status, cuit, fiscal, timestamps). Los "hooks de rubro" viven solo como
comentarios en `products.attrs`/`sale_unit`. **Se necesita agregarlo** (migración 019):

- `stores.vertical text not null default 'kiosco'` con `check (vertical in ('kiosco','dietetica','petshop','otro'))` — additivo, default seguro.
- Editable desde superadmin al crear y después (mismo patrón que el toggle, §5).

**El framework de insights ya generaliza** — la matemática de las RPCs es rubro-agnóstica
(ventas, costo, margen, vencimientos, fiado aplican a cualquier negocio). El vertical
afecta **umbrales por defecto y etiquetas/copy**, no las fórmulas:

- Umbrales ya son **por negocio** en `store_settings` (`low_stock_threshold_default`,
  `expiry_warning_days`, `min_margin_pct`) → el asistente los respeta tal cual.
- El vertical ajusta: **defaults de esos umbrales** (dietética rota más lento y vence
  distinto que kiosco), **el vocabulario** del reporte ("mercadería" vs "productos"), y qué
  insight se **prioriza** (vencimientos pesan más en dietética/petshop perecedero).
- Implementación: una tabla de constantes por vertical en `src/lib/asistente/verticals.ts`
  (labels + pesos de priorización + defaults), no lógica ramificada en SQL.

---

## 4. Entrega por email (NUEVO)

**No hay envío de email hoy** (confirmado: cero `resend`/`nodemailer`/`sendgrid`/SMTP;
`super/actions.ts` incluso comenta "no hay SMTP todavía"). El stack de notificación es
**Web Push/VAPID** (push del browser, no email). Es greenfield en el transporte; todo lo
demás (cron, dedupe, admin client) se reusa.

**Proveedor recomendado: Resend.** DX simple, buen free tier (≈3.000 emails/mes), plantillas
HTML propias. Se suma como dep nueva (`resend`) — requiere aprobación del owner (safe-commit-gate).

**Cron del 1° de mes** — extiende el patrón existente `/api/cron/alerts`:
- Auth idéntica: `if (auth !== ` + "`Bearer ${process.env.CRON_SECRET}`" + `) → 401`.
- Nueva ruta `src/app/api/cron/monthly-report/route.ts`, `export const maxDuration = 60`
  (subir si hace falta con el volumen), `dynamic = "force-dynamic"`.
- `vercel.json` → segunda entrada en `crons`: `{ "path": "/api/cron/monthly-report",
  "schedule": "0 11 1 * *" }` (1° de mes; hora en UTC — ajustar para ~08:00 ART como hace
  `alerts`). Reporta el mes **cerrado anterior**.
- Loop: `stores` activas **con `ai_assistant_enabled = true`** (limit 500), en paralelo
  acotado (`Promise.all` por tandas); por negocio: llama las RPCs de §1 para el rango del
  mes anterior (calculado en tz del negocio con `lib/date.ts` → `startOfMonth`/`endOfMonth`),
  ensambla, envía.

**Plantilla de email:** HTML propio (sin depender de charts externos; si hace falta un
gráfico, PNG/imagen o tabla). Secciones = resumen ejecutivo (facturado, ganancia neta, vs
mes anterior) → 3 oportunidades priorizadas (remarcar / stock muerto / fiado a cobrar) →
detalle (top movers, mix de medios, opex) → alertas (por vencer, stock bajo). Encabezado
white-label con `branding.accent`/logo del negocio.

**Deliverability:** dominio propio verificado en Resend con **SPF + DKIM** (y DMARC);
from-address de marca (p.ej. `reportes@stockflow.app`), no gmail. Bounce/complaint webhooks
de Resend → registrar.

**Idempotencia (nunca doble-envío):** mismo patrón `notifyStore` — insert-first en
`notifications` con `dedupe_key = 'monthly_report:YYYY-MM'` y `type = 'monthly_report'`;
el índice único parcial `(store_id, dedupe_key)` hace que un `23505` signifique
"ya se mandó este mes" → skip. El envío de email va **después** del insert exitoso.
(Si el email falla tras insertar, hace falta un retry-safe: ver Preguntas abiertas §9.)

---

## 5. Gating + toggle superadmin

**Flag:** `stores.ai_assistant_enabled boolean not null default false` (migración 019, junto
con `vertical`). Elegimos columna booleana sobre un `plan/tier` genérico: es lo que pide el
caso (un add-on binario), y calza 1:1 con el patrón de toggle que ya existe.

**Toggle superadmin** — espejo exacto de `cambiarEstado` (`super/actions.ts`):
- Server action `setAsistenteIA(storeId, enabled)` guardada por `requireSuperadmin()` →
  `createAdminClient()` (service_role, bypassa RLS) → `.from("stores").update({
  ai_assistant_enabled }).eq("id", storeId)` → `revalidatePath("/super")`.
- **Al crear:** sumar el checkbox al `AltaDialog` (`super-client.tsx`) y pasar el flag por
  `crearNegocio`/RPC `create_store` (o un update inmediato post-alta si no se quiere tocar
  la RPC de onboarding — additividad).
- **Después:** botón/switch en la fila del negocio en `super-client.tsx` (al lado del
  Pause/Play de status).
- Exponer el flag en la vista `admin_stores` (`010`) para mostrar el estado en el panel.

**Gating end-to-end:**
- **Cron** filtra `ai_assistant_enabled = true` → los negocios sin el add-on ni se procesan
  (cero costo, cero email).
- **UI in-app** (si/cuando exista una página del asistente, Fase 3): se wirea el flag en
  `session.ts` — agregarlo al `select` explícito de `getSession` y al type `Store` — y la
  página se oculta con guard si está off.
- **RLS:** un miembro puede leer el flag de SU negocio (la policy `stores_select` ya lo
  permite); el superadmin lo edita por service_role. No hace falta policy nueva.

---

## 6. Gobernanza de datos / privacidad (crítico, multi-tenant)

El asistente lee financieros **solo-del-dueño** (margen, gastos, sueldos vía categoría
`salary`). Postura por opción:

- **MVP determinista (a):** **ningún dato sale de la DB.** Todo el cómputo es SQL + Next
  server-side; el email lleva solo el reporte ya redactado del propio negocio a la casilla
  del propio dueño. Superficie de privacidad externa = **nula** (salvo el contenido del
  email en tránsito por Resend, cifrado TLS). Es la razón fuerte para arrancar por (a).

- **Híbrido (c), cuando llegue:** lo que sale hacia la API de Claude = **solo agregados**,
  nunca filas crudas. Es **factible hoy** porque las RPCs de §1 **ya devuelven agregados**
  (totales, top-N con nombres de producto, %); no exponen transacciones individuales. Reglas
  duras para (c):
  - **Solo agregados, nunca raw rows.** Un negocio por llamada (frontera tenant intacta).
  - **Minimización:** nombres de productos sí (necesarios para el insight); **anonimizar
    nombres de clientes de fiado** antes de enviar (el top-deudores lleva nombre propio → se
    manda "Cliente 1/2/3" o iniciales; el nombre real solo aparece en el email al dueño, no
    en el prompt).
  - **Consentimiento = el opt-in pago por negocio** (el flag `ai_assistant_enabled` es el
    registro de consentimiento explícito del dueño a que su agregado se procese con IA).
  - **Logging:** registrar por reporte qué se envió (hash/resumen del payload, no el
    financiero completo), timestamp, modelo, tokens — para auditoría y costos.
  - **No-retención:** usar la API con opt-out de entrenamiento (por contrato/endpoint), y
    documentarlo en los términos del add-on.
  - Mostrar en el pitch/onboarding del tier que "tu resumen agregado se procesa con IA para
    redactar el informe" — transparencia.

---

## 7. Costo/beneficio para pricing

**Esfuerzo de dev por fase (estimado):**
- **MVP determinista:** 019 (vertical + flag) · composer `lib/asistente/*` (reusa RPCs) ·
  plantilla email · ruta cron mensual · wiring Resend · toggle superadmin + checkbox alta.
  ≈ **2–3 PRs enfocados**.
- **Fase 2 híbrido:** llamada a Claude API + prompt de "redactá con estos hechos" +
  inyección de hechos + guardrails de anonimización. ≈ **1 PR**.
- **Fase 3 in-app + proactivo:** página del asistente + insights semanales/anomalías.
  ≈ **varios PRs**.

**Costo marginal de run por negocio/mes:**
- **Cron:** incluido en Vercel (~1 ejecución/mes). ≈ $0.
- **Email:** 1/mes/negocio → con <100 negocios entra en el free tier de Resend. Marginal ≈ $0
  (a escala, Resend Pro ~USD 20/mes por 50k emails → fracción de centavo por email).
- **LLM (solo Fase 2 híbrida):** 1 reporte/mes. Input = los JSON de §1 compactados
  (~10–20k tokens estimados) + narrativa de salida (~1,5–3k tokens). En un modelo tipo
  Haiku, **muy por debajo de USD 0,05/reporte**; en un modelo mid-tier, del orden de
  **USD 0,10–0,30/reporte**. → Marginal LLM **< USD 0,50/negocio/mes** con holgura.
  *(Supuestos: 1 reporte mensual, tamaños de token estimados de los JSON; medir con un
  payload real antes de fijar precio final.)*

**Conclusión de pricing:** el costo marginal es **casi cero** → el tier se precia por
**valor, no por costo** ("tu contador de datos, en un email, todos los meses"). Con la base
StockFlow en el sweet spot $15–35k/mes (research previo), recomendación de packaging:

- **Add-on "Asistente IA": +$8.000–15.000/mes** sobre el plan base (uplift ~30–50%), o
  bundle "StockFlow Pro" = base + asistente a precio redondeado.
- *Supuestos:* disposición a pagar por insight accionable en pymes, margen bruto >95% por
  el costo marginal ~$0. **Decisión final del owner** (§9).

---

## 8. Roadmap por fases

- **MVP — Reporte mensual determinista + toggle + cron** *(recomendado primero)*
  - Scope: migración 019 (`vertical` + `ai_assistant_enabled`) · composer determinista que
    ensambla las RPCs de §1 para el mes anterior · plantilla de email white-label · ruta
    cron `monthly-report` + entrada en `vercel.json` · Resend + `RESEND_API_KEY` · toggle +
    checkbox en superadmin · dedupe `monthly_report:YYYY-MM`.
  - Esfuerzo: 2–3 PRs. Dependencias: aprobar dep `resend`, crear cuenta Resend + verificar
    dominio (SPF/DKIM), definir hora ART del cron, `RESEND_API_KEY` en env.
  - Gate scale-security: lecturas ya acotadas (RPCs con piso 730d); cron con `maxDuration`
    explícito y loop paralelo acotado; email idempotente.
- **Fase 2 — Narrativa LLM (híbrido)**
  - Scope: capa que pasa los hechos ya calculados a Claude para redactar el informe +
    priorización + anonimización de nombres de fiado + logging de payload/tokens.
  - Esfuerzo: 1 PR. Dependencias: decisión de privacidad (§6/§9), API key, opt-out de
    entrenamiento documentado.
- **Fase 3 — Asistente in-app + proactivo**
  - Scope: página del asistente (insights on-demand, no solo email), alertas semanales de
    oportunidad, detección de anomalías ("dejó de venderse"), las queries nuevas de §1
    (tendencia multi-período, performance por vendedor, canasta).
  - Esfuerzo: varios PRs. Dependencias: MVP + Fase 2 validados con un cliente real.

---

## 9. Preguntas abiertas para el owner

1. **¿MVP determinista primero, o directo al híbrido con IA?** Recomiendo determinista
   primero (costo ~$0, cero riesgo de privacidad/alucinación, valida apetito) y sumar la
   narrativa IA en Fase 2. ¿Coincidís o querés el "wow" del lenguaje IA desde el día 1?
2. **`vertical` en `stores` ahora o después?** Recomiendo agregarlo ya en 019 (es barato y
   additivo) aunque hoy sea todo kiosco, y diferir la lógica por-vertical. ¿OK?
3. **Privacidad IA (para cuando llegue el híbrido):** ¿aprobás mandar **solo agregados
   anonimizados** (nombres de fiado ofuscados) a la API de Claude, con opt-in pago como
   consentimiento? ¿O preferís mantener todo el análisis 100% local (determinista) sin IA
   externa nunca?
4. **Precio del add-on:** ¿te cierra el rango +$8–15k/mes (o un bundle "Pro")? Define el
   pitch, no bloquea el código.
5. **Reintento de email:** si el insert de dedupe queda OK pero el email de Resend falla,
   ¿preferís (a) reintento simple en el mismo cron, o (b) un campo `sent_at` separado del
   dedupe para poder reintentar sin re-insertar? (impacta el diseño de idempotencia).
6. **Alcance del reporte:** ¿el email mensual arranca con TODO el análisis de §1, o querés
   un subset priorizado (ganancia + 3 oportunidades + alertas) para que no abrume?

---

## Verificación (cuando se implemente, no ahora)

Por PR: `npx tsc --noEmit` · `npm run lint` · `npm run build` en `projects/stockflow-app`.
Cron: probar `/api/cron/monthly-report` con `Authorization: Bearer <CRON_SECRET>` local y
verificar (a) que salta negocios con flag off, (b) idempotencia (2ª corrida no re-manda,
`23505`), (c) email recibido con datos correctos del mes anterior en tz del negocio.
Migración 019 additiva corrida por el owner en el entorno (hoy Docker local). Evidencia
antes de cantar verde (verification-before-completion). Trabajo de UI del panel superadmin
= gate visual si cambia perceptiblemente. safe-commit-gate: `resend` staged **solo con
aprobación** de la dep; commits atómicos; PR, merge manual.

## Próximo paso tras aprobar

Si se aprueba el MVP, arrancar por la migración 019 (`vertical` + `ai_assistant_enabled`) +
composer determinista en un branch nuevo desde main (Autopilot, 1 PR, merge del owner).
Ningún código de app hasta que el owner apruebe el enfoque y resuelva §9.
