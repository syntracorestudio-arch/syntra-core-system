# StudioFlow — Reglas de negocio

> **Estado:** Fase 0 · Fuente de verdad de la lógica del producto. Toda regla debe
> validarse **server-side** (Server Actions / RPC + Zod); el cliente solo mejora UX.
> Todas las reglas marcadas *(config)* son **configurables por estudio** vía
> `studio_settings`.

---

## 1. Reserva

- Un alumno reserva una **ocurrencia de clase** (`class_occurrence`: fecha + hora concreta).
- La reserva es válida solo si, de forma **atómica**, se cumplen:
  1. **Hay cupo** (`booked_count < capacity`).
  2. El alumno **no tiene ya una reserva activa** en esa ocurrencia (sin duplicados).
  3. El alumno **puede reservar según la política de deuda** del estudio (ver §8).
  4. La clase no está cancelada y aún no comenzó.
- Al confirmarse: `booked_count += 1`, se crea `class_reservation` (status `booked`), y —si
  la política consume crédito— se registra el descuento en `credit_ledger` (ver §6) **en la
  misma transacción**.
- **Concurrencia:** el control de cupo + descuento de crédito se hace en una **RPC
  `SECURITY DEFINER`** con check+update atómico (o `SELECT … FOR UPDATE`). Nunca calcular
  cupo en el cliente. Garantía dura: **sin sobrecupo**.

## 2. Cupos

- Cada ocurrencia tiene `capacity` (heredada de la clase/horario o fijada manualmente).
- `default_capacity` por estudio *(config)*; editable por clase.
- Cuando `booked_count == capacity`, la clase está **llena** → la UI ofrece lista de espera
  (§9) en vez de reservar.

## 3. Cancelación (configurable)

- El alumno puede cancelar su reserva mientras esté **dentro de la ventana permitida**.
- **Ventana default: 24 h** antes del inicio de la clase *(config:
  `cancellation_window_hours`, default 24)*.
- El cálculo compara `now()` (UTC) contra `class_occurrence.starts_at` (UTC). La zona
  horaria del estudio (`studios.timezone`) se usa para **mostrar**, no para el cálculo.
- Toda cancelación **libera el cupo** (`booked_count -= 1`) y marca la reserva como
  `cancelled` con `cancelled_at`.

### 3.1 Regla 24 h (default)
- Cancelar con **≥ `cancellation_window_hours`** de anticipación = cancelación **en
  ventana** → ver devolución de crédito (§7).
- Cancelar con **menos** anticipación = cancelación **tardía** (§7.1).

## 4. Packs

- Un **pack** es un producto del estudio (`passes`): N créditos con una validez en días y
  un precio (ej. "Pack 8 clases / 30 días").
- Cuando se asigna/compra un pack, se crea una instancia `member_passes` para el alumno con
  `credits_total`, `expires_at` (= fecha de asignación + `validity_days`), y referencia al
  pago origen.
- El **saldo disponible** del alumno = suma de créditos de sus packs **no vencidos**
  (ver §6).
- Un pack **vencido** no aporta créditos aunque le queden sin usar.

## 5. Membresías

- Una **membresía / abono** (`memberships`) habilita reservar de forma **ilimitada** dentro
  de su validez (`valid_from` → `valid_to`), **sin consumir créditos**.
- Estados: `active` (hoy dentro de validez) · `expired` (validez pasada) · `cancelled`.
- Si el alumno tiene membresía activa, las reservas **no descuentan** del pack (la membresía
  cubre). Si tiene ambas, la membresía tiene prioridad de cobertura.

## 6. Créditos y credit_ledger

- El **saldo de créditos es derivado**, no un contador mutable. Se calcula como
  `SUM(credit_ledger.delta)` sobre los movimientos de packs **no vencidos** del alumno.
- `credit_ledger` es **append-only** (nunca se edita ni borra un asiento; se corrige con un
  asiento nuevo). Cada asiento registra: `member_id`, `member_pass_id?`, `delta` (+/-),
  `reason`, `reservation_id?`, `created_at`.
- **Motivos (`reason`):**
  - `purchase` → `+N` al asignar/comprar un pack.
  - `booking` → `-1` al reservar (si la política consume crédito y no hay membresía activa).
  - `refund` → `+1` al cancelar en ventana (§7).
  - `expire` → `-X` al vencer un pack con créditos sin usar (registro de expiración).
  - `adjust` → corrección manual del admin (con motivo).
- **Por qué ledger y no contador:** evita doble gasto y refunds inconsistentes bajo
  concurrencia, y da auditoría completa. Es la decisión técnica central de esta capa.

## 7. Devolución de créditos (refund) — configurable

Default del owner:
- **Cancela dentro de la ventana permitida → se DEVUELVE el crédito** (`refund`, `+1`).
- **Cancela tarde o es no-show → NO se devuelve el crédito.**
- La regla es **configurable por estudio** *(config: `refund_on_late_cancel`, default
  `false`)*. Si un estudio la activa, las cancelaciones tardías también devuelven crédito.

### 7.1 Cancelación tardía
- Cancelación con menos anticipación que la ventana: libera el cupo, marca `cancelled`,
  pero **no** genera asiento `refund` (salvo `refund_on_late_cancel = true`).

### 7.2 Cobertura por membresía
- Si la reserva estaba cubierta por **membresía** (no consumió crédito), la cancelación no
  genera refund de crédito (no había gasto que devolver).

## 8. Deuda y política de reserva (configurable)

- **Deuda** es un estado **derivado** (no una tabla mutable): un alumno "debe" cuando la
  política del estudio exige medio de pago activo y no lo tiene (sin créditos y sin
  membresía vigente), o cuando tiene una membresía vencida sin renovar.
- **Política de reserva default del owner: `require_credit_or_membership`** — solo puede
  reservar quien tiene **crédito disponible** o **membresía/abono activo**.
- Políticas posibles *(config: `reservation_policy`)*:
  - `require_credit_or_membership` *(default)* — reserva solo con crédito o membresía activa.
  - `allow_with_warning` — permite reservar aunque deba; muestra aviso al alumno y al admin.
  - `allow_grace_n` — permite N reservas "fiadas" antes de bloquear (Pro).
  - `block_if_debt` — bloquea si registra deuda.
- **Avisos:** alumno con saldo 0 / deuda ve aviso + CTA; el admin ve la lista de alumnos con
  deuda en el dashboard.

## 9. Lista de espera (waitlist)

- Si la clase está llena, el alumno puede **anotarse en lista de espera** (`waitlist`) con
  una `position` que respeta el **orden de llegada**.
- **MVP:** el admin **ve** la lista y promueve **manualmente** al liberarse un cupo.
- **Fase 1.1:** promoción **automática** al primero de la cola cuando se libera un cupo +
  notificación. La tabla y el orden ya quedan listos en MVP para no migrar.
- Un alumno no puede estar a la vez reservado y en lista de espera de la misma ocurrencia.

## 10. No-show

- Si el alumno no asiste a una clase reservada y no canceló, el admin (o el sistema, en
  fases futuras) marca la reserva como `no_show` (vía `attendance`).
- Efecto sobre créditos: **no se devuelve** (igual que cancelación tardía), salvo
  `refund_on_late_cancel = true`.
- Penalizaciones automáticas por no-show: **fuera de MVP** (Pro).

## 11. Clases recurrentes

- Una clase puede tener una **regla de recurrencia** (`class_schedules`): día de la semana +
  hora + cupo + vigencia (`valid_from` / `valid_to`).
- A partir de la regla se **materializan ocurrencias** (`class_occurrences`) en una **ventana
  móvil** hacia adelante (sugerido 8–12 semanas; a confirmar).
- **Idempotencia:** no se duplican ocurrencias para el mismo `(class_id, starts_at)`.
- Editar/cancelar una clase con reservas: **soft-delete** + estado `cancelled` + aviso a los
  anotados (in-app en MVP). Nunca hard delete con reservas asociadas.

## 12. Pagos (MVP manual)

- En MVP, el admin **registra pagos manuales** (`payments`): `concept`
  (drop_in / pack / membership / abono), `method` (cash / transfer / card_manual), `amount`,
  `paid_at`, `recorded_by`, `status = confirmed`.
- Un pago confirmado **aplica el beneficio**: genera `member_passes` (pack) o `memberships`
  (membresía/abono) y los asientos de `credit_ledger` correspondientes.
- **Ingresos** = suma de `payments` confirmados, por mes y totales.
- **Modelo unificado:** manual y (futuro) online comparten la misma tabla `payments` y la
  misma lógica de aplicación; MercadoPago (Fase 3) solo agrega `method = mercadopago` +
  intentos + webhooks. Detalle en [database.md](database.md) §MercadoPago.

## 13. Reglas configurables por estudio (resumen)

| Setting | Default | Qué controla |
| --- | --- | --- |
| `cancellation_window_hours` | `24` | Ventana de cancelación |
| `reservation_policy` | `require_credit_or_membership` | Quién puede reservar según deuda |
| `refund_on_late_cancel` | `false` | Si cancelación tardía/no-show devuelve crédito |
| `default_capacity` | (definido por estudio) | Cupo por defecto de clases nuevas |
| `waitlist_enabled` | `true` | Habilita lista de espera |
| `expiry_warning_days` | (ej. 7) | "Próximo a vencer" para packs/membresías |
| `timezone` | (definido en alta) | Zona horaria para presentación y ventana |

---

### Invariantes que el QA debe verificar
- Nunca `booked_count > capacity` (sobrecupo imposible), aún con reservas concurrentes.
- Saldo de créditos de un alumno = `SUM(ledger)` de packs no vencidos, siempre ≥ 0.
- Un refund nunca duplica saldo; una cancelación genera **a lo sumo** un asiento `refund`.
- Ningún alumno ve/gestiona datos de otro estudio (aislamiento por `studio_id`).
- La regla de ventana usa UTC; correcta ante cambios de horario (DST) del estudio.
