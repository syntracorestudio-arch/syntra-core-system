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
  p_idempotency_key text,    -- uuid generado client-side al armar el carrito
  p_client_id       uuid default null   -- obligatorio si account
) returns jsonb
```

> **Implementado en 003 (2026-07-21) con dos ajustes sobre este contrato:**
> 1. `p_idempotency_key` va ANTES de `p_client_id`: el primero es obligatorio y el
>    segundo tiene default, así que el orden inverso no compila.
> 2. Devuelve **jsonb**, no la fila de `sales`. El POS necesita tres cosas que la
>    tabla no tiene: `over_limit` (fiado sobre el límite), `negative_stock` (qué
>    productos quedaron en rojo, para avisar) y `replayed` (si fue un reintento).
>    Forma: `{sale_id, total, replayed, over_limit, client_balance, negative_stock}`.

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

## register_expense — cargar un gasto operativo (feature Egresos, migración 018)

```
register_expense(
  p_store_id     uuid,
  p_category     text,          -- rent|utilities|salary|taxes|supplies|maintenance|other
  p_amount       numeric,       -- > 0
  p_incurred_on  date,          -- fecha de imputación al período
  p_note         text default null,
  p_is_recurring boolean default false   -- solo dato informativo
) returns expenses
```

1. Member activo (`not_a_member`). **Owner-only**: si el member no es `owner` →
   `not_allowed` (el staff nunca carga ni ve gastos; patrón `adjust_stock`).
2. Validaciones (defensa en profundidad, además del CHECK y de Zod client-side):
   categoría fuera del set → `invalid_category`; `p_amount <= 0` → `invalid_amount`;
   `p_incurred_on` en el futuro o por debajo del piso de 24 meses (coherente con la
   cota de lectura de reportes) → `invalid_date`.
3. Insert en `expenses` (`status='active'`, `created_by` = member). Devuelve la fila.
4. **NUNCA** una categoría de mercadería/compra: el CHECK la rechaza en la capa de
   datos y la UI no la ofrece (regla anti-doble-conteo, business-rules §11).

## void_expense — anular un gasto (feature Egresos, migración 018)

```
void_expense(p_store_id uuid, p_expense_id uuid, p_reason text default null)
  returns expenses
```

1. Member activo + **owner** → si no `not_allowed`.
2. `FOR UPDATE` de la fila; de otro store / inexistente → `expense_not_found`; ya
   `voided` → **idempotente** (devolver tal cual, cero efectos).
3. `status='voided'`, `voided_at/by`, `void_reason`. Nunca UPDATE de
   monto/categoría/fecha, nunca DELETE. La fila queda visible tachada.

## reportes_expenses — gastos del período para Reportes (migración 018)

```
reportes_expenses(p_store_id uuid, p_from date, p_to date) returns jsonb
```

Función **ADITIVA y APARTE**, espejo exacto del patrón `reportes_medios` (017):
`reportes_summary` NO se toca (009 ya está aplicada y las migraciones viejas nunca
se re-corren — regla aditiva del proyecto). La página de Reportes la llama en el
mismo `Promise.all` que las otras dos.

1. `perform rpc_member(p_store_id)` → `not_a_member`. (La página ya es
   `requireOwner`; RLS de `expenses` es owner-only además.)
2. Timezone del store + **piso de 24 meses** sobre `p_from` (baseline, igual que
   009/017).
3. Agrega `expenses` con `status = 'active'` e `incurred_on between p_from and p_to`
   (por `incurred_on`, NUNCA `created_at`: es fecha de imputación).

```
returns: {
  expenses:             numeric,      -- Σ activos del período
  expenses_by_category: [{category, total}],  -- desc por total; solo categorías con gasto
  expenses_loaded_ever: boolean       -- ¿existe algún expense activo en el store (cualquier fecha)?
}
```

**`net_profit` NO viene de SQL: lo computa la página/cliente de Reportes** —
`net = money.profit − expenses` — que ya tiene el bruto de `reportes_summary` y ya
es dueña de las reglas de degradación honesta:
- `margin_pct === null` → sin costos: manda el nudge de costos existente (no hay neto).
- costos OK **y** `!expenses_loaded_ever` → tarjeta-CTA "Cargá tus gastos fijos para
  ver tu ganancia real" (NUNCA mostrar un neto = bruto).
- costos OK **y** `expenses_loaded_ever` → bloque "Tu ganancia real": bruto −
  `expenses` = neto + desglose `expenses_by_category`. Si `expenses === 0` en el
  período: aclaración "sin gastos imputados a este período".
- El caveat de `reportes-client.tsx:325` ("· no incluye alquiler ni servicios") se
  reemplaza por el puntero "· antes de gastos fijos".

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

## producto_por_codigo — resolver de escaneo (escala Fase 1, migración 034)

> **Contrato CONGELADO antes del SQL** (2026-07-28). Cierra el RIESGO 0 de
> `docs/inventario-escala-audit.md`: hasta ahora el escaneo resolvía contra el array
> precargado en el cliente (`limit(500)` alfabético), así que un producto más allá del
> corte **no se encontraba** y el cajero terminaba dando de alta un DUPLICADO.

```
producto_por_codigo(
  p_store_id uuid,
  p_codigo   text     -- código de barras EXACTO (se compara trim(), sin ilike)
) returns jsonb
```

- **Gate de miembro**: primer paso `public.rpc_member(p_store_id)` → `not_a_member`.
  `SECURITY DEFINER`, `set search_path = public`, `stable`, GRANT a `authenticated`.
- **Acotada por construcción**: devuelve **una fila o `null`**. El lookup va por
  `product_barcodes (store_id, barcode)`, que **ya es UNIQUE** (`001:136`) — o sea el
  índice que la sirve ya existe; no se crea ninguno nuevo.
- **Devuelve** (o `null` si no hay match): el producto tal como lo consume la caja —
  `{id, name, emoji, color, price, stock, category_id, category_name, barcodes[]}`.
  Incluye `archivado` (bool) para que la UI distinga "no existe" de "existe pero está
  dado de baja" (hoy ese caso también caía en alta rápida).
- **No filtra por `status`**: un producto archivado SÍ se resuelve, marcado. Decidir
  qué hacer es de la UI; lo que no puede pasar es que la caja crea que no existe.
- No muta nada. No toca `sales` / `payment_intents` / RPCs de cobro.

## quickCreateProduct — guarda anti-duplicado + categoría (escala Fase 1)

Cambios de contrato de la server action (no es RPC de Postgres):

- **Guarda server-side (cinturón y tiradores, aun con `producto_por_codigo`)**: si viene
  `barcode` y ese código YA existe en el store, **NO crea nada** y devuelve el producto
  existente con `existing: true`. Hoy el insert del código falla contra el UNIQUE y **el
  error no se chequea** (`pos/actions.ts:282`) → quedaba un producto duplicado, con stock
  0 y sin código, para siempre.
- **`category_id` opcional** (`z.guid().nullable().optional()`): el alta rápida ahora
  puede asignar una categoría **existente**. Sin creación inline de categorías — eso es
  Fase 2, junto con el índice único de de-duplicación.
- Resultado: `{ ok: true, id, name, price, existing?: boolean } | { ok: false, error }`.

## productos_buscar / pos_destacados / clientes_buscar — search-first (escala Fase 2, migración 035)

> **Contratos CONGELADOS antes del SQL** (2026-07-29). Fase 2 de
> `docs/inventario-escala-audit.md`. **El objetivo es el PAYLOAD**: hoy el POS manda
> 477 KB de documento (500 productos + ~5000 `sale_items` para rankear + ~1750 códigos +
> ~300 clientes) y Productos manda 772 KB. El ranking, la búsqueda y el filtro pasan al
> servidor; el cliente deja de recibir el catálogo.

### productos_buscar — búsqueda + paginación server-side

```
productos_buscar(
  p_store_id  uuid,
  p_q         text default null,   -- nombre (contiene, sin acentos) O código (empieza con)
  p_categoria uuid default null,   -- filtro por categoría; null = todas
  p_limit     int  default 50,     -- CLAMP duro 1..100
  p_offset    int  default 0       -- CLAMP >= 0
) returns jsonb
```

- **Gate**: `rpc_member` → `not_a_member`. `SECURITY DEFINER`, `stable`, GRANT `authenticated`.
- **Acotada**: `p_limit` se clampea a 100 pase lo que pase. Devuelve
  `{ items: [...], total: <int>, limit, offset }` — `total` es el conteo REAL del filtro
  (para paginar y para no volver a mentir en los contadores).
- **Semántica de búsqueda** (deliberada, y documentada porque define qué índice sirve):
  - **nombre**: *contiene*, insensible a mayúsculas **y a acentos**, vía
    `unaccent_simple(name) like '%q%'`. Mantiene el comportamiento que ya tenía la
    búsqueda en memoria (`includes`) y **arregla** que era sensible a acentos. Un `like
    '%…%'` no usa índice: el scan queda acotado al catálogo de UN negocio (~10³ filas),
    que es barato. Si algún día no alcanza, la salida es `pg_trgm` (Fase 4 del audit).
  - **código**: *empieza con* (`barcode like 'q%'`), que **sí** usa el índice único
    `product_barcodes (store_id, barcode)` (001:136). Es lo que hace un cajero: tipea el
    código desde el principio. El escaneo exacto sigue yendo por `producto_por_codigo`.
- Solo `status='active'`. Orden: por ritmo de venta 14d desc, y alfabético como desempate.
- Índice nuevo: **ninguno**. Los dos que hacen falta ya existen
  (`products_name_idx (store_id, lower(name))` y el UNIQUE de barcodes).
- **Enmienda al congelar → implementar (2026-07-29):** cada ítem trae también
  `vendidas_30d`. El listado del dueño muestra cobertura ("te dura 6 días") con ventana
  de **30 días**, mientras que el orden usa 14d. Se calcula **solo sobre la página ya
  recortada** (≤100 filas), no sobre todo el filtro — así no se paga un agregado de 30
  días sobre el catálogo entero para pintar 50 renglones.

### pos_destacados — tiles curados, rankeados en la BASE

```
pos_destacados(
  p_store_id uuid,
  p_limit    int default 24        -- CLAMP duro 1..60
) returns jsonb
```

- **Gate** + `SECURITY DEFINER` + `stable` + GRANT `authenticated`.
- Devuelve el set CHICO que la caja pinta como tiles: los más vendidos de los últimos
  14 días (**el ranking se calcula en Postgres**, no en el cliente), y si el negocio no
  tiene ventas todavía cae a los que tienen precio y stock, alfabético — un kiosco nuevo
  no puede ver una grilla vacía.
- Cada ítem trae **sus códigos de barras** para que el caché local siga resolviendo el
  escaneo de un top-seller **sin round-trip** (cobro <15 s intacto). Todo lo demás lo
  resuelve `producto_por_codigo` (Fase 1) — que **no se toca**.
- Ventana de 14 días fija: cota de fecha del baseline.

### clientes_buscar — fiado bajo demanda

```
clientes_buscar(p_store_id uuid, p_q text default null, p_limit int default 20) returns jsonb
```

- **Gate** + `stable` + GRANT `authenticated`. `p_limit` clamp 1..50.
- Reemplaza el precargado de ~300 clientes en el POS: la lista se pide **recién cuando el
  cajero elige "Fiado"**. Devuelve `{id, name, owed, credit_limit}` desde `client_balances`.

### Lo que DEJA de viajar al cliente (la aceptación de Fase 2)

| Precarga | Antes | Después |
| --- | --- | --- |
| `products` | 500 filas | los tiles curados (24) |
| `sale_items` (ranking) | ~5000 filas | **0** — el ranking se calcula en la RPC |
| `product_barcodes` | ~1750 filas | solo los de los tiles curados |
| `client_balances` | ~300 filas | **0** — se piden al abrir Fiado |

## categorias_resumen — agregado de categorías (chips + drill-down, migración 036)

> **Contrato CONGELADO antes del SQL** (2026-07-29). Fase 2 visual del audit
> (`inventario-escala-audit.md` §C1-C3). Es la ÚNICA fuente de verdad de los contadores
> de categoría: el chip ("Golosinas 34"), el sheet de "Más" y el índice del drill-down
> (PR2) leen TODOS de acá. **Nunca** se cuenta sobre un subset cargado en el cliente —
> ese era el bug de diseño que hacía imposible un contador correcto con catálogo grande.

```
categorias_resumen(p_store_id uuid) returns jsonb
-- {
--   categorias: [{ id, name, emoji, color, sort,
--                  productos, stock_bajo, sin_costo, vendidas_14d }],
--   sin_categoria: { productos, stock_bajo, sin_costo }   -- la deuda, SIEMPRE visible
-- }
```

- **Gate**: `rpc_member` → `not_a_member`. `SECURITY DEFINER`, `stable`, GRANT `authenticated`.
- **Acotada**: máx **100 categorías** (por `sort`); solo productos `status='active'`;
  `vendidas_14d` con ventana fija de 14 días (cota de fecha del baseline).
- `stock_bajo` usa la MISMA definición que la vista `low_stock_products` (umbral propio
  o default del negocio) — un contador que no coincide con la alerta es un contador roto.
- Orden de uso: el POS ordena por `vendidas_14d`; Productos por `productos`. El orden lo
  decide el caller; la RPC devuelve los datos crudos por `sort`.

### productos_buscar — enmienda (misma migración 036)

Se agrega `p_solo_sin_categoria boolean default false`: filtra `category_id is null`
(el bucket "Sin categoría" del sheet y del índice es seleccionable). Con `true`,
`p_categoria` se ignora. Drop + create por cambio de firma; los callers de 5 args usan
argumentos nombrados y no se ven afectados.

## Cotas del baseline aplicadas a funciones existentes (migración 034)

Se **redefinen** (nunca se editan las migraciones viejas):

| Función | Origen | Cota agregada |
| --- | --- | --- |
| `store_alerts` | 006 | `LIMIT` en `low_stock` y en `expiring` |
| `dashboard_summary` | 027 | `LIMIT` en `restock` |
| `reportes_summary` | 009 | `LIMIT` en `by_category` |

Ninguna cambia su **firma** ni la forma del JSON que devuelve: solo dejan de serializar
listas sin techo. Aditivo y seguro de re-aplicar.

---

## Matriz de errores

| Código | RPCs | UI |
| --- | --- | --- |
| `not_a_member` | todas | sesión inválida → re-login |
| `not_allowed` | todas | "No tenés permiso para esta acción" |
| `empty_items` / `invalid_qty` / `invalid_amount` / `invalid_delta` | sale, purchase, payment, adjust, expense | validación de formulario (no debería llegar: Zod primero) |
| `invalid_category` / `invalid_date` | register_expense | validación de formulario (no debería llegar: Zod + set cerrado primero) |
| `product_not_found` / `product_archived` | sale, purchase | "Producto no disponible" + refrescar catálogo |
| `insufficient_stock` | sale (solo modo estricto) | "Sin stock de ‹producto›" |
| `client_required` / `client_not_found` | sale, payment | selector de cliente |
| `sale_not_found` | void_sale | refrescar lista |
| `expense_not_found` | void_expense | refrescar lista |

QA de la tanda 1C (gate): N `register_sale` concurrentes sobre el mismo producto ⇒
ledger suma exacta y cache consistente; mismo `idempotency_key` en paralelo ⇒ UNA
venta; venta fiada + void ⇒ saldo del cliente vuelve al original; cross-tenant ⇒
`not_a_member`/`product_not_found` siempre.

---

# Promociones (migración 045)

> **Contrato CONGELADO antes del SQL** (2026-08-07). Plan aprobado:
> `docs/promociones-plan.md`. Una promo = **precio rebajado con fecha de fin sobre
> UN producto**, opcionalmente atado a un vencimiento, que **la caja cobra sola**.

## La regla que ordena todo: el precio de promo lo resuelve el SERVIDOR

El POS **nunca** manda el precio de promo. No es estilo, es obligatorio:

1. **Permisos.** Un `unit_price` enviado por el cliente exige `owner` o
   `can_apply_discount` (`027:180-187`). Si la promo viajara por ahí, **todo
   empleado sin ese flag recibiría `not_allowed` al vender un producto en promo**.
   La promo y el descuento manual son cosas distintas y no comparten permiso.
2. **Confianza.** El cliente no puede ser la autoridad del precio.

Las **cuatro** RPCs que exponen precio resuelven con `promo_precio()`:
`register_sale` (cobra) · `pos_destacados` (tiles) · `productos_buscar` (búsqueda)
· `producto_por_codigo` (escaneo). Misma función en cuatro lugares, cero lógica
de precio en el cliente.

## `promos` — la entidad

```
promos(
  id, store_id, product_id,
  promo_price   numeric(12,2),   -- < list_price, >= 0
  list_price    numeric(12,2),   -- products.price CONGELADO al crear
  cost_at_start numeric(12,2),   -- products.cost congelado (para medir después)
  starts_on, ends_on date,
  expiry_id     uuid null,       -- ligadura opcional a stock_expiries
  origin        text,            -- 'manual' | 'sugerida'
  below_cost_ok boolean,
  ended_at      timestamptz null,
  ended_reason  text null        -- 'manual' | 'vencimiento' | 'reemplazo'
)
```

**No hay columna `status`: el estado se DERIVA de las fechas.**

| Estado | Condición |
| --- | --- |
| terminada | `ended_at is not null` **o** `ends_on < current_date` |
| activa | no terminada **y** `starts_on <= current_date <= ends_on` |
| programada | no terminada **y** `starts_on > current_date` |

Esto es lo que cumple **"no zombie promos" sin un cron**: pasada `ends_on` la
promo deja de existir para la resolución de precio sin que nadie la marque.
`ended_at` existe solo para el fin **anticipado**.

## `promo_precio(p_store_id, p_product_id) returns numeric` — `stable`

Precio efectivo: el de la promo activa hoy, o `products.price`. Una sola
definición de la regla, consumida por las cuatro RPCs de arriba.
`promo_vigente(p_store_id, p_product_id) returns public.promos` devuelve la fila
completa cuando hace falta también el `list_price` (tachado) y el `promo_id`.

## `create_promo` — **owner-only**

```
create_promo(
  p_store_id uuid, p_product_id uuid, p_promo_price numeric,
  p_starts_on date, p_ends_on date,
  p_expiry_id uuid default null, p_origin text default 'manual',
  p_below_cost_ok boolean default false, p_reemplazar boolean default false
) returns jsonb   -- {promo_id, replaced_promo_id, estado}
```

1. `v_member.role <> 'owner'` → `not_allowed`.
2. Producto del store y `status='active'` → si no, `product_not_found`.
3. `p_ends_on >= p_starts_on` y `p_starts_on >= current_date` → si no, `invalid_range`.
4. `p_promo_price >= 0` y `< products.price` → si no, `invalid_amount`.
5. **Piso de costo**: `p_promo_price < products.cost` y no `p_below_cost_ok` →
   `below_cost`. El opt-in es del **owner**, nunca del algoritmo.
6. Lock de la fila del producto (`for update`, mismo patrón anti-deadlock que
   `register_sale`); si hay promo viva **solapada** → `promo_overlap`, salvo
   `p_reemplazar` → cierra la anterior con `ended_reason='reemplazo'`.
7. Congela `list_price = products.price` y `cost_at_start = products.cost`.

## `end_promo(p_store_id, p_promo_id) returns jsonb` — **owner-only**

`ended_at = now()`, `ended_reason = 'manual'`. **Idempotente**: si ya estaba
terminada devuelve el estado sin error. Devuelve `vuelve_a` (el precio al que
vuelve) para el copy `Terminar · vuelve a $1.800`.

## `promos_listado(p_store_id) returns jsonb`

Activas / programadas / terminadas, **terminadas acotadas a 30 días**
(cota de fecha obligatoria — baseline de escala). Cada una con su atribución:

| Cifra | Cómo |
| --- | --- |
| Unidades vendidas en promo | `sum(qty) where promo_id = X` |
| Ganancia recuperada | `sum((unit_price - unit_cost) * qty)` |
| **Lo que te costó** | `sum((list_price - unit_price) * qty)` — se muestra SIEMPRE |

Costos solo si `owner or can_see_costs`.

## `promos_sugeridas(p_store_id) returns jsonb`

Motor **determinista**, sin LLM. `ritmo_actual = vendidas 14d / 14` ·
`ritmo_necesario = stock / días_hasta_vencer`. Si `ritmo_actual >=
ritmo_necesario` **no sugiere nada** (se agota solo; descontarlo sería regalar
margen). Escalera por urgencia (>7d: −15% · 4-7: −25% · 2-3: −35% · ≤1: −50% o
piso), pisos `min_margin_pct` → costo → bajo costo solo con opt-in, redondeo con
`round_price` + `store_settings.reprice_rounding`.

**La escalera es una tabla de política, no una optimización.** El sistema puede
calcular que al ritmo actual **no se vende**; NO puede saber que con −30% sí. La
UI dice el ritmo que haría falta, nunca "vas a vender los 8".

## Cambios a RPCs existentes

- **`register_sale`** — copia literal de `027` con **un** cambio: la resolución de
  `027:189` pasa por `promo_vigente()`, y cuando hay promo graba `promo_id` +
  `list_price` en `sale_items`. Locks, negativos, idempotencia, fingerprint y
  append-only quedan **idénticos**. El override manual (`unit_price` con
  `can_apply_discount`) **gana** sobre la promo y no se registra como promo.
- **`resolve_expiry`** — al resolver (`sold` o `wasted`) termina la promo ligada
  con `ended_reason='vencimiento'`. Sin esto queda un agujero de máquina de
  estados: el vencimiento se resuelve y la promo sigue descontando.
- **`pos_destacados` · `productos_buscar` · `producto_por_codigo`** — agregan
  `price` = efectivo, más `list_price` y `promo_id` cuando hay promo.
  **Migración 046** suma `promo_ends_on` a las tres: sin la fecha el cajero puede
  decir "está en promo" pero no HASTA CUÁNDO, y eso es una excusa en vez de una
  explicación. Cuesta una clave sobre la MISMA llamada a `promo_vigente()`.

**No se tocan:** `register_split_sale`, `register_split_group`, `void_sale`,
`adjust_stock`, ni el SQL de corte de día.

## Errores nuevos

`promo_overlap` · `below_cost` · `invalid_range` · `promo_not_found`

## Escala (baseline)

Índices: `promos (store_id, product_id) where ended_at is null` ·
`promos (store_id, ends_on) where ended_at is null` ·
`sale_items (promo_id) where promo_id is not null` (FK nueva ⇒ índice, Postgres
no lo crea solo). `promo_vigente` se resuelve por el primero. Toda lectura de
`sale_items` en la atribución va acotada por `sales.sold_at`.
