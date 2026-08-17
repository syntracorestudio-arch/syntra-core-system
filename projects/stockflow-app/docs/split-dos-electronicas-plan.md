# Pago dividido con DOS partes electrónicas (tarjeta + QR) — plan de construcción

> **APROBADO 2026-07-27, CON REEMBOLSO desde el arranque.** Sobre la base de Cobros
> Fase 2/3 + Pago dividido Paso 1/2/3 (PRs #180–#183). Money-critical: se construye con
> TDD y validación en sandbox real de MP ANTES de tocar plata de verdad.

## Alcance
Una venta con DOS patas electrónicas asíncronas: **tarjeta (posnet) + QR**, más efectivo.
Cada pata es un cobro MP independiente. La venta se registra **solo cuando las dos
acreditan**. Incluye el camino de **reembolso** para el caso "el cliente se fue con una
pata cobrada y la otra no".

## El problema central
Dos capturas independientes crean un estado que hoy no existe: **venta a medio cobrar**
(una pata acreditada, la otra no) = plata capturada sin venta completa. No se puede
evitar; se gestiona con **resumir** (cobrar la que falta) o **reembolsar** (devolver la
cobrada). Ese es el núcleo de riesgo del feature.

## Diseño

### Datos (migración 030)
- `payment_intents.split_group_id uuid` (nullable) — agrupa las patas de un mismo split.
  Índice parcial `(store_id, split_group_id) where split_group_id is not null`.
- `crear_intento_cobro_split` gana `p_group_id` (guarda el grupo en cada pata). El resto
  igual: cobra SU pata (`p_leg_amount`), guarda el reparto completo (`split_pagos`).
- Ampliar el CHECK de `payment_intents.status` con `'refunded'`.

### Cobro SECUENCIAL (la terminal es serie)
Reparto con tarjeta + QR → Confirmar → la caja genera un `group_id` y cobra en orden:
1. **Tarjeta** (débito/crédito → posnet) → acredita.
2. *"Ahora el QR"* → **QR** (terminal/pantalla) → acredita.
3. Recién ahí → registrar. Un cobro en dos pasos, orquestado client-side; el `group_id`
   liga las dos patas para la recuperación.

### Registro atómico + verificación de grupo (migración 030)
RPC `register_split_group(p_store_id, p_group_id, p_items, p_pagos, p_idempotency_key)`:
- Verifica que **TODOS** los intentos del grupo estén `approved` (todas las patas
  cobradas). Si falta una → `group_incomplete` (nunca registra una venta con una pata sin
  cobrar).
- Registra con `register_split_sale(..., p_paid=true)` y vincula los DOS intentos a la
  venta (`sale_id`). Idempotente por la clave compartida.

### Recuperación — "venta a medio cobrar" (migración 030 + UI)
- `grupos_a_medio_cobrar(store)`: grupos con ≥1 pata `approved`, sin venta, y NO todas
  acreditadas. Devuelve por grupo: patas cobradas (medio + monto) y patas pendientes.
- Banner nuevo en Caja (distinto del huérfano simple): *"Venta a medio cobrar: cobraste
  $X con tarjeta, falta $Y en QR"* con dos salidas:
  - **Cobrar lo que falta** (resumir): reabre el cobro de la pata pendiente con el MISMO
    `group_id` → al acreditar, `register_split_group`.
  - **Reembolsar y anular** (ver abajo).

### Reembolso (migración 030 + lib MP + acción)
- Lib: `mpReembolsarOrden(token, orderId)` → **API de reembolsos de MP** (verificar
  endpoint exacto: `POST /v1/orders/{id}/refund` vs `/v1/payments/{id}/refunds`), con
  idempotency-key propio. Devuelve la plata de una pata capturada.
- Acción `reembolsarGrupo(group_id)` (owner-only, como recuperarVenta): reembolsa cada
  intento `approved` del grupo, los marca `status='refunded'`, y cancela el grupo (sin
  venta). Registra qué se reembolsó (auditoría).
- Idempotencia dura: no reembolsar dos veces la misma pata (guardado por `status` +
  el idempotency-key del reembolso).

### Guardas de integridad (scale-security-baseline)
- Un grupo activo por caja a la vez (no dos ventas a medio cobrar mezcladas).
- Idempotencia por pata (misma clave → mismo intento) y por reembolso.
- Binding de monto por pata intacto (`intent.amount` = su pata).
- La venta NO existe hasta que el grupo cierra → cero venta fantasma.
- Cota: un grupo a medio cobrar vencido (>N horas) se marca para revisión del dueño.
- Lecturas de recuperación acotadas (7 días, como `cobros_sin_venta`).

## Sub-pasos de construcción (cada uno con TDD + gate)
1. **Grupo + cobro secuencial + registro verificado** — 030 (`split_group_id`,
   `register_split_group`, `crear_intento_cobro_split` con group_id), orquestación
   client-side de las dos patas, tests: grupo de 2 patas que acreditan → una venta;
   `group_incomplete` si falta una.
2. **Recuperación "resumir"** — `grupos_a_medio_cobrar` + banner de Caja + reabrir la
   pata pendiente. Tests: crash tras la pata 1 → estado a medio cobrar; resumir completa.
3. **Reembolso** — `mpReembolsarOrden` (validado en sandbox MP primero), `reembolsarGrupo`,
   el botón del banner, `status='refunded'`. Tests: reembolso de la pata cobrada → grupo
   anulado sin plata perdida; idempotencia (no doble reembolso).

## Riesgos y orden
El reembolso (paso 3) es el más riesgoso: mueve plata real, API nueva. Se construye
ÚLTIMO y se valida en sandbox de MP antes de habilitarlo. Los pasos 1–2 ya dan una venta
de dos electrónicas usable (con recuperación por "resumir"); el 3 cierra el caso del
cliente que se fue.

## Verificación (por sub-paso)
`tsc`/`lint`/`build` + los tests SQL nuevos + regresión de `verify-split*`. El reembolso:
prueba end-to-end en sandbox MP (cobrar dos patas, reembolsar una, verificar el estado y
que MP devolvió la plata) ANTES de merge. Gate visual del owner en cada UX nueva.
