# StudioFlow — Roadmap por fases

> **Estado:** Fase 0 en curso. Cada fase indica objetivo, features, riesgos, QA esperado y
> qué queda fuera. El trabajo visual (Cat B/C) requiere reference-lock aprobado + visual
> gate; migraciones/deps/env requieren aprobación del owner; nunca push a main.

---

## Fase 0 — PRD + reglas + DB design + demo comercial *(en curso)*

- **Objetivo:** congelar scope, reglas de negocio, modelo de datos y material de venta, con
  la fuente de verdad en `docs/` (no en archivos temporales).
- **Features/entregables:** `README.md`, `prd.md`, `business-rules.md`, `database.md`
  (diseño lógico, sin SQL), `roadmap.md`, `commercial/pitch.md`, `commercial/demo-script.md`,
  reference-locks (draft) de dashboard-financiero, calendario-alumno y ficha-alumno.
- **Módulos:** solo documentación. Sin código.
- **Riesgos:** scope creep financiero; ambigüedad en reglas de crédito/refund/deuda.
- **QA:** revisión TPO (reglas) + product-strategist/sales-agent (pitch) + `git status` /
  `git diff --check`. Owner aprueba para cerrar la fase.
- **Queda fuera:** todo código, SQL, dependencias, Supabase, env.

## Fase 1 — MVP operativo

- **Objetivo:** un estudio opera reservas reales con cupos, packs/créditos y cobranza
  manual, sobre base multi-tenant + RLS correctas.
- **Features:** Auth + alta por invitación/código; calendario semanal con cupo en vivo;
  reservar/cancelar (ventana configurable, sin sobrecupo, sin duplicados); packs/membresías
  + `credit_ledger`; pago manual + asignar pack/membresía; saldo del alumno; deuda
  (`require_credit_or_membership` default); dashboard básico (ingresos mes/total, al día/
  deuda, membresías vencidas, ocupación); waitlist básica (anotarse + orden + promoción
  manual); historial. Recurrencias: materializar **8 semanas** por adelantado (parámetro
  extensible a 12); UX cliente asume **1 estudio principal**; instructor como **dato
  informativo** de la clase; notificaciones **solo in-app**.
- **Módulos:** `src/features/{reservations,classes,credits,payments,members,metrics}`,
  `src/server/{actions,rpc}` (reserva atómica con crédito), `supabase/migrations` (schema +
  RLS + RPC + índices), `src/lib/time`.
- **Riesgos:** concurrencia (cupo + crédito), aislamiento RLS, zonas horarias, recurrencias.
- **QA:** tsc/lint/build; **tests de cupo concurrente, de créditos/doble-gasto y de
  aislamiento RLS**; responsive 360/390/768/1440; flujos críticos e2e ligero.
- **Queda fuera:** MercadoPago, promoción automática de waitlist, landing, PWA,
  recordatorios, branding completo.

## Fase 1.1 — waitlist auto + branding + PWA + landing

- **Objetivo:** retención del alumno y captación.
- **Features:** **promoción automática** de waitlist + notificación in-app; branding por
  estudio (logo/color); **PWA instalable** (manifest + service worker); **landing pública**
  `/[slug]`; instructores activos.
- **Módulos:** `src/features/waitlist` (promoción), assets PWA en `public/`, ruta
  `src/app/[studioSlug]`.
- **Riesgos:** condición de carrera al promover; consistencia de branding por tenant.
- **QA:** test de promoción; Lighthouse PWA; accesibilidad; responsive de la landing.
- **Queda fuera:** pagos online, automatizaciones externas.

## Fase 2 — dashboard avanzado + métricas financieras

- **Objetivo:** que el dueño tome decisiones con datos.
- **Features:** dashboard financiero completo (packs/sueltas vendidas, abonos activos,
  ocupación, cancelaciones, no-shows, próximos a vencer); rol **recepción**; reportes.
- **Riesgos:** consistencia de métricas; performance de agregaciones.
- **QA:** validación de métricas vs datos seed; pruebas de la vista financiera.
- **Queda fuera:** MercadoPago.

## Fase 3 — MercadoPago (cuenta propia por estudio)

- **Objetivo:** cobro online directo a la cuenta del estudio (SYNTRA no intermedia fondos) y
  reducción de deuda.
- **Features:** **conexión OAuth de MercadoPago por estudio** (conectar/reconectar/
  desconectar desde Configuración); checkout (suelta/pack/membresía/abono) **contra la
  cuenta del estudio**; webhooks (aprobado/rechazado/pendiente) con **resolución de estudio
  receptor** + idempotencia + conciliación; estados de pago online en ficha del alumno y
  vista del admin.
- **Módulos:** `src/app/api/webhooks/mercadopago`, `studio_payment_providers` (credenciales
  cifradas/bóveda), `payment_attempts`, `mercadopago_webhook_events`, validación firma/HMAC,
  refresh de token OAuth server-side.
- **Riesgos:** almacenamiento seguro de credenciales por tenant; seguridad/idempotencia de
  webhooks; ruteo correcto del evento; pagos pendientes; duplicados.
- **QA:** tests de webhooks (firma, idempotencia, reintentos, estados, ruteo por estudio);
  seguridad de secrets por tenant.
- **Queda fuera:** automatizaciones de mensajería.

## Fase 4 — automatizaciones (WhatsApp/email/n8n)

- **Objetivo:** reducir trabajo manual y no-shows.
- **Features:** recordatorios de clase y de pago; membresía/pack por vencer; aviso de deuda;
  confirmación de reserva; promoción de waitlist por WhatsApp/email; reporte semanal al
  dueño; recuperación de no-shows.
- **Secuencia obligatoria:** `automation-architect → n8n-workflow-engineer →
  automation-qa-reliability-guard`.
- **Riesgos:** fiabilidad de entregas, reintentos, consentimiento/spam.
- **QA:** retries, idempotencia, logging, manejo de errores, seguridad de webhooks.
- **Queda fuera (a Pro):** segmentación avanzada, campañas.

## Fase 5 — SaaS multi-estudio completo

- **Objetivo:** plataforma vendible a escala.
- **Features:** superadmin SYNTRA (alta/baja de estudios, soporte, métricas globales);
  billing del SaaS; onboarding self-service; **posible extracción a repo Git propio**.
- **Riesgos:** complejidad de billing; soporte multi-cliente; aislamiento bajo escala.
- **QA:** auditoría de seguridad multi-tenant a escala; pruebas de carga básicas.

---

### Dependencias entre fases
- Fase 1 depende de Fase 0 aprobada (PRD + reglas + DB design + locks visuales).
- Fase 3 depende del **modelo de pagos unificado** ya cableado en Fase 1 (manual) → online
  sin reescribir lógica de negocio.
- Fase 5 depende de que el proyecto haya nacido self-contained (extracción barata).
