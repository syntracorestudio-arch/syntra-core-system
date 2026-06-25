# StudioFlow — Diseño de datos (modelo lógico)

> **Estado:** Fase 0 · **Diseño documental, sin SQL ni migraciones todavía.** Motor previsto:
> **PostgreSQL (Supabase)**. Toda tabla de negocio lleva `studio_id` (tenant key) + RLS.
> Timestamps en **UTC**; `studios.timezone` se usa solo para presentación y para la ventana
> de cancelación. Las migraciones reales se crean en Fase 1 (requieren aprobación del owner).

---

## 1. Principios

- **Multi-tenant light:** un solo Postgres, aislamiento por columna `studio_id` + RLS
  estricta. No schema-per-tenant ni DB-per-tenant (prematuro).
- **Escrituras sensibles vía RPC `SECURITY DEFINER`** (reservar con cupo+crédito, registrar
  pago, aplicar pack). El cliente nunca hace inserts directos de negocio.
- **Saldos y estados financieros son derivados** (ledger + vista), no contadores mutables.
- **Soft-delete** en entidades con historial (clases con reservas, etc.).

## 2. Tablas MVP

| Tabla | Qué guarda | Campos críticos |
| --- | --- | --- |
| **studios** | Tenant (estudio) | `id`, `name`, `slug`, `timezone`, `branding`(jsonb), `status`, `created_at` |
| **profiles** | Usuario (1:1 con `auth.users`) | `id`(=auth uid), `full_name`, `phone`, `email` |
| **members** | Vínculo usuario↔estudio + rol | `id`, `studio_id`, `profile_id`, `role`(client/admin/reception/instructor), `status`, `joined_at` |
| **classes** | Definición de clase | `id`, `studio_id`, `name`, `type`, `default_capacity`, `duration_min`, `instructor_id?` |
| **class_schedules** | Regla de recurrencia | `id`, `studio_id`, `class_id`, `weekday`, `start_time`, `capacity`, `valid_from`, `valid_to` |
| **class_occurrences** | Instancia concreta (fecha+hora) | `id`, `studio_id`, `class_id`, `starts_at`(UTC), `ends_at`, `capacity`, `booked_count`, `status` |
| **class_reservations** | Reserva del alumno | `id`, `studio_id`, `occurrence_id`, `member_id`, `status`(booked/cancelled/attended/no_show), `consumed_credit`(bool), `created_at`, `cancelled_at` |
| **waitlist** | Cola por ocurrencia | `id`, `studio_id`, `occurrence_id`, `member_id`, `position`, `created_at` |
| **passes** | Producto pack del estudio | `id`, `studio_id`, `name`, `credits`, `validity_days`, `price`, `active` |
| **member_passes** | Pack comprado (instancia) | `id`, `studio_id`, `member_id`, `pass_id`, `credits_total`, `expires_at`, `source_payment_id` |
| **memberships** | Abono temporal / ilimitado | `id`, `studio_id`, `member_id`, `type`, `valid_from`, `valid_to`, `status`, `source_payment_id` |
| **credit_ledger** | Movimientos de crédito (append-only) | `id`, `studio_id`, `member_id`, `member_pass_id?`, `delta`(+/-), `reason`(purchase/booking/refund/expire/adjust), `reservation_id?`, `created_at` |
| **payments** | Cobro confirmado (manual/online) | `id`, `studio_id`, `member_id`, `amount`, `currency`, `concept`(drop_in/pack/membership/abono), `method`(cash/transfer/card_manual/mercadopago), `status`(confirmed/pending/rejected), `paid_at`, `recorded_by` |
| **attendance** | Check-in / no-show | `id`, `studio_id`, `reservation_id`, `status`, `checked_in_at` |
| **studio_settings** | Config por estudio | `studio_id`, `cancellation_window_hours`(24), `reservation_policy`, `refund_on_late_cancel`(bool), `default_capacity`, `waitlist_enabled`, `expiry_warning_days` |

### Vista MVP (no tabla)
- **`member_financial_status`** (VIEW): estado financiero derivado por alumno —
  `al_dia` / `debe_pago` / `membresia_vencida` / `pack_sin_saldo` / `sin_creditos` /
  `proximo_a_vencer` / `pago_manual_registrado`. (Los estados `pago_pendiente` /
  `pago_rechazado` / `pago_online_confirmado` se activan en Fase 3.) Se usa **vista** para
  no mantener columnas desincronizadas.

## 3. Tablas futuras (definidas ahora, vacías hasta su fase)

| Tabla | Para qué | Fase |
| --- | --- | --- |
| **studio_payment_providers** | **Conexión MercadoPago por estudio** (OAuth). Ver §6 | 3 (previsto en F0) |
| **payment_attempts** | Intentos de pago online (pending/approved/rejected, `idempotency_key`, `studio_id`) | 3 |
| **mercadopago_webhook_events** | Idempotencia de webhooks (`event_id` único, `studio_id` resuelto) | 3 |
| **instructors** | Datos del profe (bio, agenda) | 1.1/2 |
| **cancellation_logs / no_show_logs** | Auditoría dedicada (opcional) | Pro |

### Sobre-ingeniería evitada (decisión)
- **No** crear `charges` / `invoices` todavía: sin facturación legal en MVP; `payments`
  alcanza. Sumar `invoices` solo si un estudio exige comprobante fiscal.
- `member_financial_status` es **vista**, no tabla.
- `cancellation_logs` / `no_show_logs`: en MVP se cubren con `reservation.status` +
  `credit_ledger.reason`. Tablas de auditoría dedicadas solo si hace falta reporting fino.

## 4. Relaciones principales

```text
studios 1—N members N—1 profiles        (un usuario puede ser miembro de varios estudios)
classes 1—N class_schedules             (recurrencias)
classes 1—N class_occurrences           (instancias)
class_occurrences 1—N class_reservations
class_occurrences 1—N waitlist
members 1—N {member_passes, memberships, payments, credit_ledger}
payments 1—1 {member_passes | memberships}   (origen del beneficio: source_payment_id)
passes 1—N member_passes
class_reservations 1—1 attendance
studios 1—1 studio_settings
studios 1—1 studio_payment_providers          (Fase 3)
```

## 5. RLS (Row Level Security)

- **Aislamiento por tenant:** función helper `auth_member_studios()` → toda fila visible
  solo si `studio_id ∈` estudios donde el usuario es `member`.
- **client:** lee ocurrencias de su estudio; lee/crea/cancela **sus propias** reservas; lee
  su saldo/pagos; **nunca** ve datos de otros alumnos ni de otros estudios.
- **admin:** CRUD completo dentro de **su** `studio_id` (clases, alumnos, pagos, settings).
- **reception** (post-MVP): como admin pero sin `studio_settings` sensibles ni métricas
  financieras globales.
- **instructor** (post-MVP): lee sus clases y los asistentes; no ve finanzas.
- **superadmin** (Fase 5): acceso vía rol de servicio / política específica, no por cliente.
- **`studio_payment_providers` (Fase 3):** credenciales visibles **solo** para service-role;
  ningún cliente ni admin lee el `access_token` en claro (ver §6).

## 6. Preparación para MercadoPago — cuenta por estudio (Fase 3)

> **Decisión del owner:** cada estudio cobra en **su propia cuenta de MercadoPago**. SYNTRA
> **no** cobra ni intermedia fondos de alumnos. El modelo se diseña ahora; se implementa en
> Fase 3.

- **`studio_payment_providers`** (una fila por estudio):
  `studio_id`, `provider`('mercadopago'), `status`(connected/disconnected), `mp_user_id`,
  `access_token`/`refresh_token` **cifrados (Supabase Vault o columna cifrada,
  service-role-only)**, `public_key`, `connected_at`.
- **Patrón:** conexión **OAuth por estudio** ("Conectar tu MercadoPago"). La app crea las
  preferencias de pago **contra la cuenta del estudio** (sus credenciales), no las de SYNTRA.
- **Sin split/comisión** sobre el pago del alumno: SYNTRA cobra su **suscripción aparte**.
- **`payment_attempts`:** un intento por checkout online, con `idempotency_key` propio y
  `studio_id`. Estados pending/approved/rejected.
- **`mercadopago_webhook_events`:** idempotencia por `event_id` único; el webhook **resuelve
  primero a qué estudio pertenece** el evento (por la cuenta receptora / metadata de la
  preferencia) antes de aplicar nada.
- **Conciliación:** la fuente de verdad es el **webhook**, no el redirect del navegador. El
  beneficio (pack/membresía/crédito) se aplica **solo al confirmar** (status approved).
- **Anti-duplicado:** `event_id` único + `idempotency_key` del attempt + constraint único
  `(provider, provider_payment_id)` en `payments`.
- **Estados visibles al admin:** aprobado / pendiente / rechazado + alumnos en deuda, vía
  `member_financial_status` + lista de `payments`.

## 7. Reservas concurrentes (control de cupo + crédito)

- La reserva se hace en una **RPC `SECURITY DEFINER`** que, en una sola transacción:
  1. `UPDATE class_occurrences SET booked_count = booked_count + 1
     WHERE id = :occ AND booked_count < capacity RETURNING …` (check+update atómico),
  2. verifica no-duplicado e (según política) descuenta crédito escribiendo el asiento
     `booking (-1)` en `credit_ledger`,
  3. inserta `class_reservations`.
- Si el `UPDATE` no afecta filas → no hay cupo → la operación falla y ofrece waitlist.
- Garantías: **sin sobrecupo** y **sin doble gasto de crédito** bajo concurrencia.

## 8. Índices importantes

- `class_occurrences (studio_id, starts_at)` — agenda semanal.
- `class_reservations (occurrence_id)` y `(member_id, status)` — listados y "mis clases".
- Índice **único parcial** `(occurrence_id, member_id) WHERE status='booked'` — no duplicados.
- `waitlist (occurrence_id, position)` — orden de espera.
- `credit_ledger (member_id)` — cálculo de saldo.
- `payments (studio_id, paid_at)` — métricas de ingresos.
- `members (studio_id, profile_id)` único.
- `mercadopago_webhook_events (event_id)` único (Fase 3).

## 9. Riesgos técnicos del modelo

1. **Sobrecupo concurrente (crítico)** → RPC atómica (§7).
2. **Consistencia de créditos (crítico)** → ledger append-only + asiento en la misma
   transacción que la reserva; saldo = `SUM(ledger)`.
3. **Aislamiento multi-tenant (crítico)** → RLS en todas las tablas + tests de aislamiento.
4. **Credenciales MP por estudio (crítico, Fase 3)** → cifrado/bóveda, service-role-only,
   nunca al cliente, refresh server-side; una fuga compromete la cuenta de cobro del estudio.
5. **Zonas horarias / DST** → UTC en DB; `timezone` por estudio; tests de borde.
6. **Recurrencias** → materialización con ventana móvil + idempotencia `(class_id, starts_at)`.
7. **Borrado de clases con reservas** → soft-delete + estado `cancelled`, nunca hard delete.
8. **Migraciones** → sensibles; requieren aprobación del owner antes de aplicar.

> El SQL (schema + RLS + RPC + índices) se redacta y revisa en **Fase 1**. Este documento
> es el diseño lógico que ese SQL debe materializar.
