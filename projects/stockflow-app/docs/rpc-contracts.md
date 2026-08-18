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

---

## Promociones · migración 047 (PR3 — la sección)

Aditiva: no cambia el esquema de `promos` ni de `sale_items`. Recrea cinco
funciones de 045 y agrega dos.

### `store_hoy(store) → date`
Una sola definición de "hoy" para toda la feature: `(now() at time zone
stores.timezone)::date`. **Corrige un bug de 045**, que usaba `current_date`
(fecha UTC del servidor) en 14 lugares. En Argentina (UTC−3) eso se adelanta a
las 21:00 hora local: una promo "hasta el viernes" dejaba de aplicar el viernes
a las 21:00, con el cartel puesto y el kiosco abierto. El resto de la app ya
resolvía el día así desde la migración 007.

### `create_promo` — dos reglas nuevas
- **`promo_too_short`** — piso de duración: **3 días, o hasta el vencimiento
  ligado, lo que sea MÁS CORTO** (decisión del owner, 2026-08-07). Frena el
  latigazo de precio, pero cede ante el vencimiento: liquidar algo que vence
  pasado mañana es medio motivo de la feature.
- **`promo_after_expiry`** — techo: una promo atada a un lote no puede
  sobrevivirlo (pasada esa fecha liquidaría mercadería nueva al precio de la
  vieja). Atar el lote ES decir "esta promo es por este lote".
- El reemplazo (`p_reemplazar`) ahora **hereda `list_price` de la promo que
  cierra**: si no, el segundo escalón congelaría como "lista" el precio ya
  rebajado y el POS tacharía una rebaja más chica de la que hubo.

### `promos_sugeridas` — el segundo escalón
Antes excluía todo producto con promo viva, con lo cual **el re-escalón era
inejecutable** (y la decisión del owner es que el sistema vuelva a avisar y él
firme cada escalón). Ahora también los evalúa, con tres cotas:
1. mínimo **2 días completos** desde `starts_on` (no contradecirse al otro día);
2. el ritmo se mide **desde `starts_on`**, no a 14 días (la ventana larga está
   contaminada por los días previos a la rebaja);
3. la escalera se calcula sobre el **precio de LISTA**, no sobre el vigente (si
   no, los descuentos se componen solos).

Claves nuevas: `es_reescalon`, `promo_vigente_id`, `promo_price_actual`,
`promo_starts_on`, `promo_ends_on`, `unidades_desde_promo`, `list_price`,
`lote_qty`. `price` pasa a ser el precio **efectivo** de hoy.

### `promos_listado` — la medición deja de mentir
Los predicados `status` y `sold_at` vivían en el `on` de un `left join`: al
anular una venta, la fila de `sale_items` sobrevivía con su `qty` y el `sum` la
sumaba igual — una promo cuya única venta se anuló declaraba unidades vendidas
y plata cobrada. Ahora la atribución va por escalares correlacionados con `join`
real, acotados a 90 días.
Claves nuevas: `cobrado`, `lote_qty`, `lote_al_costo`, `cost_at_start`,
`lote_vence`. El lote **no se cruza** con las unidades vendidas: sin FIFO por
lote, "vendiste 6 de las 8 del lote" sería una atribución que el dato no tiene.

### `promos_carteles(store) → jsonb`
Lectura para la góndola: `name`, `emoji`, `precio`, `antes`, `ends_on`,
`termina_hoy`. Sólo lo **activo hoy** (las programadas quedan afuera: un cartel
puesto hoy con el precio de mañana es el desfasaje cartel↔caja que la feature
existe para evitar). No expone costo, margen, stock ni el motivo del descuento.
No exige `can_see_costs`: no hay un solo costo, y el que pone los carteles
muchas veces no es el dueño.

### Errores nuevos
`promo_too_short` · `promo_after_expiry`

---

## Promociones · migración 048 (Fase 2 — precio por cantidad)

Plan firme: `docs/promociones-fase2-analisis.md`. Decisión del owner:
semántica **POR GRUPOS** — "2 x $1.000" llevando 3 = $1.600 (la 3ra a lista).

### Esquema
`promos.min_qty int not null default 1 check (min_qty between 1 and 24)`.
**`promo_price` sigue siendo POR UNIDAD dentro del grupo** (2 x $1.000 ⇒
`min_qty 2, promo_price 500`). Guardar el unitario exacto es lo que mantiene
`line_total = unit_price·qty` exacto y al split lejos del `split_sum_mismatch`;
la división exacta del precio de grupo se exige en el alta (UI), no acá.

### `create_promo(p_min_qty int default 1)`
`invalid_qty` fuera de [1,24]. El resto (below_cost, promo_too_short,
promo_after_expiry, overlap, reemplazo con herencia de list_price) opera sobre
el unitario y NO cambia. Una promo viva por producto **de cualquier tipo** —
la regla de overlap existente cubre precio y cantidad (decisión owner #2).

### `register_sale` — split de línea
Con promo `min_qty > 1` sobre una línea de `qty` unidades:
`unidades_promo = floor(qty / min_qty) · min_qty` al unitario de promo, el
resto a lista ⇒ **dos filas exactas de `sale_items`**: la de promo con
`promo_id + list_price`; la del resto SIN promo (el invariante
`promo_id ⟺ list_price` se sostiene). `qty < min_qty` ⇒ una fila a lista sin
promo. El override manual (`can_apply_discount`) sigue ganando y no registra
promo. Stock, fingerprint, idempotencia y void: sin cambios (void devuelve por
fila y cubre las dos).

### RPCs de catálogo (`pos_destacados` · `productos_buscar` · `producto_por_codigo`)
Con `min_qty > 1`, `price` expuesto = **LISTA** (a cantidad 1 no hay rebaja;
un tachado sería mentira) y `list_price`/`promo_id` se siguen emitiendo, más
las claves nuevas `promo_min_qty` y `promo_unit_price`. Con `min_qty = 1`:
comportamiento idéntico al actual (compat total).

### Medición y carteles
`promos_listado` suma SOLO filas con `promo_id` ⇒ solo unidades efectivamente
rebajadas; expone `min_qty`. `promos_carteles` expone `min_qty` y
`promo_unit_price` — el cartel dice "2 x $1.000" + "1 x $600", sin tachado.

### Sin cambios
`promo_vigente` (firma) · motor de sugerencias (no toca promos de cantidad —
decisión owner #4) · split · `store_hoy`.

### Errores nuevos
`invalid_qty`

---

## Identidad y acceso · migración 049 (bloque A — endurecimiento de auth)

Plan: `docs/identidad-acceso-plan.md` (decisiones congeladas 2026-08-08).
**Nada de este bloque toca el camino de cobro**: `register_sale`,
`register_split_sale`, `void_sale` y `rpc_member` quedan idénticos. El aislamiento
sigue colgando de `auth.uid()` exactamente igual que hoy.

### Qué NO cambia (y por qué importa decirlo)
`rpc_member(store_id)` · los 4 helpers de RLS (`auth_member_stores`, `auth_has_role`,
`auth_my_member_ids`, `auth_can`) · el esquema de `members` y sus 5 flags ·
`sales.member_id`. La identidad del empleado se resuelve con un `auth.users` normal
(email sintético), así que el modelo de permisos y de atribución no se entera.

### 1 · `stores.status` deja de ser decorativo
Hoy `getSession` filtra `members.status='active'` pero **nunca mira `stores.status`**
(`src/lib/session.ts:55-64`), así que un negocio suspendido desde `/super`
(`src/app/super/actions.ts:118-127`) sigue entrando y operando — el único
apalancamiento de cobranza que existe, sin efecto.

- **`store_activa(p_store_id uuid) returns boolean`** — `stable security definer`.
  Devuelve `stores.status = 'active'`. Se consume desde `getSession` (corte de
  sesión) y desde `rpc_member` **NO** (no se toca el camino de cobro en este bloque;
  el corte de sesión ya deja al usuario afuera antes de llegar a una RPC).
- Contrato de UI: sesión de un negocio suspendido ⇒ `getSession()` devuelve `null` y
  el login muestra un mensaje **distinto** al de credencial incorrecta.

### 2 · Contraseñas: CSPRNG + cambio obligatorio
- La generación pasa de `Math.random()` sobre 6 palabras (~54.000 combinaciones,
  `src/app/super/actions.ts:31-36`) a **`crypto.randomInt` sobre 64 palabras**
  (~5,8·10⁵) — módulo compartido, un solo dueño de la lista.
- **`profiles.must_change_password boolean not null default false`.** Va en la tabla y
  no en `app_metadata` por una razón verificable en test: `app_metadata` sólo se
  escribe con service_role, pero **leerlo desde SQL para una guarda exigiría parsear el
  JWT**; en `profiles` lo lee la misma query que ya hace `getSession` (cero round-trips
  nuevos) y el usuario no puede tocarlo (no hay policy de UPDATE sobre esa columna).
- Toda alta (dueño y empleado) nace con `must_change_password = true`.
- **`marcar_clave_cambiada()`** — `security definer`, sin parámetros: pone
  `must_change_password = false` para `auth.uid()`. Es lo único que el usuario puede
  hacer sobre esa columna, y sólo sobre sí mismo.
- Contrato de guarda: con el flag en `true`, **ninguna ruta protegida responde** salvo
  la de cambio de clave y el logout. La guarda vive en `requireSession`, no en el
  cliente.

### 3 · Selección de negocio determinística
`getSession` usa `.limit(1)` **sin `ORDER BY`** (`src/lib/session.ts:63`): con dos
membresías activas el negocio elegido lo decide el planner. Pasa a ordenar por
`role='owner'` primero y luego `created_at asc` — estable y explicable ("tu negocio
principal es el más viejo donde sos dueño").

### 4 · Alta de negocio sin usuarios huérfanos
`crearNegocio` (`src/app/super/actions.ts:71-81`) no envuelve el RPC en `try/catch` y
**no chequea el resultado del rollback**: si `create_store` *lanza* (red, timeout)
queda un usuario de auth huérfano sin que se entere nadie.
- El rollback pasa a ser explícito y **verificado**; si el borrado del usuario también
  falla, la acción devuelve un error que NOMBRA el usuario huérfano para que quede
  registro operativo.

### 5 · Rate limiting por CUENTA
Hoy sólo hay `login:${ip}` 10/300s (`src/app/login/actions.ts:33-34`), y **un kiosco
entero es una sola IP**: tres empleados equivocándose se consumen el cupo compartido.
- Se agrega `login:acct:<sha256(identificador)>` → 5 intentos / 15 min, y el de IP
  sube a 30/300s.
- El limitador sigue **fail-open** (default de `syntra-scale-security-baseline`). El
  cambio a fail-closed en el login es una decisión abierta del owner y NO entra acá.

### Errores nuevos
`store_suspended` (corte de sesión) · `must_change_password` (guarda de primer ingreso)

---

## Identidad y acceso · migración 050 (bloque B1 — identidad del empleado)

Plan: `docs/identidad-acceso-plan.md`. **No toca el camino de cobro** ni el
aislamiento: el empleado sigue siendo un `auth.users` normal y `auth.uid()`
resuelve todo igual que hoy. Lo único que cambia es **de dónde sale el string
del email**.

### La decisión, en una línea
El empleado entra con **`kiosco + usuario + clave`** y el servidor compone
`<usuario>.<slug>@staff.stockflow.invalid`. `.invalid` es TLD reservado por
RFC 2606 ⇒ nunca colisiona con un dominio real, nunca recibe correo y hace
explícito que no es un buzón. **Verificado contra GoTrue**: `createUser`,
`signInWithPassword` y `updateUserById` funcionan con ese dominio.

**El slug viaja DENTRO del email**, así que el login no necesita ninguna
consulta previa para resolver el negocio: compone y llama a
`signInWithPassword`. Un kiosco inexistente produce un email inexistente ⇒ el
mismo error genérico que una clave incorrecta (no se filtra qué parte falló).

### Esquema
- **`members.usuario text`** — nullable (el dueño no tiene), con índice único
  parcial `(store_id, lower(usuario)) where usuario is not null`. La unicidad
  real la garantiza `auth.users.email`, que es única global y lleva el slug
  adentro; el índice existe para **fallar antes y con un mensaje del negocio**
  ("ya hay alguien con ese usuario en tu kiosco") en vez del de GoTrue ("ese
  email ya tiene una cuenta").

### `add_member(..., p_usuario text default null)`
Suma el parámetro y guarda el usuario normalizado. Errores nuevos:
`usuario_invalido` (fuera de 3-20 tras normalizar) · `usuario_ocupado`.
El resto —owner-only, `already_member`, `role='staff'` hardcodeado— no cambia.

### `equipo_del_negocio` — expone `usuario`
La pantalla de equipo tiene que poder decirle al dueño **con qué usuario entra
cada empleado**: es el dato que le dicta. Para los que no tienen (el dueño, y
los empleados creados antes de esta migración) devuelve `null` y la UI muestra
el email.

### `empleado_a_resetear(p_store_id, p_member_id) → jsonb`
Owner-only. Devuelve `{ profile_id, display_name, usuario }` del empleado, para
que la server action pueda llamar a `admin.updateUserById`. Existe para que el
`service_role` **nunca** tenga que confiar en un `member_id` que vino del
cliente: la RPC valida que ese member sea del store del que llama y que no sea
un owner. Errores: `not_allowed`, `member_not_found`.

### Normalización (compartida app ↔ SQL)
Minúsculas, sin acentos, sólo `[a-z0-9]`, 3-20 caracteres. **La misma función
corre al crear y al entrar** (`src/lib/credenciales.ts`): si difirieran, el
empleado no entraría nunca y el síntoma sería indistinguible de una clave mal
tipeada.

### Errores nuevos
`usuario_invalido` · `usuario_ocupado`

---

## Migración 051 · Permisos herméticos

Auditoría completa: `docs/permisos-audit.md`. Suite: `supabase/tests/verify-permisos.sql`.

### Estanqueidad por columna (no es RPC, pero manda sobre todas)
`authenticated` **ya no lee** `products.cost`, `sale_items.unit_cost` ni
`stock_ledger.unit_cost`. Se otorgan por lista explícita.

> **Si agregás una columna a esas tres tablas, agregala también al `grant` de
> 051** — si no, nace invisible para la app. Falla del lado seguro, a propósito.

Las RPCs `security definer` **no están afectadas**: corren como el dueño de la
función. Por eso el dueño sigue viendo sus costos sin un solo cambio de query.

### `dashboard_summary(uuid)` · `reportes_summary(uuid, date, date)` · `cierre_caja(uuid, date)`

| | |
| --- | --- |
| Antes | `perform rpc_member(p_store_id)` — **membresía**: cualquier empleado del negocio |
| Ahora | `rpc_member(...).role = 'owner'` — **rol** |
| Errores | `not_a_member` (otro negocio, sin cambios) · `not_allowed` (empleado del propio negocio, **nuevo**) |
| Payload | idéntico para el dueño; los cuerpos se extrajeron con `pg_get_functiondef` y el único cambio es el gate |

Si la fase 3 abre estas RPCs al empleado, **no se hace quitando el gate**: se hace
recortando el jsonb por flag, como ya lo hace `promos_listado` (045:847).

### Policies `clients_select` y `client_ledger_select`

| | |
| --- | --- |
| Antes | `store_id in (auth_member_stores())` — todo el equipo |
| Ahora | `auth_can(store_id, 'can_sell_on_credit')` — que incluye al owner |

---

## Migración 052 · Permisos de turno

Auditoría §D (fase 3). Suite: `verify-permisos.sql` bloques 13-14.

### Dos flags nuevos en `members`, default `false`
`can_close_register` · `can_see_reports`. `add_member` **no** los toma a
propósito: nacen apagados y se otorgan desde `actualizar_permisos`.

`actualizar_permisos` suma `p_cerrar` y `p_reportes` (al final, con default).
`equipo_del_negocio` suma `puede_cerrar` y `ve_reportes`.

> ⚠️ **Nota de merge.** La rama de identidad del empleado (B1) redefine
> `equipo_del_negocio` para agregar `usuario`. La que se mergee segunda tiene
> que llevar las dos cosas.

### `cierre_caja(uuid, date)` — payload PARTIDO

| | Dueño | `can_close_register` |
| --- | --- | --- |
| `parcial` | `false` | `true` |
| `fecha` · `anuladas` | ✓ | ✓ |
| `efectivo_esperado` | ✓ | ✓ — es contra lo que cuenta el cajón |
| `ventas_del_turno` (conteo) | — | ✓ |
| `facturado` · `entro_en_caja` · `fiado` · `cobros_fiado` | ✓ | **✗** |
| `by_method` (suma la recaudación) | ✓ | **✗** |
| `ventas` (300 filas con monto y vendedor) | ✓ | **✗** |

El cliente discrimina por `parcial`, así que el compilador impide leer
`facturado` cuando no viajó.

### `reportes_reposicion(uuid, date, date)` → jsonb — **NUEVA**
Gate: `owner or can_see_reports`. Error: `not_allowed`.

`period` · `volumen {units, tickets, prev_units, vs_prev_pct}` · `top_units` ·
`by_date` · `by_slot` · `low_stock` · `expiring`. **Cero columnas de plata**, en
ningún nivel del jsonb — lo afirma el bloque 14 con `jsonb_path_query` sobre
todo el árbol.

`reportes_summary` queda **intacta y owner-only**: no se recortó porque
`by_date`, `by_weekday` y `by_category` son sumas de plata y nada más, así que
censurarlas dejaba dos pantallas peores. El reporte del empleado es otra cosa,
no el del dueño tachado.

`vs_prev_pct` exige un piso de **10 unidades** en el período anterior: con `> 0`
a secas, una base de 3 unidades producía "+72.667%", que no es un dato.

---

## Regla · Todo embed de PostgREST nombra su FK

Nace de una caída real: el **2026-08-18** la migración `055` agregó
`members.created_by → profiles`. Con eso `members` pasó a tener **dos** caminos
a `profiles`, PostgREST no pudo resolver el embed `profiles!inner`, devolvió
`PGRST201`, `getSession` empezó a dar `null` y **la app quedó sin acceso**:
todo el mundo rebotaba al login.

Lo grave no fue el error, fue **cómo pasó desapercibido**: en ese momento
estaban en verde `tsc`, `lint`, `build`, 100 tests TS y 25 suites SQL. Ninguno
podía verlo — las suites SQL hablan con Postgres directo y los tests TS son
lógica pura. **Nada tocaba PostgREST**, que es por donde la app habla de verdad.

**La regla:**

```ts
.select("product_id, products!product_barcodes_product_id_fkey(name)")   // ✅
.select("product_id, products(name)")                                    // ❌
```

Nombrar la FK **aunque hoy no haya ambigüedad**. Es una cadena de texto y hace
que la consulta sobreviva a la próxima columna que apunte a la misma tabla.

**Agregar una FK es un cambio con radio de acción**, no una columna más: puede
romper una consulta que está a tres archivos de distancia y que nadie tocó.

**Relaciones que hoy ya tienen doble camino** (cualquier embed sobre ellas es
una mina si no nombra la FK):

| Tabla | Apunta 2 veces a |
| --- | --- |
| `members` | `profiles` (`profile_id`, `created_by`) |
| `platform_audit` | `profiles` (`actor_id`, `target_profile`) |
| `expenses` | `members` |
| `sales` | `members` |

**La red que lo detecta:** `npm run smoke:sesion` corre la consulta real de la
sesión —importando `SELECT_SESION`, no una copia— con un token real y las dos
identidades. Compartir la cadena es lo que lo vuelve real: con una copia, el
test seguiría verde mientras la app se cae.
