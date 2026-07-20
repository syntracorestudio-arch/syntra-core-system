# StockFlow — Reglas de negocio

> **Estado:** Fase 0. Estas reglas gobiernan el modelo de datos y las RPCs. Cambiarlas
> después de la Fase 1B implica migración: discutir acá primero.

---

## 1. Stock

- **La verdad del stock es el ledger** (`stock_ledger`, append-only). `products.stock`
  es un cache denormalizado mantenido por trigger — existe para que el POS y la query
  de stock bajo sean instantáneos, jamás se escribe a mano.
- Motivos de asiento: `sale` (venta, delta negativo) · `purchase` (ingreso, positivo,
  con `unit_cost`) · `adjust` (corrección manual del owner, cualquier signo) ·
  `waste` (merma/vencido, negativo) · `return` (anulación de venta, positivo) ·
  `initial` (carga inicial).
- **Stock negativo permitido por default** (`allow_negative_stock = true`): la caja
  NUNCA se frena por un número del sistema — la realidad del mostrador manda. Si una
  venta deja stock < 0: warning en el POS + notificación (con dedupe) al dueño para
  que ajuste. Con el setting en `false`, la RPC rechaza con `insufficient_stock`
  (patrón cupo de StudioFlow).
- Anular una venta **no borra nada**: genera contra-asientos `return` y marca la
  venta `voided`. Nada se borra ni se edita en tablas transaccionales, nunca.

## 2. Precios, costos y margen

- `products.cost` = **último costo** de compra: cada ingreso lo pisa. Sin promedio
  ponderado — el criterio es explicable al kiosquero: "compraste a X, vendiste a Y".
- Cada línea de venta congela **snapshots**: `product_name`, `unit_price`,
  `unit_cost`. El margen histórico es exacto aunque el producto cambie o se archive.
- **Ganancia estimada** del dashboard = suma de (unit_price − unit_cost) × qty de las
  líneas con costo cargado. Si faltan costos, la UI lo dice ("cargá costos para ver
  tu margen") — degradar con honestidad, jamás inventar.
- **Remarcado masivo**: selección (global / por categoría) → +X% → preview → aplicar.
  Redondeo configurable (default: a $50 más cercano hacia arriba). Solo owner. Queda
  registrado quién y cuándo (auditoría).
- En el ingreso de mercadería, si el margen resultante queda por debajo del objetivo,
  la UI **sugiere** precio nuevo; nunca lo cambia sola.

## 3. Venta (POS)

- Toda venta pasa por la RPC atómica `register_sale` (ver `rpc-contracts.md`): una
  transacción que valida membresía, congela snapshots, inserta venta + líneas +
  asientos de ledger y actualiza el cache. **No existe otra vía de escritura.**
- **Idempotencia**: el cliente genera `idempotency_key` (uuid) al armar el carrito;
  reintento por corte de red = la misma venta, nunca dos.
- Medios de pago MVP (dato, sin integración): `cash` · `qr` · `card` · `transfer` ·
  `account` (fiado). MercadoPago real en Fase 2 sobre el mismo modelo.
- Venta por **monto libre** (sin producto): línea especial sin product_id, sin
  movimiento de stock. Es la válvula de escape que evita volver a la calculadora.
- Override de precio en línea: solo owner (o staff con `can_apply_discount`).
- Anulación (`void_sale`): solo owner o staff con `can_void_sale`; si la venta era
  fiada, también revierte el asiento del cliente.

## 4. Fiado (cuenta corriente)

- **La verdad es `client_ledger`** (append-only): venta fiada = delta negativo;
  pago = delta positivo; `adjust` solo owner. Saldo = SUM(delta), vista
  `client_balances`. Sin contador mutable.
- Pagos **parciales** siempre permitidos, con medio de pago propio (un pago de fiado
  en efectivo entra en el cierre de caja del día que se cobró).
- `credit_limit` opcional por cliente: al superarlo el POS **avisa, no bloquea** —
  la decisión de fiar es del que atiende el mostrador. El dueño recibe push si un
  cliente queda sobre su límite.
- Cliente se crea desde el POS en el momento de fiar (nombre + teléfono, 2 campos).
- Staff necesita `can_sell_on_credit` para fiar y para registrar pagos de fiado.

## 5. Vencimientos (sin lotes)

- El MVP **no gestiona lotes**: al ingresar mercadería se puede cargar "vence el
  ___" → fila informativa en `stock_expiries` (fecha + cantidad). Cero fricción si
  no se carga; valor completo si se carga.
- En caja **nunca** se elige lote ni se valida vencimiento: la venta no se frena.
- Alerta push al dueño a `expiry_warning_days` (default 7) de la fecha.
- Resolver una alerta = 1 tap: **"se vendió"** (marca `resolved_at`) o **"tirar"**
  (marca `resolved_at` + asiento `waste` por la cantidad restante indicada).
- Un vencimiento vencido no desaparece solo: pide acción del dueño; la merma queda
  en reportes (plata perdida visible = argumento de venta del producto).

## 6. Roles y permisos

- Roles por negocio en `members.role`: `owner` · `staff`. Un profile puede tener
  roles distintos en negocios distintos (N:N, patrón StudioFlow).
- Flags de permiso del staff (columnas en `members`, default todos `false` salvo
  venta): `can_sell_on_credit` · `can_apply_discount` · `can_void_sale` ·
  `can_receive_stock` · `can_see_costs`.
- **`can_see_costs = false` oculta costo/margen/ganancia en toda la UI del staff**
  (guard por página + omisión de campos en queries de UI). Limitación asumida y
  documentada: RLS es por fila, no por columna; si un cliente exige aislamiento duro
  de costos, se parte tabla en fase futura.
- Reportes, config, equipo, remarcado y anulaciones: owner (salvo flag explícito).
- Superadmin SYNTRA = `profiles.is_superadmin` (desde 001), panel en fase final.

## 7. Cierre de caja

- MVP: el cierre es **derivado** — total del día/turno por medio de pago + fiado
  otorgado + nº de ventas, calculado de `sales` por rango horario (vista
  `daily_totals`). Conteo de efectivo opcional con diferencia visible solo owner.
- Sin apertura/arqueo formal: no bloquea la venta del día siguiente (auto-corte por
  fecha). Tabla real de sesiones de caja recién en Fase 2 si aparece multi-caja.

## 8. Notificaciones ("el sistema trabaja solo")

- **Push real** (Web Push, patrón StudioFlow 029): stock bajo (umbral por producto o
  default del negocio) · vence pronto · resumen del día (21:00 ART) · fiado sobre
  límite. Digest diario por Vercel Cron + disparos inmediatos post-venta.
- **Dedupe obligatorio**: `dedupe_key` diaria por evento (nunca dos push iguales el
  mismo día). Suscripciones muertas (404/410) se limpian solas.
- Toda notificación push tiene su espejo in-app (tabla `notifications`).

## 9. AFIP / fiscal (hooks, sin funcionalidad)

- El MVP emite **tickets internos no fiscales** (comprobante en pantalla).
- Hooks en el modelo para no migrar después: `stores.cuit` (nullable),
  `stores.fiscal jsonb` (punto de venta, condición IVA), `sales.fiscal jsonb`
  (tipo/número de comprobante). Ninguna lógica los usa en MVP.

## 10. Multi-vertical (preparado, no construido)

- `products.sale_unit` (default `'unit'`) y `products.attrs jsonb` dejan lugar a
  granel/pesables (dietética) y atributos por rubro (pet shop) sin migración
  estructural. `stock_ledger.delta` es `numeric` (no int) por la misma razón.
