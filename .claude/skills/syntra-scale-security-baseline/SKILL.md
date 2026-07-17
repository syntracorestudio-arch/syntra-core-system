---
name: syntra-scale-security-baseline
description: Use when building or reviewing backend/data features in any SYNTRA product — new queries, endpoints, server actions, dashboards, RPCs, webhooks, cron jobs — or before shipping a product to its first paying client. Also when someone reports slowness, timeouts, or brute-force concerns.
---

# SYNTRA Scale & Security Baseline

**Skill normativa.** Baseline mínimo de escalabilidad y seguridad para TODO desarrollo
backend/data de SYNTRA. Nace de la auditoría real de StudioFlow (2026-07-17): la app se
construyó feature-first y acumuló sin darse cuenta queries sin techo, N+1, cero headers,
cero rate limiting y cero monitoreo. Este checklist evita repetirlo.

**Regla de oro:** la implementación canónica de cada punto vive en
`projects/pilates-studio-app` — copiar el patrón, no reinventarlo.

## Checklist por tipo de cambio

### Al escribir CUALQUIER query nueva (página, action, RPC)
- [ ] **Cota de fecha o límite**: ninguna lectura de tablas append-only (pagos, reservas,
      ledger, logs) sin `gte` de fecha o `limit`. La ventana = la que la UI realmente usa.
      Canónico: `admin/page.tsx` (6 meses), `reportes` (24), `super` (12).
- [ ] **Índice que la sirva**: filtrás/ordenás por columnas nuevas → índice en la misma
      migración. FKs nuevas SIEMPRE con índice (Postgres no los crea solo).
- [ ] **Paralelizar**: 2+ queries independientes → `Promise.all` (patrón "tanda 1 / tanda 2"
      de `app/page.tsx`). Query dentro de un loop = N+1 → batch o `Promise.all`.

### Al crear un endpoint/action PÚBLICO (sin sesión) o sensible
- [ ] **Rate limit** con la RPC `check_rate_limit(key, max, window)` (migración 033),
      **fail-open** (si la RPC falla, no bloquear al legítimo). Canónico: `join/actions.ts`.
- [ ] **Validación server-side** (Zod) + errores genéricos (no filtrar si un email/código existe).
- [ ] Webhooks: secreto en header + **idempotencia** por event-id + `maxDuration` explícito.

### Al crear un proyecto / preparar producción
- [ ] **Headers de seguridad** en `next.config.ts` (HSTS, X-Frame-Options DENY, nosniff,
      Referrer-Policy, Permissions-Policy). Canónico: StudioFlow `next.config.ts`.
- [ ] **Middleware que degrada**: `getUser()` en try/catch — proveedor de auth caído ⇒
      redirect con aviso, nunca 500 global. Toda ruta protegida listada en el matcher.
- [ ] **Monitoreo mínimo**: Sentry free + uptime externo + alertas del host
      (guía: `pilates-studio-app/docs/deploy.md` §8). Cron/webhooks → heartbeat visible.

### Antes de "listo para clientes" (gate)
- [ ] **Load test de evidencia**: latencia bajo concurrencia (p95 y errores) + la carrera
      del invariante de negocio (en StudioFlow: N reservas simultáneas sobre cupo M ⇒
      exactamente M). Sin números, no está verificado.

## Red flags — frená y aplicá el baseline
- `select` a tabla transaccional sin `gte`/`limit` · `await` en cadena de queries
  independientes · RPC llamada dentro de `for` · endpoint público sin rate limit ·
  "después agregamos los headers" · "el monitoreo cuando haya usuarios".

| Excusa | Realidad |
| --- | --- |
| "Con pocos datos anda rápido" | Append-only crece para siempre; la query sin techo es deuda con interés. |
| "Redis/colas para escalar" | A escala SYNTRA (<10³ req/min) es sobre-ingeniería: Postgres + estas cotas sobran. |
| "El rate limit lo agrego si atacan" | El ataque no avisa; el contador en Postgres cuesta 20 líneas. |
| "Load testing es para apps grandes" | 6 requests simultáneos ya prueban (o refutan) el invariante de negocio. |

## Precedencia
Normativa para SYNTRA, par de `syntra-safe-commit-gate`. Complementa (no reemplaza) el QA
mínimo de CLAUDE.md. Anti-sobre-ingeniería explícita: NO introducir Redis, colas, WAF pago
ni réplicas sin señal de carga real medida.
