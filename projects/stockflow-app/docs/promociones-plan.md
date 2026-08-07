# StockFlow — Promociones (plan firme)

> **Estado: BORRADOR — espera aprobación del owner.** Ni una línea de SQL ni de
> código hasta que este doc esté aprobado. Fuente de verdad de entidades y
> contratos; ante conflicto con cualquier otro doc, manda este.
>
> Análisis: `Explore` (mapeo del código) + `product-experience-designer` (UX de
> dueño y cajero), 2026-08-07. **v2: re-verificado contra `origin/main` (72c7300)**
> — el borrador v1 se había escrito contra el checkout parqueado en la rama
> dos-electrónicas, 156 commits detrás de main, y afirmaba como bloqueante un
> preload de 500 productos que la Fase 1/2 de inventario ya eliminó.

---

## 1. Qué es una promo (y qué no)

Una promo es un **precio rebajado con fecha de fin sobre UN producto**,
opcionalmente atado a un vencimiento. El precio **lo cobra la caja sola**.

Fuera de alcance del MVP (decidido, no se relitiga): combos/2x1/bundles · LLM en
cualquier parte · promos hacia el cliente final (WhatsApp) · reglas de margen por
categoría · cartelería impresa.

**La frase que ordena todo el diseño:** una promo que la caja no cobra sola es
una calcomanía, no una función. Y una caja que cobra distinto al cartel de la
góndola, sin que nadie pueda explicar por qué, destruye la confianza del que
atiende. Todo lo de abajo está subordinado a esas dos cosas.

---

## 2. Correcciones al brief (verificadas en el código)

| Lo que decía el brief | Lo que hay realmente en main |
| --- | --- |
| "bulk_reprice (015)" | `bulk_reprice` es la migración **005**. La 015 es `margen_reposicion`. |
| "seed de 2000 productos" | **Existe**: `supabase/seed_escala.sql` (~2000 productos, negocio propio "Kiosco Escala" con su dueño — nunca siembra sobre datos reales). |
| — | Próxima migración libre: **045**. Main llega a 044 y salta 029→034 a propósito: **030-033 están reservadas** para la rama parqueada dos-electrónicas. No usarlas. |

**Descartado tras revisarlo:** se sospechó que el `cart_fingerprint`
(`027_pago_dividido.sql:82-95`) tenía un agujero porque no hashea el precio
resuelto. No lo tiene: que un reintento con la misma clave replique la venta
original es el comportamiento correcto de la idempotencia, y la clave rota al
vaciarse el carrito, así que no se reusa entre ventas distintas.

---

## 3. La decisión técnica que sostiene todo

`register_sale` **ya resuelve el precio server-side** —
`027_pago_dividido.sql:189`: `v_unit_price := v_product.price`; sigue siendo la
última definición vigente en main — y el POS manda solo `{product_id, qty}`
(`pos-screen.tsx:101-106`, helper `armarItems`).

**El precio de promo lo resuelve la RPC. El POS nunca lo manda.** Es una línea de
intercepción, exactamente el borde que el brief autoriza tocar.

No es una preferencia de estilo, es obligatorio por dos razones:

1. **Permisos.** Si el precio viajara como `unit_price`, la RPC exige `owner` o
   `can_apply_discount` (`027:180-187`). Todo empleado sin ese flag recibiría
   `not_allowed` **al vender un producto en promo**. La promo no puede consumir
   el permiso de descuento manual: son cosas distintas.
2. **Confianza.** El cliente no puede ser la autoridad del precio de promo.

### Los cuatro puntos de resolución (todos SQL — esto se SIMPLIFICÓ en main)

Desde la Fase 1/2 de inventario el POS ya no precarga el catálogo: muestra 24
tiles curados y va al servidor para todo lo demás. El precio llega al cajero por
**cuatro RPCs, todas en SQL**:

| RPC | Rol | Dónde vive hoy |
| --- | --- | --- |
| `register_sale` | cobra | `027:189` |
| `pos_destacados` | los 24 tiles curados (con `vendidas_14d` y códigos) | `038_puesta_en_marcha.sql` |
| `productos_buscar` | búsqueda server-side | `038` |
| `producto_por_codigo` | escaneo server-side | `038` |

Las cuatro tienen que resolver **el mismo precio efectivo** vía `promo_precio()`
(y devolver también el de lista cuando hay promo, para el tachado). Al ser todas
SQL, es la misma función en cuatro lugares — no hay lógica duplicada ni nada que
resolver en el cliente.

**El desfasaje pantalla/servidor quedó chico:** escaneo y búsqueda son llamadas
vivas — traen el precio de promo **siempre fresco**, per-scan. La única
superficie que puede quedar vieja son los 24 tiles del render inicial
(`pos/page.tsx:42`), porque el total del carrito se computa en el cliente con el
precio que trajo el tile (`pos-screen.tsx:316`, `lineaPrecio`). Ahí sigue
aplicando: activación **por día, no por timestamp** + refetch al recuperar foco.
En split, un desfasaje no cobra mal: `register_split_sale` compara contra el
total del servidor (`028:195-199`) → `split_sum_mismatch` y la venta se cae
ruidosamente.

---

## 4. Entidades (migración 034, aditiva)

### 4.1 `public.promos`

```sql
create table public.promos (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id)   on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,

  promo_price    numeric(12,2) not null check (promo_price >= 0),
  list_price     numeric(12,2) not null check (list_price  >= 0), -- precio congelado al crear
  cost_at_start  numeric(12,2)          check (cost_at_start >= 0), -- para medir después

  starts_on      date not null,
  ends_on        date not null,

  expiry_id      uuid references public.stock_expiries(id) on delete set null,
  origin         text not null check (origin in ('manual', 'sugerida')),
  below_cost_ok  boolean not null default false,

  ended_at       timestamptz,
  ended_reason   text check (ended_reason in ('manual', 'vencimiento', 'reemplazo')),

  created_by     uuid references public.members(id) on delete set null,
  created_at     timestamptz not null default now(),

  check (ends_on >= starts_on),
  check (promo_price < list_price)
);
```

**No hay columna `status`.** El estado se **deriva** de las fechas:

| Estado | Condición |
| --- | --- |
| `terminada` | `ended_at is not null` **o** `ends_on < current_date` |
| `activa` | no terminada **y** `starts_on <= current_date <= ends_on` |
| `programada` | no terminada **y** `starts_on > current_date` |

Esto es lo que cumple el requisito **"no zombie promos" sin un cron**: pasado
`ends_on` la promo deja de existir para la resolución de precio, sin que nadie
tenga que marcarla. `ended_at` existe solo para el fin **anticipado**.

**Una promo viva por producto** — se valida dentro de `create_promo`, bajo el
lock de la fila del producto (mismo patrón que `register_sale`, `027:133-141`):
si ya hay una viva que se solapa, o se rechaza (`promo_overlap`) o se reemplaza
con confirmación explícita del owner (`ended_reason = 'reemplazo'`).
*A verificar en implementación:* si `btree_gist` está disponible, agregar además
una `exclude` constraint sobre `daterange(starts_on, ends_on, '[]')` como cota
estructural. Si no está, no se agrega la dependencia — manda el chequeo en la RPC.

Índices: `(store_id, product_id) where ended_at is null` y
`(store_id, ends_on) where ended_at is null`.
RLS: `enable` + `force`, **sin policy de escritura** (deny-all directo, todo por
RPC) — mismo criterio que `sale_payments` (`027:41-43`). SELECT para miembros del
store.

### 4.2 `sale_items` — dos columnas aditivas

```sql
alter table public.sale_items
  add column promo_id       uuid references public.promos(id) on delete set null,
  add column list_price     numeric(12,2) check (list_price >= 0);
```

Hoy `sale_items` tiene `unit_price`, `unit_cost`, `line_total` **y nada más**:
una línea con promo es **indistinguible** de una con el precio cambiado. Sin
estas dos columnas la atribución que pide el brief no se puede computar, y
agregarlas después no recupera el histórico. Es barato ahora e imposible después.

- `promo_id` y `list_price` se llenan **solo** cuando se aplicó una promo
  (`promo_id is not null` ⟺ `list_price is not null`).
- **No corrompe la analítica de producto:** `unit_price` sigue siendo el precio
  realmente cobrado, así que facturación, margen y reportes existentes no cambian
  de semántica. `list_price` es puramente aditivo.
- `sale_items` no fue alterada por ninguna migración desde la 001 — el ALTER es
  seguro y append-only se mantiene (`revoke update, delete` sigue vigente).

### 4.3 Atribución — las tres cifras, computables

Por promo, sobre `sale_items` de ventas `completed`:

| Cifra | Cómo se computa |
| --- | --- |
| Unidades vendidas en promo | `sum(qty) where promo_id = X` |
| Ganancia recuperada | `sum((unit_price - unit_cost) * qty)` |
| **Lo que te costó** | `sum((list_price - unit_price) * qty)` |
| Plata que estaba en riesgo | unidades del lote atado × `cost_at_start` |

La tercera fila se muestra **siempre**, también en las promos que salieron bien.
Es lo único que impide que la sección sea propaganda de sí misma.

---

## 5. Contratos de RPC (a congelar en `docs/rpc-contracts.md` antes del SQL)

Todas siguen el patrón obligatorio del repo: `security definer`,
`set search_path = public`, `v_member := public.rpc_member(p_store_id)` como
primera línea, `grant execute ... to authenticated`, y `revoke ... from public`
en cualquier función `_core` que exponga costos.

### `promo_precio(p_store_id uuid, p_product_id uuid) returns numeric` — `stable`
Devuelve el precio efectivo (promo si hay una activa hoy, si no `products.price`).
Función chica y `stable`, para poder usarla desde `register_sale` y desde la
carga del POS sin duplicar la regla.

### `create_promo(...) returns jsonb` — **owner-only**
```
create_promo(
  p_store_id      uuid,
  p_product_id    uuid,
  p_promo_price   numeric,
  p_starts_on     date,
  p_ends_on       date,
  p_expiry_id     uuid    default null,
  p_origin        text    default 'manual',
  p_below_cost_ok boolean default false,
  p_reemplazar    boolean default false
) returns jsonb  -- {promo_id, replaced_promo_id, estado}
```
1. `v_member.role <> 'owner'` → `not_allowed`.
2. Producto del store y `status='active'`; si no → `invalid_product`.
3. `p_promo_price >= 0`, `< products.price`, `p_ends_on >= p_starts_on`,
   `p_starts_on >= current_date` → si no, `invalid_amount` / `invalid_range`.
4. **Piso de costo:** si `p_promo_price < products.cost` y no `p_below_cost_ok`
   → `below_cost` (el opt-in es del owner, no del algoritmo).
5. Lock de la fila del producto; si hay promo viva solapada: `promo_overlap`,
   salvo `p_reemplazar` → se cierra la anterior con `ended_reason='reemplazo'`.
6. Congela `list_price = products.price` y `cost_at_start = products.cost`.

### `end_promo(p_store_id uuid, p_promo_id uuid) returns jsonb` — **owner-only**
Setea `ended_at = now()`, `ended_reason = 'manual'`. Idempotente (si ya estaba
terminada, devuelve el estado sin error). Devuelve el precio al que vuelve, para
el copy `Terminar · vuelve a $1.800`.

### `promos_listado(p_store_id uuid) returns jsonb`
Activas / programadas / terminadas (**acotado a los últimos 30 días** — cota de
fecha obligatoria por `syntra-scale-security-baseline`), cada una con su
atribución de §4.3. Costos solo si `owner or can_see_costs`.

### `promos_sugeridas(p_store_id uuid) returns jsonb`
El motor determinista. Ver §6.

### Cambios a RPCs existentes (recreadas por completo en 034, patrón del repo)

- **`register_sale`** — copia literal de la versión de `027` con **un** cambio:
  la resolución de precio de `027:189` pasa a usar `promo_precio(...)`, y cuando
  hay promo se graban `promo_id` + `list_price` en `sale_items`. Nada más se
  toca: locks, chequeo de negativos, idempotencia, fingerprint y append-only
  quedan **idénticos**.
- **`resolve_expiry`** — al resolver un vencimiento (`sold` o `wasted`), termina
  la promo ligada con `ended_reason = 'vencimiento'`. Sin esto queda un agujero
  de máquina de estados: el vencimiento se resuelve y la promo sigue descontando.

**No se tocan:** `register_split_sale`, `register_split_group`, `void_sale`,
`adjust_stock`, ni el SQL de corte de día. `void_sale` funciona sin cambios
porque revierte por asientos contrarios y `sale_items` es append-only.

---

## 6. El motor de sugerencias (determinista, sin LLM)

**Entradas** (todas ya existen): `pending_expiries.days_left` ·
`products.stock` · ritmo de venta 14 días · `products.cost` · `products.price` ·
`store_settings.min_margin_pct` (default 25) · `store_settings.reprice_rounding`.

**El ritmo de 14 días ya se computa en SQL**: `pos_destacados` (038) devuelve
`vendidas_14d` por producto y el POS lo consume como `sold14d`
(`pos/page.tsx:126`). El motor reusa ese mismo patrón de query, acotado por
fecha, dentro de `promos_sugeridas` — no se inventa una segunda definición de
"ritmo".

**La cuenta:**
```
ritmo_actual   = unidades vendidas últimos 14 días / 14
ritmo_necesario = stock / días_hasta_vencer
```
Si `ritmo_actual >= ritmo_necesario` → **no se sugiere nada**. El producto se
agota solo; descontarlo sería regalar margen (riesgo 1 de §8).

**La escalera es una tabla de política, no una optimización.** Esto es
importante y hay que decirlo sin maquillaje: el sistema **puede** calcular
determinísticamente que al ritmo actual no se vende. **No puede** saber que con
−30% sí se vende — no hay datos de elasticidad y no se van a inventar.

| Días hasta vencer | Descuento sugerido |
| --- | --- |
| > 7 | −15 % |
| 4 – 7 | −25 % |
| 2 – 3 | −35 % |
| ≤ 1 | −50 % o piso de costo |

Pisos, en este orden: `min_margin_pct` del negocio → costo → bajo costo **solo**
con opt-in explícito. Redondeo con `round_price` + `store_settings.reprice_rounding`
(un precio de promo de $1.253 es inusable con monedas).

**Regla de honestidad, no negociable:** la UI nunca dice "vas a vender los 8".
Dice el ritmo que haría falta — *"necesitás ~2,7 por día; hoy vendés ~1"* — y
deja que el kiosquero, que conoce su cuadra, decida. Esa línea es lo que separa
una sugerencia de una promesa.

---

## 7. UX — lo que cada uno ve

### 7.1 El cajero (el momento crítico)

No decide nada y no puede equivocarse. La promo es **no interactiva** en el POS:
sin toggle, sin "aplicar promo", sin confirmación extra. Si el cajero pudiera
activarla, el cliente se la va a pedir y va a tener que decidir en la cola.

| Superficie | Qué agrega | Anclaje en main |
| --- | --- | --- |
| Tile curado | Precio de promo como principal + `$1.800` tachado chico. Badge `promo` **solo si el slot está libre** | `pos-screen.tsx:1422` (`money(p.price)`) |
| Resultado de búsqueda / escaneo | El precio que devuelven `productos_buscar` / `producto_por_codigo` **ya es el efectivo** — la fila de resultado muestra promo + tachado | `pos/actions.ts:273, :361` |
| Línea del carrito | `$1.200 c/u · antes $1.800` | `pos-screen.tsx:1497` |
| Confirmar | Una línea sobre el total: `Promo aplicada · −$600` (agregado, no por línea) | total en `pos-screen.tsx:316` |
| Caja | Fila `Vendiste en promo · $12.400 · resignaste $3.600` | `caja-client.tsx` (junto a "Sobran/Faltan", `:194`) |

**Prioridad de badge (dura):** `sin stock` > `promo` > `quedan N`. Nunca dos.
Techo visual: **un color, un tachado, cero movimiento** — la grilla se barre con
visión periférica y todo lo que se mueve implica "hacé algo".

**El modo de falla que justifica la línea en Confirmar:** si la promo es
demasiado sutil, el cajero canta $1.800 de memoria, el cliente paga $1.800, el
sistema registró $1.200 — y a la noche Caja dice **"Sobran $600"**
(`caja-client.tsx:182-197`) sin que nadie sepa por qué. El delta va en Confirmar
porque es el instante exacto en que se cuenta la plata.

**Qué contesta el "¿por qué sale menos?":** una frase que el cajero lee literal,
sin interpretar: *"Está en promo hasta el viernes."*

### 7.2 El dueño

Aceptar un −30 % de un toque sin sentir que apostó necesita cinco líneas:

```
🍫 Alfajor Jorgito
Te quedan 8 u. y vencen el sábado (en 3 días).
Vendés ~1 por día: a ese ritmo salen 3 y te quedan 5.
Si los tirás, perdés $4.200 de lo que te costaron.

A $1.200 (−30%) te queda $340 de ganancia por unidad · 22% de margen.
Para venderlos todos necesitás ~2,7 por día.

[ Poner a $1.200 ]  [ ✎ ]
Termina el sáb 14 y el precio vuelve solo a $1.800.
```

Vocabulario y patrones **reusados tal cual** de Precios
(`precios-client.tsx:165-186, 258-264`): el par `[Poner a $X] [✎]` es el
antídoto contra la sensación de apuesta — el toque único es un *default*, no un
veredicto. La plata en riesgo se dice **al costo**, igual que "Perdiste por
vencimientos" en Reportes; decirla al precio de venta sería inflar la pérdida.

**Lo que el toque único NO puede esconder:** la fecha de fin y que el precio
vuelve solo · el precio nuevo en pesos, no solo el "−30 %" · que se aplica solo
en la caja · el margen resultante, con corte visual si cae bajo el costo.

### 7.3 La sección

**Sin tabs** — un kiosco tiene 0-5 promos; partirla en dos esconde justo lo que
hay que decidir. Un scroll, bloques que solo se renderizan si tienen contenido
(misma disciplina que Reportes y Vencimientos):

1. **CardHero** `glow="danger"`: `Tenés $8.400 en mercadería por vencer`.
2. **"Para decidir"** — sugerencias, máx. 3-5 por urgencia. **Acción primaria.**
3. **"En promo ahora"** — con días restantes, unidades vendidas y
   `Terminar · vuelve a $1.800`.
4. **"Programadas"** — solo si hay.
5. **"Terminadas (últimos 30 días)"** — plegado; acá vive la medición.

Sugerencias y promas manuales **producen el mismo objeto**: una sugerencia
aceptada es indistinguible en "En promo ahora", salvo una etiqueta chica de
origen. Crear a mano va en el slot de acción del `PageHeader`, como "Cargar
vencimiento" en Vencimientos.

**Nav** (`nav-data.tsx:51-61`): grupo **Mercadería**, entre `Precios` y
`Vencimientos` — es una decisión de precio disparada por un vencimiento, va
entre las dos cosas de las que toma prestado. Ícono `Tag`. **No** va en Control,
que es "mirar y cobrar".

**Entrada desde Vencimientos (necesaria en MVP):** el push deep-linkea ahí; si
desde ahí no se puede promocionar, el dueño tiene que navegar justo cuando
estaba decidiendo. **No** como tercer botón — la fila ya tiene dos acciones que
son *resoluciones* (`Se vendió` / `Tuve que tirarlo`) y una promo es preventiva.
Va **arriba**, como franja distinta:
`No se vende al ritmo actual · Ponerlo en promo a $1.200 →`.

**Dashboard: no se toca en el MVP.**

### 7.4 Empty states (tres, no uno)

- **(a) Sin promos y sin nada por vencer:** *"No tenés nada para liquidar."*
- **(b) Sin promos pero con sugerencias:** no hay empty state, se muestran.
- **(c) Sin promos, sin sugerencias y sin vencimientos cargados** — el caso del
  dueño nuevo: *"Todavía no cargaste vencimientos"* + `[Ir a Vencimientos]`.
  Sin (c) la sección está estructuralmente muerta y el dueño concluye que no anda.

`BrandArt` **no tiene pieza `promos`** (`src/lib/brand-art.ts:10-20`) → o se
genera una 512² con el flujo documentado, o se reusa `precios` (la etiqueta de
precio colgando), que temáticamente cierra. **Tarea de asset, no de código.**

---

## 8. Guardarraíles (cómo esto puede lastimar en silencio)

| # | Riesgo | Guardarraíl | MVP |
| --- | --- | --- | --- |
| 1 | Promo sobre algo que igual se vendía | El motor no sugiere si se agota solo; en el camino manual, **avisa** con la misma cuenta (no bloquea) | Sí |
| 2 | Descuento más profundo del necesario | Escalera por urgencia + la UI dice qué ritmo exige + redondeo | Sí |
| 3 | Promo olvidada corriendo | Fecha de fin **obligatoria** + aviso al terminar con el precio restaurado | Sí |
| 4 | Latigazo de precio (góndola vs. caja) | Duración mínima + §10a | Sí |
| 5 | Descuadre de caja por cobrar el precio del cartel | Delta en Confirmar + fila en Caja | Sí |
| 6 | Bajo costo sin querer | Opt-in por promo, segundo tap, **en pesos**: *"Perdés $200 por unidad; recuperás $1.000 en vez de tirar $2.400"* | Sí |
| 7 | Se resuelve el vencimiento y la promo sigue | `resolve_expiry` termina la promo ligada | Sí |
| 8 | Entra mercadería fresca y se liquida al precio de la vieja | En Recibir mercadería: *"Está en promo hasta el vie. ¿La terminás?"* | Sí |
| 9 | Promo que arranca con el POS abierto | Activación por **día** + refetch al recuperar foco | Sí |
| 10 | Dos promos sobre el mismo producto | Una viva por producto (§4.1) | Sí |
| 11 | Sugerencias que nunca se aceptan → ruido | Descartar silencia esa sugerencia para ese vencimiento | Después |

---

## 9. Escala (el "bloqueante" del borrador v1 NO existe en main)

El v1 de este plan afirmaba que el POS cortaba el catálogo en 500 productos y
que una promo fuera de ese corte no se podía ni escanear. **Eso era el checkout
parqueado.** En main, la Fase 1/2 de inventario eliminó el preload:
`producto_por_codigo` escanea **cualquier** producto del negocio y
`productos_buscar` encuentra cualquiera, ambos server-side. El fix de `union`
que proponía el v1 **queda eliminado del plan** — no hay nada que arreglar.

La pregunta real, más chica, es **cómo se hace visible la promo** en el POS:

1. **Tile curado**: si el producto en promo está entre los 24 destacados, el
   tile muestra promo + tachado (el caso más común: lo que está por vencer y no
   rota suele no estar en los destacados — y no importa, porque…)
2. **Escaneo**: `producto_por_codigo` devuelve el precio efectivo → el flujo
   normal del cajero (escanear) ya cobra bien sin que el producto esté en
   pantalla.
3. **Búsqueda**: `productos_buscar` ídem, con promo + tachado en la fila.

**¿Producto en promo que no está en los destacados, se fuerza a la grilla?**
**No.** Los destacados son "lo que más vendés" (ranking de `pos_destacados`);
meterle promos a la fuerza rompería su semántica, y el cajero no elige qué
cobrar mirando la grilla — escanea. La visibilidad para el DUEÑO va en la
sección Promos, no en la grilla del cajero.

> **Revisitable con evidencia de kiosco real.** Esta decisión descansa en un
> supuesto sobre cómo trabaja el cajero: que el camino real es escanear. Si en
> un negocio de verdad resulta que buena parte de las ventas se tipean o se
> tocan en la grilla —o que el dueño espera ver ahí lo que puso en promo—, se
> revisa: forzar los productos en promo a los destacados, o darles su propio
> carril arriba de la grilla. No se cambia por intuición ni por pedido aislado:
> se cambia con lo que se vea en el piso.

`seed_escala.sql` (~2000 productos, negocio propio) **ya existe** y es la base
del criterio de verificación de PR3, tal como pide el brief.

---

## 10. Lo que falta para que no se sienta roto (chequeo de scope)

- **(a) El puente a la góndola.** Todo el problema de confianza vive en un papel
  pegado a la estantería. Falta **una** pantalla: *"Carteles de hoy"* — productos
  en promo con precio viejo / precio nuevo / hasta cuándo, legible en el celular
  parado frente a la góndola. Sin eso el dueño reconstruye la lista a mano y la
  caja va a cobrar distinto al cartel. **Recomiendo incluirla en PR3**: es una
  vista de lectura sobre datos que ya existen.
- **(b) Aviso de fin con el precio restaurado**, reusando el push + espejo in-app
  con dedupe que ya existe.
- **(c)** `Terminar · vuelve a $1.800` — el copy, no solo la acción.
- **(d)** Ligadura vencimiento ↔ promo (riesgo 7).

**Resistir (no es MVP):** motivos/notas por promo, cartelería para el cliente,
precios por cliente, promos por categoría, gráficos comparativos históricos.

---

## 11. Las tres fases

### PR1 — contrato + backend
Congelar los contratos de §5 en `docs/rpc-contracts.md` → migración **045**
aditiva: tabla `promos`, dos columnas en `sale_items`, las 5 RPCs nuevas,
`register_sale`, `resolve_expiry` y las 3 RPCs de catálogo (`pos_destacados`,
`productos_buscar`, `producto_por_codigo`) recreadas con el cambio mínimo:
resolver el precio con `promo_precio()` y exponer el de lista cuando hay promo.
**Verificación:** `verify-promos.sql` (alta/fin, owner-only, solapamiento
rechazado, piso de costo, precio efectivo, snapshot correcto en `sale_items`,
aislamiento entre stores) + `verify-rpcs.sql` y `verify-split*.sql` **verdes como
regresión** + toda lectura acotada por fecha.

### PR2 — cobro en el POS
Precio efectivo en la carga del POS + las tres superficies de §7.1 + la fila en
Caja. **TDD:** promo aplicada al escanear · promo vencida/terminada **no**
aplicada · anulación de venta con promo revierte limpio · invariantes de
`register_sale` (sobreventa / idempotencia / append-only) verdes.
Convive con split y con monto libre — que en main **sí tiene UI propia**
(diálogo en `pos-screen.tsx:215`, `lineaPrecio` distingue producto de monto
libre en `:97`): una línea de monto libre nunca lleva promo, y el test lo cubre.

### PR3 — sección + sugerencias
Nav, listado, alta manual, sugerencias en la sección **y** en Vencimientos,
empty states, "Carteles de hoy" (§10a). Validación sobre el seed de escala,
mobile 360/390 respetando las reglas de reparación de `responsive-audit`.

**Gate visual (PR2 y PR3):** OK del owner sobre el prototipo VIVO en su
navegador, probando el ciclo completo — crear → escanear en el POS → vender →
ver el margen → fin automático.

---

## 12. Decisiones del owner — TOMADAS (2026-08-07)

1. **La frase del mostrador:** *"está en promo"*. El POS no menciona el
   vencimiento en ningún lado; el motivo del descuento es del dueño.
2. **La escalera: NO baja sola.** El sistema vuelve a avisar y el owner firma
   cada escalón — ningún precio cambia sin su firma. Consecuencia: el esquema
   NO cambia (un segundo escalón es una promo nueva que reemplaza a la
   anterior, con `ended_reason='reemplazo'`), pero `promos_sugeridas` sí tuvo
   que dejar de excluir lo que ya está en promo (047 · B1) — hasta entonces la
   decisión era literalmente inejecutable.
3. **Duración mínima: 3 días, acotada por el vencimiento ligado** — la regla es
   *"mínimo 3 días O hasta la fecha de vencimiento, lo que sea MÁS CORTO"*. Una
   promo que liquida algo que vence en 2 días tiene que poder durar 2 días.
   Vive en `create_promo` (`promo_too_short`) y espejada en `lib/promos.ts`
   para que la pantalla nunca llegue al error; los dos lados tienen tests.
4. **Label de nav: "Promos"** (grupo Mercadería, entre Precios y Vencimientos).
5. **"Carteles de hoy": ENTRA en PR3**, con vista imprimible. El desfasaje
   entre el precio de la góndola y el de la caja mata la confianza.
6. **Arte de marca:** se reusa la pieza `precios` por ahora; una pieza `promos`
   propia se puede cambiar después sin tocar código.

### Lo que apareció al construir PR3 (migración 047)

Cuatro huecos de backend que el contrato congelado de PR1 no cubría, más un
bug propio, todos con test en `verify-promos-047.sql`:

- **B5 · el día se cortaba en UTC.** 045 usó `current_date` en 14 lugares
  mientras el resto de la app usa la timezone del negocio desde la migración
  007. En Argentina eso adelanta la fecha a las 21:00 local: una promo "hasta
  el viernes" moría el viernes a las 21:00 con el cartel puesto y el kiosco
  abierto. Es exactamente la falla que la feature existe para evitar.
- **B1 · el segundo escalón no se podía sugerir** (ver decisión 2).
- **B3 · la medición contaba ventas ANULADAS**: los predicados vivían en el
  `on` de un `left join`, así que la fila de `sale_items` sobrevivía al void.
- **B2 · no había cota de duración** en ningún lado (ver decisión 3).
- **B4 · faltaban `cost_at_start` y el tamaño del lote**, sin los cuales la
  medición no puede decir qué había en juego.
