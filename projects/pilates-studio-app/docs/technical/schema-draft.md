# StudioFlow — Schema draft (Fase 1B)

> **DRAFT documental. SQL ilustrativo, NO ejecutable.** No es una migración. Las migraciones
> reales se materializan en Fase 1C (en `supabase/migrations/`) y **requieren aprobación del
> owner**. Fuente: [database.md](../database.md), [business-rules.md](../business-rules.md),
> [prd.md](../prd.md).

## Convenciones

- Motor: **PostgreSQL (Supabase)**. Esquema en `public`.
- **PK:** `id uuid primary key default gen_random_uuid()` salvo `profiles` (= `auth.users.id`).
- **Tenant key:** **toda** tabla de negocio lleva `studio_id uuid not null references studios(id)`.
- **Tiempos:** `timestamptz` en **UTC**. `created_at timestamptz not null default now()`;
  `updated_at` con trigger `set_updated_at()` donde aplique.
- **Enums:** vía **`text` + `CHECK`** (más simples de evolucionar que `CREATE TYPE`).
- **Dinero:** `numeric(12,2)`; `currency text not null default 'ARS'`.
- **Borrado:** soft-delete (estado `cancelled`/`archived`), nunca hard delete con historial.
- **FK:** `on delete restrict` por defecto; `cascade` solo en hijos sin valor histórico.

---

## studios
Tenant. Un estudio = un espacio aislado.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| name | text | not null |
| slug | text | not null, **unique**, `~ '^[a-z0-9-]+$'` |
| timezone | text | not null default `'America/Argentina/Buenos_Aires'` |
| branding | jsonb | not null default `'{}'` (logo, color primario/acento) |
| status | text | not null default `'active'`, check in (active, suspended) |
| created_at | timestamptz | not null default now() |

- **Índices:** unique(`slug`).
- **Riesgos:** `branding.accent` debe validarse (color) en app; el `slug` alimenta la landing
  pública (Fase 1.1) → inmutable o con redirect si cambia.

## profiles
Usuario global (1:1 con `auth.users`). **No** lleva `studio_id` (un usuario puede pertenecer
a varios estudios vía `members`).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK, **= auth.users.id**, FK `auth.users(id) on delete cascade` |
| full_name | text | not null |
| phone | text | nullable |
| email | text | nullable (espejo de auth) |
| created_at | timestamptz | default now() |

- **Riesgos:** mantener sincronía con `auth.users` (trigger on signup que crea el profile).
  No es tabla de negocio → sin `studio_id` (excepción consciente).

## members
Vínculo **usuario ↔ estudio + rol**. Es la pieza del multi-tenant.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| profile_id | uuid | not null, FK profiles |
| role | text | not null default `'client'`, check in (client, admin, reception, instructor) |
| status | text | not null default `'active'`, check in (active, inactive, invited) |
| joined_at | timestamptz | default now() |

- **Índices:** **unique(`studio_id`, `profile_id`)** (un vínculo por estudio); index(`studio_id`,`role`).
- **Relaciones:** N:N profiles↔studios. Roles `reception`/`instructor` ya en el enum (uso pleno post-MVP).
- **Riesgos:** es la fuente de verdad de RLS (`auth_member_studios()`); cuidar que `invited`
  no habilite reservar. Cambiar de rol = escritura admin-only.

## classes
Definición de una clase (plantilla).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| name | text | not null |
| type | text | nullable (reformer, mat, …) |
| default_capacity | int | not null, check > 0 |
| duration_min | int | not null, check > 0 |
| instructor_id | uuid | **nullable** (MVP: informativo; FK a `instructors` en Fase 1.1) |
| instructor_name | text | nullable (MVP: nombre simple, sin login — decisión Fase 0B) |
| status | text | not null default `'active'`, check in (active, archived) |
| created_at | timestamptz | default now() |

- **Índices:** index(`studio_id`, `status`).
- **Riesgos:** en MVP `instructor_name` evita dependencia de `instructors`; al introducir
  login de instructor (1.1) se migra a `instructor_id`.

## class_schedules
Regla de **recurrencia** semanal de una clase.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| class_id | uuid | not null, FK classes on delete cascade |
| weekday | int | not null, check 0..6 (0=domingo) |
| start_time | time | not null (hora local del estudio) |
| capacity | int | not null, check > 0 |
| valid_from | date | not null |
| valid_to | date | nullable (null = vigente indefinido) |
| created_at | timestamptz | default now() |

- **Índices:** index(`studio_id`, `class_id`, `weekday`).
- **Riesgos:** `start_time` es **hora local**; al materializar ocurrencias se combina con
  `studios.timezone` → `starts_at` en UTC (cuidado DST). Materialización 8 semanas (extensible 12).

## class_occurrences
Instancia concreta (fecha + hora) de una clase. Fuente de verdad del **cupo**.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| class_id | uuid | not null, FK classes |
| schedule_id | uuid | nullable, FK class_schedules (null si fue clase única) |
| starts_at | timestamptz | not null (**UTC**) |
| ends_at | timestamptz | not null |
| capacity | int | not null, check > 0 |
| booked_count | int | not null default 0, **check (booked_count between 0 and capacity)** |
| status | text | not null default `'scheduled'`, check in (scheduled, cancelled) |
| created_at | timestamptz | default now() |

- **Índices:** index(`studio_id`, `starts_at`); **unique(`class_id`, `starts_at`)** (idempotencia de recurrencias).
- **Riesgos:** el `CHECK booked_count<=capacity` es la última red contra sobrecupo (la RPC ya
  lo garantiza). `booked_count` solo se toca dentro de la RPC (nunca desde el cliente).

## class_reservations
Reserva de un alumno en una ocurrencia.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| occurrence_id | uuid | not null, FK class_occurrences |
| member_id | uuid | not null, FK members |
| status | text | not null default `'booked'`, check in (booked, cancelled, attended, no_show) |
| consumed_credit | boolean | not null default false (true si descontó del pack) |
| credit_ledger_id | uuid | nullable, FK credit_ledger (asiento de gasto, para refund) |
| created_at | timestamptz | default now() |
| cancelled_at | timestamptz | nullable |

- **Índices:** **unique partial** `(occurrence_id, member_id) WHERE status='booked'` (no duplicados);
  index(`occurrence_id`), index(`member_id`, `status`).
- **Riesgos:** la unicidad parcial es clave anti-duplicado; `credit_ledger_id` enlaza el gasto
  para poder reembolsar el asiento exacto.

## waitlist
Cola de espera por ocurrencia.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| occurrence_id | uuid | not null, FK class_occurrences |
| member_id | uuid | not null, FK members |
| position | int | not null |
| status | text | not null default `'waiting'`, check in (waiting, promoted, cancelled) |
| created_at | timestamptz | default now() |

- **Índices:** **unique partial** `(occurrence_id, member_id) WHERE status='waiting'`;
  index(`occurrence_id`, `position`).
- **Riesgos:** condición de carrera al promover (Fase 1.1 automático) → resolver dentro de la
  RPC de cancelación con `FOR UPDATE` sobre la ocurrencia. MVP: promoción manual del admin.

## passes
Producto **pack** del estudio (catálogo).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| name | text | not null |
| credits | int | not null, check > 0 |
| validity_days | int | not null, check > 0 |
| price | numeric(12,2) | not null, check >= 0 |
| active | boolean | not null default true |
| created_at | timestamptz | default now() |

- **Índices:** index(`studio_id`, `active`).
- **Riesgos:** precio/créditos los define cada estudio (Fase 0B). Editar un `pass` **no** debe
  alterar `member_passes` ya emitidos (son instancias congeladas).

## member_passes
Pack **comprado** (instancia para un alumno).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| member_id | uuid | not null, FK members |
| pass_id | uuid | nullable, FK passes (null si fue ad-hoc) |
| credits_total | int | not null, check > 0 |
| expires_at | timestamptz | not null |
| source_payment_id | uuid | nullable, FK payments |
| status | text | not null default `'active'`, check in (active, expired, depleted) |
| created_at | timestamptz | default now() |

- **Índices:** index(`member_id`); index(`studio_id`, `expires_at`).
- **Saldo:** **no** se guarda contador; el disponible = `SUM(credit_ledger.delta)` de packs
  no vencidos (ver credit_ledger). `status` es derivado/cacheable, no fuente de verdad.
- **Riesgos:** `expires_at` define vigencia; el cálculo de saldo debe **excluir** vencidos.

## memberships
Abono temporal / ilimitado.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| member_id | uuid | not null, FK members |
| type | text | not null (monthly, unlimited, …) |
| valid_from | date | not null |
| valid_to | date | not null |
| status | text | not null default `'active'`, check in (active, expired, cancelled) |
| source_payment_id | uuid | nullable, FK payments |
| created_at | timestamptz | default now() |

- **Índices:** index(`member_id`); index(`studio_id`, `valid_to`).
- **Cobertura:** si hay membresía vigente (`now()` entre from/to, status active), la reserva
  **no** consume crédito (la membresía cubre). Prioridad sobre pack.
- **Riesgos:** `valid_to` < hoy → vencida (deuda potencial). Cálculo en UTC con borde de día.

## credit_ledger
Movimientos de crédito — **append-only**. Fuente de verdad del saldo.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| member_id | uuid | not null, FK members |
| member_pass_id | uuid | nullable, FK member_passes |
| delta | int | not null, check (delta <> 0) |
| reason | text | not null, check in (purchase, booking, refund, expire, adjust) |
| reservation_id | uuid | nullable, FK class_reservations |
| note | text | nullable (para `adjust`) |
| created_by | uuid | nullable, FK members (quién originó el asiento; null = sistema) |
| created_at | timestamptz | not null default now() |

- **Índices:** index(`member_id`); index(`member_pass_id`); index(`studio_id`, `created_at`).
- **Append-only:** sin `UPDATE`/`DELETE` (se refleja con políticas RLS + revocar update/delete).
  Una corrección = nuevo asiento `adjust`.
- **Saldo disponible** = `SUM(delta)` agrupado por `member_pass_id` **de packs no vencidos**.
- **Riesgos:** doble gasto si dos reservas concurrentes leen saldo y descuentan → se evita
  con `FOR UPDATE` sobre el `member_pass` dentro de la RPC (ver rpc-reservation-draft).

## payments
Cobro **confirmado** (manual en MVP; online en Fase 3). Modelo unificado.

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| member_id | uuid | not null, FK members |
| amount | numeric(12,2) | not null, check >= 0 |
| currency | text | not null default `'ARS'` |
| concept | text | not null, check in (drop_in, pack, membership, abono) |
| method | text | not null, check in (cash, transfer, card_manual, mercadopago) |
| status | text | not null default `'confirmed'`, check in (confirmed, pending, rejected) |
| paid_at | timestamptz | not null default now() |
| recorded_by | uuid | nullable, FK members (admin que registró; null si online) |
| provider | text | nullable (Fase 3: 'mercadopago') |
| provider_payment_id | text | nullable (Fase 3) |
| created_at | timestamptz | default now() |

- **Índices:** index(`studio_id`, `paid_at`); **unique partial** `(provider, provider_payment_id) WHERE provider is not null` (anti-duplicado online, Fase 3).
- **Aplicación:** un pago `confirmed` genera `member_passes`/`memberships` + asiento `purchase`
  en ledger (vía RPC de aplicación; manual y online comparten lógica).
- **Riesgos:** en MVP `recorded_by` es obligatorio de facto (carga manual). Ingresos =
  `SUM(amount) WHERE status='confirmed'`.

## attendance
Check-in / asistencia / no-show (uso pleno en Pro; en MVP marca no-show para refund).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| id | uuid | PK |
| studio_id | uuid | not null, FK studios |
| reservation_id | uuid | not null, FK class_reservations, **unique** |
| status | text | not null, check in (checked_in, no_show) |
| checked_in_at | timestamptz | nullable |
| created_at | timestamptz | default now() |

- **Índices:** unique(`reservation_id`).
- **Riesgos:** marcar `no_show` dispara la regla de no-refund (default); 1:1 con reserva.

## studio_settings
Configuración por estudio (1:1).

| Campo | Tipo | Constraints |
| --- | --- | --- |
| studio_id | uuid | **PK**, FK studios on delete cascade |
| cancellation_window_hours | int | not null default 24, check >= 0 |
| reservation_policy | text | not null default `'require_credit_or_membership'`, check in (require_credit_or_membership, allow_with_warning, allow_grace_n, block_if_debt) |
| grace_n | int | not null default 0, check >= 0 (para allow_grace_n) |
| refund_on_late_cancel | boolean | not null default false |
| default_capacity | int | not null default 8, check > 0 |
| waitlist_enabled | boolean | not null default true |
| expiry_warning_days | int | not null default 7, check >= 0 |
| updated_at | timestamptz | default now() |

- **Riesgos:** estos settings alimentan la RPC de reserva/cancelación; cambiarlos afecta
  reglas en vivo → escritura admin-only, con valores por defecto seguros.

---

## Vista derivada: member_financial_status (no tabla)
Estado financiero por alumno, **calculado** (evita columnas desincronizadas):
- saldo de créditos = `SUM(credit_ledger.delta)` de packs no vencidos;
- membresía vigente = existe membership activa con `now()` en rango;
- estados MVP: `al_dia`, `debe_pago`, `membresia_vencida`, `pack_sin_saldo`, `sin_creditos`,
  `proximo_a_vencer` (vence ≤ `expiry_warning_days`), `pago_manual_registrado`.
- Fase 3 añade `pago_pendiente`/`pago_rechazado`/`pago_online_confirmado`.

## Riesgos transversales del schema
1. **Sobrecupo** → `CHECK booked_count<=capacity` + RPC atómica.
2. **Doble gasto de crédito** → ledger append-only + `FOR UPDATE` del pass en la RPC.
3. **Fuga entre tenants** → `studio_id` en todo + RLS (ver rls-draft).
4. **TZ/DST** → UTC en DB; `start_time` local + `timezone` al materializar.
5. **Recurrencias duplicadas** → unique(`class_id`,`starts_at`).
6. **Catálogo congelado** → `member_passes` no se altera al editar `passes`.

> Siguiente: [rls-draft.md](rls-draft.md) · [rpc-reservation-draft.md](rpc-reservation-draft.md).
