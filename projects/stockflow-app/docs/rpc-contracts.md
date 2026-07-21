# StockFlow — Contratos de RPCs atómicas

> **Estado:** Fase 0 · Estos contratos se congelan ANTES de escribir el SQL (lección
> StudioFlow: sus RPCs se parcharon en 4 migraciones por diseñarlas sobre la marcha).
> Todas: `SECURITY DEFINER`, `set search_path = public`, owner postgres, GRANT
> explícito a `authenticated` (salvo indicación), errores por `raise exception` con
> código de texto estable que la UI traduce.

Convenciones comunes:
- Primer paso SIEMPRE: resolver el `member` activo del caller en el store
  (`profile_id = auth.uid() and store_id = p_store_id and status = 'active'`) →
  si no existe: `not_a_member`. Anti cross-tenant (patrón `reserve_class`).
- Locking: `SELECT ... FOR UPDATE` de filas de products **ordenado por id**
  (anti-deadlock con ventas concurrentes de carritos solapados).
- Nada de deletes: anulaciones = contra-asientos.

---

## register_sale — la RPC reina (tanda 1C, migración 003)

```
register_sale(
  p_store_id        uuid,
  p_items           jsonb,   -- [{product_id: uuid|null, qty: numeric>0,
                             --   unit_price: numeric|null,  -- override, permiso
                             --   free_amount: numeric|null, -- venta por monto libre
                             --   name: text|null}]          -- etiqueta del monto libre
  p_payment_method  text,    -- cash | qr | card | transfer | account
  p_client_id       uuid default null,   -- obligatorio si account
  p_idempotency_key text     -- uuid generado client-side al armar el carrito
) returns sales
```

Flujo (1 transacción):
1. Member activo (`not_a_member`). Si `payment_method='account'` y el member no es
   owner ni tiene `can_sell_on_credit` → `not_allowed`.
2. **Idempotencia**: intento de insert de `sales` con `(store_id, idempotency_key)`;
   si unique_violation → devolver la venta existente (misma respuesta, cero efectos).
3. Validar items: vacío → `empty_items`; qty <= 0 → `invalid_qty`; producto
   inexistente/de otro store → `product_not_found`; archivado → `product_archived`;
   `unit_price` override sin permiso (`can_apply_discount`/owner) → `not_allowed`.
4. `SELECT ... FOR UPDATE` de los products del carrito **ordenados por id**.
5. Insertar `sales` + `sale_items` con snapshots (`product_name`, `unit_price`
   efectivo, `unit_cost` = products.cost actual, `line_total`); líneas de monto
   libre sin product_id y sin ledger.
6. Asientos `stock_ledger (delta = -qty, reason 'sale', sale_id)` por línea con
   producto; trigger actualiza `products.stock`.
7. Si `allow_negative_stock = false` y algún stock resultante < 0 →
   `insufficient_stock` (con product_id en el mensaje) y rollback total.
8. Si `account`: `p_client_id` null → `client_required`; cliente de otro store →
   `client_not_found`; asiento `client_ledger (delta = -total, reason 'sale',
   sale_id)`. Si el saldo resultante supera `credit_limit` seteado: **la venta pasa
   igual** y se devuelve `over_limit = true` en el registro (el aviso es del POS +
   push; regla: avisar, no bloquear).
9. Devuelve la fila de `sales`.

Post-venta (fuera de la RPC, server action): si algún producto quedó bajo umbral →
notificación + push con `dedupe_key` diaria; fire-and-forget.

## register_purchase — ingreso de mercadería (tanda 1C, migración 003)

```
register_purchase(
  p_store_id uuid,
  p_items    jsonb  -- [{product_id, qty>0, unit_cost>=0, expiry_date: date|null}]
) returns int        -- líneas aplicadas
```

1. Member activo + (`owner` o `can_receive_stock`) → si no `not_allowed`.
2. Por línea: validar producto del store; asiento `stock_ledger (delta=+qty,
   'purchase', unit_cost)`; **pisar `products.cost` = unit_cost** (regla último
   costo); si `expiry_date` → fila en `stock_expiries (qty, fecha)`.
3. Sin idempotency_key (operación de baja frecuencia, formulario con confirm);
   revisar en QA 1C si el retry móvil lo exige — si sí, mismo patrón que sale.

## void_sale — anulación (tanda 1C, migración 003)

```
void_sale(p_store_id uuid, p_sale_id uuid, p_reason text default null) returns sales
```

1. Member activo + (`owner` o `can_void_sale`) → `not_allowed`.
2. `FOR UPDATE` de la venta; de otro store → `sale_not_found`; ya `voided` →
   idempotente (devolver tal cual).
3. Contra-asientos `stock_ledger (delta=+qty, 'return', sale_id)` por línea con
   producto; si era `account`: contra-asiento `client_ledger (delta=+total,
   'adjust', sale_id, note 'anulación')`.
4. `status='voided'`, `voided_at/by`, `void_reason`. Nunca delete.

## adjust_stock — corrección manual (tanda 1C, migración 003)

```
adjust_stock(p_store_id uuid, p_product_id uuid, p_delta numeric<>0,
             p_reason text,   -- 'adjust' | 'waste' | 'initial'
             p_note text default null) returns numeric  -- stock resultante
```
Solo owner (`not_allowed`). Asiento directo con el motivo dado. `waste` con delta
positivo → `invalid_delta`.

## register_client_payment — pago de fiado (tanda 1C, migración 004)

```
register_client_payment(p_store_id uuid, p_client_id uuid,
                        p_amount numeric>0, p_payment_method text, -- cash|qr|card|transfer
                        p_note text default null) returns numeric  -- saldo resultante
```
1. Member activo + (`owner` o `can_sell_on_credit`) → `not_allowed`.
2. Cliente del store → `client_not_found`. Monto <= 0 → `invalid_amount`.
   **Pago mayor que la deuda permitido** (queda a favor; delta positivo lo modela solo).
3. Asiento `client_ledger (delta=+amount, 'payment', payment_method)`. Devuelve
   SUM(delta) actualizado.

## resolve_expiry — resolver vencimiento (tanda 1F, migración de la tanda)

```
resolve_expiry(p_store_id uuid, p_expiry_id uuid,
               p_resolution text,          -- 'sold' | 'wasted'
               p_waste_qty numeric default null) returns void
```
Owner o `can_receive_stock`. Ya resuelto → idempotente. `wasted` → asiento `waste`
por `coalesce(p_waste_qty, qty)`.

## bulk_reprice — remarcado masivo (tanda 1E, migración de la tanda)

```
bulk_reprice(p_store_id uuid, p_category_id uuid default null,  -- null = todo
             p_pct numeric,           -- +12.5 = +12,5% (negativo permitido)
             p_rounding numeric default null) -- null = setting del store
returns int  -- productos actualizados
```
Solo owner. Actualiza `price` de products activos del alcance con redondeo
(default: múltiplo de `reprice_rounding` hacia arriba), setea `price_updated_at`,
inserta notificación de auditoría ("remarcaste N productos +X%"). La preview la
hace la UI (misma fórmula, client-side, sin RPC).

## create_store — alta de negocio (tanda 1C)

```
create_store(p_name text, p_slug text, p_owner_profile uuid) returns stores
```
`stores` no tiene policy de INSERT y `members` exige ser ya owner → un usuario nuevo
no puede crearse un negocio solo. Es **deliberado**: el onboarding es un acto de
SYNTRA, no self-service. Esta RPC (invocada con `service_role` desde una action de
alta) crea el store, su fila de settings (la pone el trigger) y el `members` owner
en una transacción. Hasta que exista, los negocios se dan de alta por seed.

## check_rate_limit — baseline (tanda 1B, migración 001/002)

Clon del contrato StudioFlow 033: `check_rate_limit(p_key text, p_max int,
p_window interval) returns bool`, **fail-open**, GRANT a `authenticated` y `anon`
(login/alta). Toda action pública o sensible la llama primero.

---

## Matriz de errores

| Código | RPCs | UI |
| --- | --- | --- |
| `not_a_member` | todas | sesión inválida → re-login |
| `not_allowed` | todas | "No tenés permiso para esta acción" |
| `empty_items` / `invalid_qty` / `invalid_amount` / `invalid_delta` | sale, purchase, payment, adjust | validación de formulario (no debería llegar: Zod primero) |
| `product_not_found` / `product_archived` | sale, purchase | "Producto no disponible" + refrescar catálogo |
| `insufficient_stock` | sale (solo modo estricto) | "Sin stock de ‹producto›" |
| `client_required` / `client_not_found` | sale, payment | selector de cliente |
| `sale_not_found` | void | refrescar lista |

QA de la tanda 1C (gate): N `register_sale` concurrentes sobre el mismo producto ⇒
ledger suma exacta y cache consistente; mismo `idempotency_key` en paralelo ⇒ UNA
venta; venta fiada + void ⇒ saldo del cliente vuelve al original; cross-tenant ⇒
`not_a_member`/`product_not_found` siempre.
