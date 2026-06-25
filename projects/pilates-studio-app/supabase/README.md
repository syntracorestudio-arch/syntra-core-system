# StudioFlow — Supabase

> **Estado (Fase 1C-0): migraciones escritas, NO aplicadas.** Estos archivos son SQL real,
> pero **todavía no se corrieron** contra ningún proyecto Supabase. Aplicarlas toca base de
> datos / env / dependencias → **requiere aprobación explícita del owner** (Fase 1C+).

## Contenido

```text
supabase/
└── migrations/
    ├── 001_initial_schema.sql     # 15 tablas MVP + constraints + índices + vista
    ├── 002_rls_policies.sql       # helpers + enable/force RLS + policies por rol
    └── 003_reservation_rpc.sql    # reserve_class / join_waitlist / cancel_reservation
```

Diseño de origen (fuente de verdad lógica):
[docs/technical/schema-draft.md](../docs/technical/schema-draft.md) ·
[rls-draft.md](../docs/technical/rls-draft.md) ·
[rpc-reservation-draft.md](../docs/technical/rpc-reservation-draft.md).

## Orden de aplicación (cuando se apruebe)
1. `001_initial_schema.sql` — crea tablas, constraints, índices y la vista
   `member_financial_status`.
2. `002_rls_policies.sql` — helpers `auth_*`, activa **RLS forzada** en todas las tablas y
   define las policies por rol (client / admin / reception / instructor).
3. `003_reservation_rpc.sql` — funciones `SECURITY DEFINER` de reserva/cancelación/waitlist.

## Garantías de diseño
- **Sin sobrecupo:** `UPDATE booked_count+1 WHERE booked_count<capacity` (atómico) +
  `CHECK (booked_count between 0 and capacity)`.
- **Sin doble gasto de crédito:** `credit_ledger` append-only + `FOR UPDATE` del `member_pass`
  elegido; saldo = `SUM(delta)` de packs no vencidos (no contador).
- **Sin reservas duplicadas:** índice único parcial `(occurrence_id, member_id) WHERE status='booked'`.
- **Aislamiento multi-tenant:** `studio_id` + RLS forzada con helpers SECURITY DEFINER
  (anti-recursión); escrituras de negocio vía RPC; `service_role` solo server-side.
- **TZ/DST:** todo en UTC; la ventana de cancelación se calcula sobre `starts_at` (UTC).

## Decisión de negocio implementada (Fase 1C-0)
**Refund por pack vencido:** al cancelar **dentro de la ventana**, el crédito se devuelve
**solo si el pack original sigue vigente** (`expires_at > now()`). Si el pack **venció**, **no
hay refund automático**; queda como **ajuste manual del admin** (asiento `adjust` en
`credit_ledger`, habilitado por la policy `ledger_insert_admin`). Implementado en
`cancel_reservation` (`003`).

## Cómo se aplicarán (Fase 1C+, pendiente de aprobación)
> No ejecutar todavía. Documentado para cuando el owner lo apruebe.
- Requiere un **proyecto Supabase** (lo crea el owner) y variables en `.env.local`
  (no versionado): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (solo server).
- Aplicación vía **Supabase CLI** (`supabase db push` / `migration up`) o pegando el SQL en
  el editor del dashboard — **a decidir con el owner**. Instalar la CLI/cliente es una dep
  nueva → requiere aprobación.
- **Seed** de un estudio demo ("Estudio Reforma") y datos de prueba: en un `seed.sql` aparte
  (Fase 1C+), no en estas migraciones de estructura.

## Pendientes / próximas sub-fases
- **`apply_payment` RPC:** registrar un pago + generar `member_passes`/`memberships` + asiento
  `purchase` en `credit_ledger`, en una transacción (hoy el admin puede insertar pago/pack por
  policy, pero el acople con el ledger de compra se centraliza en esa RPC — sub-fase siguiente).
- **Promoción automática de waitlist** (Fase 1.1): dentro del lock de la ocurrencia al cancelar.
- **Trigger de signup** que cree `profiles` desde `auth.users`.
- **Tests de aislamiento + concurrencia** (Fase 1C): cupo concurrente, doble gasto, refund
  dentro/fuera de ventana, pack vencido sin refund, fuga entre estudios.

## Importante
- **No** aplicar estas migraciones sin aprobación del owner.
- **No** commitear `.env`/`.env.local` ni keys.
- El SQL fue **escrito** y revisado en draft; **no** se validó ejecutándolo (no hay Supabase
  conectado). La primera aplicación real puede requerir ajustes menores.
