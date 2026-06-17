# TASKS — SYNTRA CORE WEBSITE

> Tracker operativo del proyecto. Dos tracks: **`TASK-0NN`** (lead pipeline /
> backend, consistente con los comentarios en código) y **`WEB-0xx`** (track visual
> de la Home — ver "Home — Live System" abajo).
> Fuente de verdad de tareas. Reemplaza a `todo.md` (en prosa, desactualizado).
>
> **Estados válidos:** `TODO` · `DOING` · `BLOCKED` · `REVIEW` · `DONE`
> **Owner por defecto:** Matias / SYNTRA CORE
> **Última actualización:** 2026-06-17
>
> **Gate visual (obligatorio para tareas visuales/perceptuales):** los cambios que
> afecten composición, layout, percepción premium, jerarquía, Hero/Servicios/Casos/
> Proceso/Contacto, motion visible o responsive visual **no se commitean sin aprobación
> visual explícita del owner** (build verde no alcanza). Flujo: prototipo local → QA
> técnico → review en navegador → Visual Review (`visual-quality-director`) → aprobación
> → commit. Protocolo: `agents/governance/visual-quality-gate.md`.

---

## Lead Pipeline (post-auditoría TASK-016)

| ID | Tarea | Prioridad | Estado | Owner | Código | Externo | Depende de |
|----------|-------|-----------|--------|-------|--------|---------|------------|
| TASK-016 | Auditoría read-only del lead pipeline | — | DONE | Matias / SYNTRA CORE | No | — | — |
| TASK-017 | QA e2e: inserción real en staging | Alta | DONE | Matias / SYNTRA CORE | No | Supabase | — |
| TASK-018 | Rotar `PANEL_PASSWORD` + revisar secretos del panel | Alta | DONE | Matias / SYNTRA CORE | No | Vercel | — |
| TASK-019 | Verificar workflow n8n (valida firma + dedup por idempotency-key) | Media | DONE | Matias / SYNTRA CORE | No | n8n | TASK-017 |
| TASK-020 | Observabilidad para "lead no notificado tras 3 intentos" | Media | DONE | Matias / SYNTRA CORE | Sí | Supabase | TASK-017 |
| TASK-021 | Verificar Plausible en Vercel (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) | Media | DONE | Matias / SYNTRA CORE | No | Vercel | — |
| TASK-022 | Dedup/UNIQUE + lowercase de email | Media | DONE | Matias / SYNTRA CORE | Sí | Supabase (SQL) | TASK-017 |
| TASK-023 | HMAC real en webhook n8n (hoy el secreto viaja en claro) | Media | TODO | Matias / SYNTRA CORE | Sí | n8n | TASK-019 |
| TASK-024 | Rate-limit distribuido (in-memory no sobrevive serverless) | Baja | TODO | Matias / SYNTRA CORE | Sí | Upstash/Vercel KV | — |
| TASK-025 | Hardening menor (ver checklist) | Baja | TODO | Matias / SYNTRA CORE | Sí | — | — |

---

## Detalle de tareas

### TASK-016 — Auditoría del lead pipeline — DONE
Auditoría read-only end-to-end con 4 agentes (`automation-architect`,
`automation-qa-reliability-guard`, `technical-product-owner`,
`qa-performance-guard`). Resultado: pipeline implementado y sano; tsc/lint/build
verdes; sin bugs críticos. Riesgos = configuración, operación y hardening.
Corrección clave: `SUPABASE_SERVICE_ROLE_KEY` usa el nuevo formato `sb_secret_…`
(válido), no es placeholder; `LEAD_WEBHOOK_SECRET` está presente.

### TASK-017 — QA e2e: inserción real en staging — Alta — DONE
**Gate de verdad: desbloquea el resto del plan.** Hacer un envío real desde el
formulario en staging y verificar en el dashboard de Supabase que el lead
persiste con todos los campos correctos. Confirma que la `sb_secret_…` no está
revocada y tiene permiso de escritura sobre `leads`.
- **Sin código.** Externo: Supabase.
- **Evidencia (2026-06-11):** E2E manual ejecutado correctamente: form → Supabase → n8n/email.

### TASK-018 — Rotar `PANEL_PASSWORD` + revisar secretos del panel — Alta — DONE
El passcode actual del panel es débil/predecible. Rotarlo por uno fuerte y
auditar los secretos del panel en cada environment antes de exponer `/panel`.
Se rotaron ambos secretos (`PANEL_PASSWORD` + `PANEL_SESSION_SECRET`) para
invalidar también las sesiones activas.
- **Sin código.** Externo: Vercel (Environment Variables).
- **Evidencia (2026-06-11):** Rotación ejecutada correctamente: nueva contraseña validada, contraseña anterior rechazada y sesiones previas invalidadas.

### TASK-019 — Verificar workflow n8n (firma + dedup) — Media — DONE
Confirmar en el editor de n8n que el nodo valida el header `x-syntra-signature`
y deduplica por `x-idempotency-key` (= `lead.id`). Sin dedup → emails duplicados.
- **Sin código.** Externo: n8n. **Depende de:** TASK-017.
- **Evidencia (2026-06-11):** Workflow n8n verificado y reforzado: valida `x-syntra-signature`, rechaza firma inválida con 401, procesa emails solo en rama autorizada y deduplica leads por `x-idempotency-key` mediante Data Table persistente.
- **Idempotencia:** Data Table `syntra_lead_notifications`. Flujo: Webhook → Validar firma → Buscar clave de idempotencia → ¿Lead ya procesado? → responder duplicado o registrar key → enviar email → responder 200.

### TASK-020 — Observabilidad "lead no notificado tras 3 intentos" — Media — DONE
Hoy el fallo de notificación tras 3 intentos es solo un `console.error` efímero.
Resuelto con **Opción B (app-owned)**: eje `notification_status` en `leads`
(pending/sent/failed/unknown) + `notified_at`/`notification_attempts`/
`last_notification_error_code`, escrito best-effort desde `notifyNewLead`, visible
en el panel (badge + filtro, separado del status comercial).
- **Con código** (app) + Supabase (migración). **Depende de:** TASK-017.
- **QA técnico:** `npx tsc --noEmit`, `npm run lint`, `npm run build` → verdes.
- **Evidencia (2026-06-11):** Migración 0002 aplicada en Supabase. Panel validado en runtime: leads legacy muestran `unknown`/Desconocido, filtros y badges de notificación funcionan, y un lead nuevo completó el flujo `pending → sent` con `notified_at`, `notification_attempts` y email n8n correcto.

### TASK-021 — Verificar Plausible en Vercel — Media — DONE
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` no está en `.env.local`; en prod el script solo se
monta si está seteado en Vercel. Verificar que existe en prod o el tracking de
conversión no corre.
- **Sin código.** Externo: Vercel (Environment Variables).
- **Evidencia (2026-06-11):** Plausible validado en producción: script activo, dominio syntra-core-system.vercel.app configurado, eventos y goals creados correctamente.
- **Goals creados:** `lead_submitted`, `cta_click`, `form_start`, `lead_submit_attempt`, `lead_submit_error`, `application_tab_click`.

### TASK-022 — Dedup/UNIQUE + lowercase de email — Media — DONE
Hoy `Mati@x.com` y `mati@x.com` se tratan como distintos y no hay UNIQUE → leads
duplicados y ruido en counts. Normalizar email a minúsculas (Zod) y decidir
constraint UNIQUE (migración SQL).
Resuelto con **A + D**: `trim().toLowerCase()` en `leadSchema` (fuente única) +
señal **no bloqueante** "Posible duplicado" en el panel (detección en memoria
sobre el listado visible; en el detalle vía `countLeadsByEmail`). **Sin UNIQUE
global** (un lead es una consulta, no una persona) y **sin bloqueo de repetidos**.
Migración `0003_lead_email_index.sql`: backfill legacy a lowercase + índice no
único `leads_email_idx`.
- **Con código** (Zod + panel) + Supabase (SQL). **Depende de:** TASK-017.
- **QA técnico:** `npx tsc --noEmit`, `npm run lint`, `npm run build` → verdes.
- **Evidencia (2026-06-11):** Migración 0003 aplicada en Supabase. Email legacy normalizado a lowercase, índice `leads_email_idx` creado, lead nuevo con email en mayúsculas se persistió en lowercase, n8n/panel recibieron lowercase, y dos leads con el mismo email persistieron correctamente mostrando badge no bloqueante "Posible duplicado".

### TASK-023 — HMAC real en webhook n8n — Media — TODO
`x-syntra-signature` envía el secreto en claro (no es un HMAC del payload); el
nombre induce a error. Migrar a `HMAC-SHA256(secret, body)` + timestamp
anti-replay, sincronizado con la validación en n8n.
- **Con código** (app) + n8n. **Depende de:** TASK-019.

### TASK-024 — Rate-limit distribuido — Baja — TODO
El rate-limit in-memory (`Map`) no se comparte entre instancias serverless:
límite efectivo = 5 × N_instancias. Migrar a store distribuido (Upstash/Vercel
KV) manteniendo la firma de `rateLimit()`.
- **Con código** + servicio KV. **Diferida** (requiere infra nueva).

### TASK-025 — Hardening menor — Baja — TODO
Agrupable en un solo PR. Checklist:
- [ ] Señal de truncado a 200 en `listLeads` (hoy trunca en silencio)
- [ ] Constraints de longitud en SQL (hoy los límites viven solo en Zod)
- [ ] Script `typecheck` (`tsc --noEmit`) en `package.json`
- [ ] Jitter en el backoff de reintentos de notificación
- [ ] Centralizar el default de `source` (`"website-home"` vs `"website"`)
- [ ] Validar la fila de salida con Zod en vez de `data as Lead`
- **Con código** (repo puro, sin externo).

---

## Sprint recomendado — "Verificación + cierre de riesgos operativos"

Primer bloque, **sin código** y ejecutable ya (cierra el riesgo más alto y dos
vectores de seguridad/medición sin riesgo de regresiones):

1. **TASK-017** — QA e2e en staging *(gate; arranca el sprint)*
2. **TASK-018** — Rotar `PANEL_PASSWORD` *(paralelo a 017)*
3. **TASK-021** — Verificar Plausible en Vercel *(paralelo a 017)*
4. **TASK-019** — Verificar workflow n8n *(tras claridad de 017)*

**Próxima acción inmediata:** ejecutar **TASK-017** (definir entorno staging,
envío real, verificar persistencia en Supabase). Su resultado puede reordenar las
prioridades de hardening.

---

## Backlog de hardening (sprint siguiente)

Abre el track de código una vez verificado el pipeline:

- **TASK-022** → **TASK-020** → **TASK-023** → **TASK-025**
- **TASK-024** queda en backlog (requiere provisionar servicio KV nuevo).

---

## Secuencia global

```
TASK-017 (gate)
   ├─ TASK-018  (paralelo, sin código)
   ├─ TASK-021  (paralelo, sin código)
   └─ TASK-019  (n8n)
          └─ TASK-023 (HMAC, coordina app + n8n)
TASK-022  (datos; coordina ventana con 017)
TASK-020  (observabilidad)
TASK-025  (hardening agrupado)
TASK-024  (diferida)
```

---

## Notas

- Completar el `Owner` operativo antes de mover una tarea a `DOING`.
- Toda tarea con cambio en n8n/Supabase requiere coordinar ventana y confirmar en
  el dashboard correspondiente.
- TASK-023 y TASK-019 tocan ambas la firma del webhook: hacer 019 antes de 023 o
  023 rompe el workflow validado.

---

## Home — Live System (track visual `WEB-0xx`)

> Track de evolución visual/UX de la Home, separado del lead pipeline. Dirección
> aprobada: **Nivel B — "El recorrido de una consulta"**, patrón
> **PENDIENTE → ACTIVO → HECHO**. Norte: `docs/specs/live-system-motion-spec.md`.
> Gate por sección: `design-system-guardian` + `qa-performance-guard`.

| ID | Tarea | Estado |
|----|-------|--------|
| WEB-001A | Auditoría comercial de lenguaje/demostración | DONE |
| WEB-002A/B | Inventario + de-jargon de copy (`site.ts`) | DONE |
| WEB-003A/B (+PATCH) | Mini-flujo demostrativo en Aplicaciones | DONE |
| WEB-004A | Fix overflow del badge del Hero en mobile | DONE |
| WEB-006 | Revisión post-cambios | DONE |
| WEB-007A | Auditoría radical sección por sección | DONE |
| WEB-007B | Dirección creativa "Sistema vivo" | DONE |
| WEB-008 | Header + navegación (nav corto, CTA blando, glass sólido) | DONE |
| WEB-009A/B/C | Servicios: zig-zag + demos vivas + copy IA diferenciado | DONE |
| WEB-LIVE-SYSTEM-RESET | Reset de dirección → Nivel B | DONE |
| WEB-LIVE-SPEC | Spec de motion unificado (`live-system-motion-spec.md`) | DONE |
| WEB-LIVE-JARGON | Limpiar copy visible del Canvas (content-only) — commit `085539d` | DONE |
| WEB-010 | Proceso — checklist que se completa (piloto del patrón) — commit `542f3ab` | DONE |
| WEB-009D | Servicios — alinear demos Web/Automatización al patrón vivo — commit `eb9417d` | DONE |
| WEB-009F (A–E) | Servicios "producto, no plano": escenas premium Web/Automatización/IA + polish + IA client-ready (supersede 009E) — commits `6853f8e`…`a9f743a` | DONE |
| WEB-LIVE-HERO-JARGON | Hero — de-jargon de labels/aria del grafo (content-only) — commit `68d6f68` | DONE |
| WEB-HERO-A/B | Hero — layout + chasis + composición asimétrica — commits `efa23c6`/`9eda7c1`; recalibraciones posteriores (B2/B2.1) revertidas → ver `WEB-HERO-FUTURE` | DONE |
| WEB-VISUAL-GATE | Visual Quality Gate + `visual-quality-director` + `npm run visual:shots` (gobernanza/infra) — commits `99886cc`/`e405ac7` | DONE |
| WEB-011A | Casos — concept audit (Opción A: "el recorrido del rubro se ejecuta") | DONE |
| WEB-011B | Casos — copy & rubros: pain/flow al léxico de 4 verbos + tagline — commit `ff60a13` | DONE |
| WEB-011C | Casos — Premium Scenario Rail: recorrido vivo PENDIENTE→ACTIVO→HECHO por clic, nodos-chip con iconografía semántica (entrada→orden→acción), HECHO cyan persistente (C.1 plan → C.2/C.3/C.4 prototipos, bajo Visual Gate) | DONE |
| WEB-011D | Casos — commit del prototipo aprobado por el owner (`feat(web): bring use cases scenarios to life`) | DONE |
| WEB-012A | Transiciones — concept audit: orden + enfoque copy-first (descarta conector visual pesado) | DONE |
| WEB-012B | Transiciones — reorden Nosotros tras Sistema + 3 frases-bisagra (`SectionBridge`) — commit `9304c3b` | DONE |
| VISUAL-WORKFLOW-003 | Mejorar `visual:shots`: pase de scroll antes del `fullPage` para reveals debajo del fold (whileInView/FadeIn) — commit `e60e21e` | DONE |
| WEB-013 | Contacto — microdiagnóstico 1-vista (toca backend: `submitLead`/Zod) | TODO |
| WEB-HERO-FUTURE | **Hero — rediseñar como una sola escena integrada** (ver detalle) | FROZEN / DEFERRED |
| — | Canvas / Sistema + Nosotros (motion + estructura) | FROZEN (requiere descongelamiento) |

### WEB-HERO-FUTURE — Rediseñar Hero como una sola escena integrada — FROZEN / DEFERRED

Tras 5 iteraciones de composición (50/50 → 28/36/34rem, **todas revertidas, sin merge**),
el diagnóstico `HERO-REDESIGN-001` confirmó que el problema NO es métrico (`rem`) sino
**estructural**: dos islas separadas, grafo en caja con lenguaje de feature card, visual
técnico/liviano, sin escena protagonista, aire sin intención. Además el grafo **duplica**
la sección `solutionArchitecture` (mismo lenguaje de nodos).

- **Dirección preferida: Opción B** — "una sola escena" integrada (texto + vida del sistema
  en un solo plano; sin grid 2-columnas ni chasis-caja).
- **Fallback: Opción A** — editorial centrado + atmósfera full-bleed (menor riesgo).
- **Evolución de mayor costo: Opción C** — escena framer one-shot que reemplaza el SMIL.
- **No ejecutar hasta** terminar Casos/Transiciones (madurar el lenguaje visual) **o**
  decisión explícita del owner. Pre-requisitos: descongelamiento nominal acotado +
  criterio de aprobación escrito + ancla premium + **1 ciclo del Visual Quality Gate**
  (`agents/governance/visual-quality-gate.md`).

**Próxima acción:** `WEB-013` (Contacto) — microdiagnóstico 1-vista. Tarea mixta: lógica/backend
(`submitLead`/Zod) + visual/conversión bajo el Visual Gate. Transiciones cerrado (`WEB-012A/B`,
copy-first + reorden, commit `9304c3b`); `VISUAL-WORKFLOW-003` cerrado (`e60e21e`, capturas fieles
debajo del fold). Casos cerrado (`WEB-011A→D`). El Hero queda diferido (`WEB-HERO-FUTURE`);
Canvas-motion / Nosotros permanecen FROZEN salvo OK nominal del owner.
