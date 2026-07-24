# StockFlow — SPEC: Egresos (gastos operativos)

> **Estado:** Diseño + contrato **APROBADOS por el owner (2026-07-24)** con dos
> correcciones aplicadas: (1) toda novedad va en la migración nueva **018** — 009
> jamás se edita (regla aditiva: las migraciones viejas no se re-corren); (2) los
> gastos del período van en una función **aparte `reportes_expenses`** (patrón 017),
> y el neto lo computa el cliente. Este documento es autocontenido: define QUÉ se
> construye y cómo se verifica. NO hay código ni migraciones todavía. El modelo de
> datos vive en `docs/database.md` (§3, §7, §8), las reglas en
> `docs/business-rules.md` (§11) y los contratos RPC congelados en
> `docs/rpc-contracts.md`.
>
> Decisiones del owner (2026-07-24): **7 categorías con Mantenimiento** · neto **abajo
> del bruto** en Reportes (encadenado) · home con **nudge sin números** · corrección
> **solo anular + recargar** (append-only, sin edición).

---

## 1. El problema y la tesis

Hoy Reportes muestra "Ganancia sobre la mercadería" = **margen bruto** (venta −
costo de mercadería). No incluye alquiler, luz, sueldos, impuestos. Hay un caveat
literal que lo admite en `src/app/admin/reportes/reportes-client.tsx:325`
(`Margen X% · no incluye alquiler ni servicios`).

**Egresos** permite al dueño cargar esos costos operativos y ver la **ganancia NETA
real** = margen bruto − egresos del período. Es la diferencia entre "vendí bien" y
"me quedó plata".

---

## 2. Alcance (MVP)

- **Carga manual mensual** de gastos operativos. Sin recurrencia automática; el flag
  `is_recurring` es solo informativo.
- **Ganancia neta = margen bruto − egresos cargados**, imputados por `incurred_on`.
- **Set de categorías cerrado por CHECK** (7): `rent`, `utilities`, `salary`,
  `taxes`, `supplies`, `maintenance`, `other`. Labels castellanos: Alquiler ·
  Servicios · Sueldos · Impuestos · Insumos · Mantenimiento · Otros.
- **Solo-dueño**, reforzado por **RLS owner-only** (no solo UI).
- Corrección = **anular + recargar** (append-only puro, patrón `void_sale`). Sin
  edición in-place.

---

## 3. Entidades

Una sola tabla nueva: **`expenses`** (append-only, patrón header de `sales`). Campos,
constraints, índice y RLS congelados en `docs/database.md` §3/§7/§8. Puntos clave:

- `category text` CHECK cerrado — **el CHECK ES la garantía anti-doble-conteo**.
- `amount numeric(12,2) CHECK (> 0)`.
- `incurred_on date` = fecha de imputación al período (distinta de `created_at`).
- `is_recurring bool default false` — solo dato.
- `status ('active','voided')` + `voided_at/by/reason`. Nunca UPDATE de
  monto/categoría/fecha, nunca DELETE.

No hace falta nada más: el egreso no tiene efecto downstream que revertir (no mueve
stock ni fiado), es el registro mismo — por eso el void es flip de estado, no
contra-asiento.

### Regla crítica anti-doble-conteo (business-rules §11)

Las **compras de mercadería NO son egresos** y jamás pueden serlo: su costo ya
impacta el resultado por `stock_ledger(reason='purchase')` **y** por
`sale_items.unit_cost` en el margen bruto. Cargar una compra como gasto la restaría
dos veces. **No existe ni puede crearse una categoría 'mercadería'/'compras'** — el
set cerrado lo garantiza en la capa de datos.

---

## 4. Contratos RPC (congelados en rpc-contracts.md)

Todo en la **migración 018** (`018_gastos.sql`) — `reportes_summary` (009) **no se
toca**: 009 ya está aplicada y las migraciones viejas nunca se re-corren.

- **`register_expense(p_store_id, p_category, p_amount, p_incurred_on, p_note,
  p_is_recurring)`** → `expenses`. Owner-only (`not_allowed`). Valida
  `invalid_category` / `invalid_amount` / `invalid_date`. Inserta activo.
- **`void_expense(p_store_id, p_expense_id, p_reason)`** → `expenses`. Owner-only.
  `expense_not_found` si es de otro store; ya `voided` → idempotente. Flip a
  `voided`, nunca delete.
- **`reportes_expenses(p_store_id, p_from, p_to)`** → `{expenses,
  expenses_by_category, expenses_loaded_ever}`. Función **aditiva y aparte**, espejo
  de `reportes_medios` (017): piso de 24 meses + tz del negocio, agrega activos por
  `incurred_on`. La página la llama en el mismo `Promise.all` que las otras dos.
  **El neto lo computa el cliente** (`net = money.profit − expenses`), que ya tiene
  el bruto de `reportes_summary` y ya es dueño de la degradación honesta. Ver
  rpc-contracts.md para la forma exacta y las reglas de presentación.

---

## 5. Ubicación en el producto

**Nav:** grupo **"Control"** (hue terracota `#ec8d6f`, donde ya viven Fiado y
Reportes), orden **Fiado → Gastos → Reportes**. Label visible **"Gastos"** (modelo
mental del kiosquero; "egresos" es lenguaje de contador, queda como nombre interno de
la feature). Ícono Lucide `Receipt`. Ruta `/admin/gastos`, `requireOwner`.

**Lista (`/admin/gastos`):** agrupada por mes con total del mes en el header; cada
fila = categoría (label + ícono) · nota · monto · fecha · acción "Anular". Los
anulados se muestran atenuados con etiqueta "Anulado" (no se ocultan). Empty state con
arte de marca + CTA "Cargá tu primer gasto".

**Form (sheet/modal, owner-only):** select de categoría (7 chips/dropdown castellano),
monto (numérico grande `tabular`), selector de mes/fecha (default: mes actual), nota
opcional (sugerida si categoría = Otros), toggle "es un gasto fijo" (`is_recurring`,
informativo).

**Reportes — cambios exactos:**
1. Caveat `reportes-client.tsx:325` → de `· no incluye alquiler ni servicios` a
   `· antes de gastos fijos` (puntero hacia adelante, no callejón muerto).
2. **Bloque nuevo "Tu ganancia real"**, **DEBAJO** de la fila de heroes de la sección
   A ("La plata"): bruto − `expenses` = **neto** (número destacado, `success-ink` si
   positivo) + desglose por categoría (reusar patrón de barras/ranking existente).
3. Degradación honesta: `!expenses_loaded_ever` → tarjeta-CTA "Cargá tus gastos fijos
   para ver tu ganancia real →" que linkea a `/admin/gastos`, en vez del neto. Sin
   costos (`margin_pct` null) → manda el nudge de costos existente.

**Home del dueño (`/admin`):** en v1, **solo una nudge discreta sin números** ("Cargá
los gastos de este mes" si no hay ninguno cargado en el mes actual). El neto completo
vive en Reportes — no se mezcla un número mensual con las métricas de horizonte HOY
del dashboard.

---

## 6. Criterios de aceptación

**Cargar un egreso (dueño):** desde "Gastos" abre el form → categoría, monto,
mes/fecha (default mes actual), nota opcional → guarda → la fila aparece al tope del
mes, el total del mes sube por ese monto, y Reportes del mismo período muestra el
**neto bajando exactamente ese monto**. Categoría fuera del set: imposible (UI cerrada
+ CHECK + `invalid_category`).

**Ver el neto (dueño):** en Reportes, con egresos en el período → bloque "Tu ganancia
real" con bruto − gastos = neto y desglose por categoría; el caveat viejo ya no
existe. Sin egresos jamás → tarjeta-CTA, **nunca** un neto inflado = bruto.

**Anular un egreso (dueño):** acción "Anular" en la fila → **confirm** (cambia el
resultado de un período), razón opcional → la fila queda visible con etiqueta
"Anulado", el total del mes y el neto vuelven a subir; nada desaparece. Doble tap =
una sola anulación (idempotente). Anular un gasto de un mes pasado: **permitido**.

**El staff no ve nada:** "Gastos" ausente de su nav; `/admin/gastos` lo rechaza
(`requireOwner`); `register_expense`/`void_expense` con member staff → `not_allowed`;
`select` directo a `expenses` como staff → **0 filas** (RLS). Ningún número de
egreso/neto asoma en ninguna vista del staff.

---

## 7. Fuera de alcance (explícito)

Recurrencia automática (el flag `is_recurring` es solo dato) · comisiones de medios de
pago (posnet/MP — se autocalculan en fase futura, cargarlas a mano = doble conteo) ·
presupuestos/proyecciones/metas · adjuntar comprobantes/fotos · proveedores como
entidad · vínculo egreso ↔ cierre de caja / arqueo de efectivo (egresos son P&L, no
movimiento de caja en MVP) · multi-moneda · flujo de aprobación · neto del mes en el
home (solo nudge) · edición in-place · prefill "repetir gastos del mes pasado" (posible
v2 apoyado en `is_recurring`).

---

## 8. Archivos a tocar (fase de implementación — NO ahora)

**Migración (UNA sola, nueva — 009 no se toca):**
- `supabase/migrations/018_gastos.sql` — tabla `expenses` + índice + RLS owner-only
  + `register_expense` + `void_expense` + `reportes_expenses`. **El owner la corre en
  el SQL Editor** (como el resto). Numeración: 017 ya está tomada por
  `017_reportes_medios.sql`.

**App:**
- `src/components/shell/nav-data.tsx` — item "Gastos" en grupo Control (Fiado →
  Gastos → Reportes), ícono `Receipt`.
- `src/app/admin/gastos/page.tsx` + `gastos-client.tsx` (nuevos) — lista por mes +
  form de alta + acción anular. `requireOwner`.
- `src/app/admin/gastos/actions.ts` (nuevo) — server actions con Zod + rate-limit
  (baseline) que invocan las RPCs.
- `src/app/admin/reportes/reportes-client.tsx` — caveat línea 325 → puntero; bloque
  "Tu ganancia real" debajo de sección A; degradación honesta.
- `src/app/admin/reportes/page.tsx` — `reportes_expenses` como tercera RPC en el
  `Promise.all` existente; prop nueva al cliente.
- `src/app/admin/page.tsx` (home) — nudge condicional sin números.
- Tipos: tipo nuevo `ExpensesData` en `reportes-client.tsx` (espejo de `MediosData`);
  `ReportesData` no cambia.

**Docs (ya actualizados en esta fase):** `database.md` §3/§7/§8 · `business-rules.md`
§11 · `rpc-contracts.md` (register/void_expense + extensión + matriz de errores).

**Patrones a calcar:** `supabase/migrations/003_sale_rpcs.sql` (`rpc_member`,
`void_sale`, owner-only) · `008_caja_real_y_merma.sql` (`adjust_stock`) ·
`017_reportes_medios.sql` (cota de fecha, tz del store) · `join/actions.ts`
(rate-limit + Zod en la action).

---

## 9. Verificación end-to-end (gate de la implementación)

- **Impacto en el neto:** cargar egreso → aparece en la lista del mes, suma al total,
  y el neto de Reportes del período baja **exactamente** ese monto. Anular → neto
  vuelve al valor previo; fila `voided` visible.
- **Idempotencia del void:** doble `void_expense` → una sola anulación, misma
  respuesta.
- **Degradación honesta:** store sin egresos jamás → Reportes muestra CTA, **nunca**
  neto = bruto. Store con egresos históricos pero período vacío → neto con aclaración
  "sin gastos en este período". Sin costos (`margin_pct` null) → nudge de costos.
- **Anti-doble-conteo:** `register_purchase` no crea fila en `expenses` ni altera el
  neto salvo por el margen; no hay ruta (UI ni RPC) para cargar una compra como
  gasto; el CHECK rechaza cualquier categoría fuera del set.
- **Aislamiento RLS (bloqueante):** staff del mismo store → 0 filas en `select
  expenses` + "Gastos" ausente de nav + `/admin/gastos` rechazado + RPCs →
  `not_allowed`. Cross-tenant: owner de A no puede `register_expense` / `void_expense`
  / `select` sobre B → `not_a_member` / `expense_not_found` / 0 filas. Probar con
  impersonación JWT en psql (patrón de QA de RLS del proyecto).
- **Validaciones RPC:** `invalid_category`, `invalid_amount` (≤0), `invalid_date`
  (futuro / bajo el piso de 24 meses).
- **Regresión de Reportes:** `reportes_summary` queda intacta (cero riesgo por
  construcción — 018 no la toca); verificar que el resto de la pantalla no cambió y
  que el bloque nuevo degrada bien; QA a 1440 y 390.
- **Baseline (syntra-scale-security-baseline):** lectura de `expenses` con cota de
  fecha (índice `(store_id, incurred_on) where active`); action con rate-limit + Zod;
  owner-only en RPC y en página.
