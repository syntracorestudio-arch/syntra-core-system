# TASKS — SYNTRA CORE WEBSITE

> Tracker operativo del proyecto. Los IDs `TASK-0NN` son consistentes con los
> comentarios en código (`TASK-0NN` en `src/`).
> Fuente de verdad de tareas. Reemplaza a `todo.md` (en prosa, desactualizado).
>
> **Estados válidos:** `TODO` · `DOING` · `BLOCKED` · `REVIEW` · `DONE`
> **Owner por defecto:** Matias / SYNTRA CORE
> **Última actualización:** 2026-06-11

---

## Lead Pipeline (post-auditoría TASK-016)

| ID | Tarea | Prioridad | Estado | Owner | Código | Externo | Depende de |
|----------|-------|-----------|--------|-------|--------|---------|------------|
| TASK-016 | Auditoría read-only del lead pipeline | — | DONE | Matias / SYNTRA CORE | No | — | — |
| TASK-017 | QA e2e: inserción real en staging | Alta | TODO | Matias / SYNTRA CORE | No | Supabase | — |
| TASK-018 | Rotar `PANEL_PASSWORD` + revisar secretos del panel | Alta | TODO | Matias / SYNTRA CORE | No | Vercel | — |
| TASK-019 | Verificar workflow n8n (valida firma + dedup por idempotency-key) | Media | TODO | Matias / SYNTRA CORE | No | n8n | TASK-017 |
| TASK-020 | Observabilidad para "lead no notificado tras 3 intentos" | Media | TODO | Matias / SYNTRA CORE | Sí | Sentry/Logflare | TASK-017 |
| TASK-021 | Verificar Plausible en Vercel (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) | Media | TODO | Matias / SYNTRA CORE | No | Vercel | — |
| TASK-022 | Dedup/UNIQUE + lowercase de email | Media | TODO | Matias / SYNTRA CORE | Sí | Supabase (SQL) | TASK-017 |
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

### TASK-017 — QA e2e: inserción real en staging — Alta — TODO
**Gate de verdad: desbloquea el resto del plan.** Hacer un envío real desde el
formulario en staging y verificar en el dashboard de Supabase que el lead
persiste con todos los campos correctos. Confirma que la `sb_secret_…` no está
revocada y tiene permiso de escritura sobre `leads`.
- **Sin código.** Externo: Supabase.
- **Próximo paso:** preparar entorno staging → envío real → verificar fila.

### TASK-018 — Rotar `PANEL_PASSWORD` + revisar secretos del panel — Alta — TODO
El passcode actual del panel es débil/predecible. Rotarlo por uno fuerte y
auditar los secretos del panel en cada environment antes de exponer `/panel`.
- **Sin código.** Externo: Vercel (Environment Variables).
- **Próximo paso:** generar passcode fuerte y actualizar env en Vercel.

### TASK-019 — Verificar workflow n8n (firma + dedup) — Media — TODO
Confirmar en el editor de n8n que el nodo valida el header `x-syntra-signature`
y deduplica por `x-idempotency-key` (= `lead.id`). Sin dedup → emails duplicados.
- **Sin código.** Externo: n8n. **Depende de:** TASK-017.

### TASK-020 — Observabilidad "lead no notificado tras 3 intentos" — Media — TODO
Hoy el fallo de notificación tras 3 intentos es solo un `console.error` efímero.
Agregar un sink (Sentry/Logflare) que capture ese evento para que un lead
persistido pero nunca notificado no pase desapercibido.
- **Con código** (app) + servicio externo. **Depende de:** TASK-017.

### TASK-021 — Verificar Plausible en Vercel — Media — TODO
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` no está en `.env.local`; en prod el script solo se
monta si está seteado en Vercel. Verificar que existe en prod o el tracking de
conversión no corre.
- **Sin código.** Externo: Vercel (Environment Variables).

### TASK-022 — Dedup/UNIQUE + lowercase de email — Media — TODO
Hoy `Mati@x.com` y `mati@x.com` se tratan como distintos y no hay UNIQUE → leads
duplicados y ruido en counts. Normalizar email a minúsculas (Zod) y decidir
constraint UNIQUE (migración SQL).
- **Con código** (Zod) + Supabase (SQL). **Depende de:** TASK-017.

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
