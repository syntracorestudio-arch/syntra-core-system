# Inventario a escala real — auditoría + propuesta (catálogos de 800-2000+ productos)

> **Estado:** PLAN. Sin código, sin migraciones, sin ejecución. Auditoría del 2026-07-28
> sobre `main` (`a3c9db3`). Toda cita es `archivo:línea` verificada.
>
> **Origen:** la UI se construyó y probó con **6 productos** (seed local: 6 productos,
> 4 categorías, 2 negocios). Un kiosco real tiene **800-2000+ SKUs**. Esta auditoría
> busca (1) qué se rompe o degrada con catálogo grande, (2) agrupar por categoría sin
> fabricar duplicados, (3) que cada sección use bien el espacio en AMBOS extremos.
>
> Marco normativo: `syntra-scale-security-baseline` (cotas, índices, paralelismo).
> Tooling: 2× `Explore` (mapa de queries y de categorías) · `product-experience-designer`
> (densidad/agrupación) · `WebSearch` (benchmark) · verificación directa de los hallazgos
> titulares.

---

## RIESGO 0 — el catálogo se trunca en silencio y eso CORROMPE datos

Es el hallazgo que ordena todo el resto. No es lentitud: es pérdida de datos.

`src/app/pos/page.tsx:44-49` trae el catálogo entero precargado:

```ts
.from("products").select("id, name, emoji, color, price, stock, category_id, categories(name, color)")
.eq("status","active").order("name").limit(500)
```

Con 1.200 SKUs se corta en 500 **por orden alfabético**. Y el índice de escaneo se
construye SOLO desde ese array truncado (`src/components/pos/pos-screen.tsx:195-199`):

```ts
const porCodigo = useMemo(() => {
  const map = new Map<string, PosProduct>();
  for (const p of products) for (const b of p.barcodes) map.set(b, p);
  return map;
}, [products]);
```

**La cadena de falla, en el mostrador y con gente esperando:**

1. El cajero escanea una Coca que **existe** en el catálogo, pero quedó fuera del corte.
2. `porCodigo` no la tiene → el POS ofrece **"Alta rápida"**.
3. El cajero la da de alta → **producto DUPLICADO con stock 0** (`src/app/pos/actions.ts:327-336`).
4. Ese duplicado nace además **sin categoría** (`category_id` se omite) y con stock roto.

Consecuencia: stock, alertas de reposición, dead-stock y reportes por categoría quedan
corrompidos. **Es exactamente el problema de duplicados que planteó el owner, pero a
nivel PRODUCTO en vez de categoría — y ya está latente en el código de hoy.**

El propio archivo lo anticipa (`src/app/pos/page.tsx:22-26`): *"Si un negocio lo supera,
el POS pasa a búsqueda server-side en vez de precargar"*. **Ese fallback nunca se
implementó.** El corte es silencioso: no hay aviso, ni en el POS ni en Productos.

---

## A) Auditoría de escala por sección

### Tres hechos transversales (verificados por grep en todo `src/`)

1. **Cero virtualización.** No hay `react-window`, `react-virtual`, `virtuoso` ni
   `IntersectionObserver` en el proyecto ni en `package.json`. Todas las listas hacen
   `.map()` del array completo.
2. **Cero paginación.** Ni un solo `.range(` ni `.offset` en el repo.
3. **Cero búsqueda server-side de productos propios.** Toda búsqueda es `.filter()` en
   memoria sobre el array completo. (La única búsqueda server-side, `buscarPorNombre`
   en `src/app/pos/actions.ts:291`, va contra `catalogo_publico` —el dataset compartido
   de EANs—, no contra el catálogo del negocio.)

### Tabla de riesgo por pantalla

| Pantalla | Cómo carga | Cómo renderiza | Qué pasa a 100 / 1000 / 5000 |
| --- | --- | --- | --- |
| **`/pos`** (máximo riesgo) | `limit(500)` alfabético + 2000 barcodes + 5000 sale_items + 300 clientes, **todo al cliente** (`pos/page.tsx:44-65`) | Grilla `auto-fill`, `{visibles.map()}` **sin techo ni slice** (`pos-screen.tsx:1203-1204`) | 100 OK · 1000 **pérdida silenciosa de catálogo + escaneo roto → duplicados** · 5000 inusable |
| **`/admin`** (dashboard) | `low_stock` y `restock` **SIN LIMIT en SQL** (`006_expiries_and_alerts.sql:109-114`, `027_pago_dividido.sql:412-434`) | Renderiza **4 y 5 filas** (`dashboard-client.tsx:242,355`) | Con "stock ≤ 3" en 2000 SKUs son cientos de filas serializadas **para pintar 9**. El cron lo llama para TODOS los negocios (`api/cron/alerts/route.ts:45`) |
| **`/admin/productos`** | `limit(500)` (`page.tsx:19-23`); `categories` **sin limit** (`page.tsx:24`); `sale_items` `limit(8000)` | `<ul>` plana `{visibles.map()}` (`products-client.tsx:179-180`) | Filtros O(n) por render y un **O(categorías × productos)** en `:341`. El header muestra `products.length` → con >500 **el contador miente (dice 500)** sin aviso |
| **`/admin/reportes`** | RPCs acotadas por período (24 meses techo) | — | Rankings con techo (`limit 8`, `dead_stock limit 10`) **salvo `by_category`: SIN LIMIT** (`009_reportes.sql:168-182`) y render **sin slice** (`reportes-client.tsx:688-697`) → 60-80 barras |
| **`/admin/ingreso`** | `limit(500)` + 2000 barcodes (**sin `.order()`** → truncado no determinista) + 3000 ledger | **`slice(0,8)`** y no dibuja nada sin búsqueda (`ingreso-client.tsx:128-134`) | **DOM protegido — es el patrón correcto del repo.** Pero paga el mismo costo de transferencia |
| **`/admin/vencimientos`** | expiries `limit(200)` ✅ + **500 productos solo para poblar un `<select>`** (`page.tsx:22-26`) | `<select>` con hasta **500 `<option>`** nativos, sin buscador (`vencimientos-client.tsx:244-248`) | Selector inusable a 1000+; sin búsqueda en la pantalla |
| **`/admin/precios`** | RPC `margenes_erosionados` con **`limit 100`** interno ✅ (`015_margen_reposicion.sql:149`) | Lista plana ≤100 | Cota OK, **pero** el cuerpo corre 3 subconsultas correlacionadas por producto (`015:81-104`) → ~4000-6000 subplanes antes del `limit` |

### Violaciones explícitas del scale-security-baseline

Queries **sin cota** que el baseline marca como red flag:

1. `store_alerts` → `low_stock` sin LIMIT (`006_expiries_and_alerts.sql:109-114`) — y `expiring` igual (`:116-123`).
2. `dashboard_summary` → `restock` sin LIMIT (`027_pago_dividido.sql:412-434`).
3. `reportes_summary` → `by_category` sin LIMIT (`009_reportes.sql:168-182`).
4. `categories` sin `.limit()` (`admin/productos/page.tsx:24`) — la única query de categorías sin cota.

Las cuatro son **aditivas de arreglar** (agregar LIMIT/slice) y ninguna toca el modelo de
plata. Las 1 y 2 además las ejecuta el cron para cada negocio → el costo se multiplica.

---

## B) Sistema de categorías + de-duplicación

### Hallazgo que reencuadra el pedido del owner

**Hoy NO se pueden crear categorías desde la app.** Grep de `insert`/`upsert` contra
`categories` en todo `src/`: **cero resultados**. Las categorías nacen únicamente de la
semilla de onboarding —8 fijas: Bebidas, Golosinas, Cigarrillos, Almacén, Limpieza,
Fiambres, Panadería, Varios— (`010_onboarding.sql:74-82`). El diálogo de producto es un
`<select>` de UUIDs (`products-client.tsx:589-601`; `actions.ts:15` valida `z.guid()`).

Es decir: **"Golosina" vs "Golosinas" todavía no puede pasar por UI — pasa el día que
agreguemos creación inline.** El momento de diseñarlo es ahora, antes de habilitarlo.

### Pero la base no tiene NINGUNA barrera

`001_initial_schema.sql:85-96`:

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,        -- sin UNIQUE, sin CHECK, sin trim, sin largo máximo
  emoji text, color text, sort int not null default 0,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);
create index categories_store_idx on public.categories (store_id, sort) where status = 'active';
```

- **Sin `unique (store_id, name)`**, sin índice funcional `lower()`/unaccent, sin trigger de normalización.
- Contraste: `products` **sí** tiene `create index products_name_idx on public.products (store_id, lower(name))` (`001:124`). A categorías nunca se le dio ese tratamiento.
- El owner (`authenticated`) tiene grant y policy full sobre `categories` (`001:522`, `002_rls_policies.sql:133-135`) → **puede insertar duplicados vía PostgREST sin pasar por la UI**.
- Reportes agrupan por `cat.name` (`009_reportes.sql:168-181`) → duplicados = **filas separadas** en el reporte.

### Dos deudas ya materializadas (no hipotéticas)

1. **El alta rápida del POS deja los productos SIN categoría.** `pos/actions.ts:327-336`
   omite `category_id`; la UI no tiene selector (`pos-screen.tsx:1762-1819`). Todo lo que
   se da de alta en la caja cae en "Sin categoría" — y eso es justo lo que más se usa.
   **Esto ya sabotea el objetivo de "agrupar por categoría" sin que aparezca un solo duplicado.**
2. **No existe pantalla para renombrar / archivar / fusionar categorías.** No hay
   `src/app/admin/categorias/`, ni RPC de merge en ninguna migración. Un negocio que se
   ensucie (por SQL, PostgREST o una futura UI) **no tiene salida dentro de la app**.

### Activo reusable: ya existe el primitivo de normalización

No hace falta habilitar `unaccent`/`citext`/`pg_trgm` (hoy solo está `pgcrypto`,
`001:17`). El repo ya resolvió esto (`011_catalogo_publico.sql:113-119`):

```sql
create or replace function public.unaccent_simple(p_texto text)
returns text language sql immutable strict as $$
  select translate(lower(p_texto), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
$$;
```

`immutable` → **sirve para un índice único funcional**. Y en TS ya existe su gemela:
`normalizar()` (`products-client.tsx:57-65`: minúsculas + NFD + strip de diacríticos +
colapso de espacios), junto con `buscarParecidos()` (`:78-93`) y el aviso "Ya tenés
productos parecidos" (`:511-514`). **La maquinaria anti-duplicado ya existe y está
probada — solo nunca se aplicó a categorías.**

### Propuesta (contrato a congelar ANTES de cualquier SQL)

1. **Entidad canónica con unicidad insensible a mayúsculas y acentos**
   `create unique index categories_nombre_uq on public.categories (store_id, public.unaccent_simple(name)) where status = 'active';`
   El índice es **la verdad**; el aviso de UI es cortesía. Parcial por `active` para que
   archivar libere el nombre.
2. **Alta que ELIGE, y crea solo si es genuinamente nueva**
   El `<select>` pasa a **combobox con búsqueda**: tipeás "gol" → `Golosinas (34)`.
   Crear es una opción explícita al final (`+ Crear "Golosina"`), **nunca el default ni
   el Enter**. Antes de crear: normalizar + comparar raíces (sumando singular/plural
   español: quitar `-es`/`-s` final).
3. **Avisar, no bloquear** — mismo patrón que el owner ya aprobó para productos:
   *"Ya tenés **Golosinas** (34 productos). ¿Es la misma?"* → **[Usar Golosinas]**
   primario · [Crear igual] secundario.
4. **Migración de normalización + merge de lo existente**
   `trim` + colapso de espacios sobre los nombres actuales; detección de colisiones bajo
   `unaccent_simple`; y una RPC `fusionar_categoria(origen, destino)` que reasigna
   `products.category_id` y archiva la origen. **Con preview de cuántos productos se
   mueven** (ver pregunta abierta G3: auto-merge vs preguntar).
5. **Alta rápida del POS con categoría** (aunque sea opcional y con default), para cortar
   la fábrica de "Sin categoría".
6. **Solo owner** crea/renombra/fusiona — la RLS ya lo restringe (`002:133`); mantenerlo.

---

## C) Agrupación + densidad (dirección de `product-experience-designer`)

### C1 · Productos: drill-down, NO accordion ni árbol

Tres niveles, con la URL como estado (ya existe `?cat=`; sumar `?q=`):

| Nivel | Cuándo | Qué se ve |
| --- | --- | --- |
| **0 · Índice** | sin query ni chip | Una fila por categoría: emoji, nombre, **N productos**, cuántos con stock bajo, cuántos sin costo. Arriba "Necesitan atención". Abajo **"Sin categoría (N)"** como deuda visible |
| **1 · Lista** | chip activo | Lista plana de esa categoría (≤ ~200), densa, sin headers |
| **2 · Ficha** | tap en fila | El diálogo actual |
| **Transversal** | hay query | Resultados planos por ritmo, tag de categoría por fila, tope 50 + "mostrar más". **Buscar también por código de barras** (hoy `products-client.tsx:141` solo busca por nombre) |

**Por qué no accordion:** los dos trabajos reales son *"¿tengo Coca 2.25?"* (→ buscar/
escanear; la categoría es irrelevante) y *"¿qué golosinas tengo?"* (→ una categoría,
plana). El accordion cerrado es el mismo índice pero peor: con 40 categorías es un muro
de headers, y al expandir en el lugar se pierde el scroll. En mobile, **reemplazar vista >
expandir en el lugar**. Árbol: descartado (es pensamiento de explorador de escritorio).

### C2 · Chips cuando hay 15-40 categorías

Hoy `src/components/ui/category-chips.tsx:44` es `overflow-x-auto` sin scrollbar ni
affordance: en 390px entran ~3 chips y **el resto es invisible**.

- Techo: **8 chips + "Más ⌄"** (POS: 6 + "Más"). Con ≤6 categorías, mostrar todas y ocultar "Más".
- Cuáles 8: `Todos` + top por **uso real** (POS: ritmo de venta —`sold14d` ya existe—; admin: cantidad de productos). **La categoría activa siempre entra**, anclada segunda.
- "Más" abre **bottom-sheet (mobile) / popover (desktop)**: todas en 2 columnas, con contador, buscador propio si son >20, y "Sin categoría (N)" al final.
- **Contador en el chip** (`Golosinas 34`): con 2000 productos, el número es lo que decide si vale entrar.
- Máscara de degradado al borde mientras haya scroll. El scroll horizontal se conserva como atajo, **nunca como único acceso**.
- Ordenar por uso, no alfabético.

### C3 · Densidad en ambos extremos — tres modos por volumen

| Modo | Layout | Cómo llena el espacio |
| --- | --- | --- |
| **Vacío (0)** | `EmptyArt` + UNA acción | Ilustración a **máx ~40dvh**, anclada arriba. Hoy el POS hace `grid flex-1 place-items-center py-16` (`pos-screen.tsx:1187`) → con 0 productos la ilustración flota en un océano |
| **Chico (1..N)** | Lista/grilla directa, filas cómodas | El sobrante se llena con **trabajo pendiente, nunca decoración**: "Completá tu catálogo" (X sin código, X sin costo, X sin categoría) + accesos a Ingreso y Alta. Con 5 productos el kiosquero está onboardeando: **esa** es la sección útil |
| **Grande (>N)** | Índice/drill-down, filas compactas, virtualización, tope 50 + "mostrar más" | Densidad **informativa**: contadores, "dura ~6 días" (ya existe y es excelente), plata en juego, color de categoría |

Umbrales propuestos (a validar contra catálogo real): **Productos N=40 · POS tiles N=60**.
Si el catálogo tiene ≤40, **saltear el nivel 0**: un kiosco nuevo no debe ver un índice de
8 categorías vacías (el peor empty state posible). El sistema de arte de marca ya existe
(`src/lib/brand-art.ts`, 10 piezas incl. `productos`, `precios`, `recibir`) — reusarlo.

**Sobre "premium" en app operativa:** la riqueza va en **densidad informativa**, no en
animación. Permitido: feedback de acción (`sf-tap`, pop del total — ya están). Prohibido:
entrada animada de filas (con 800 filas es jank garantizado), hover caros, cards grandes
en listas largas. Skeleton solo del bloque que tarda, **altura fija = altura real (CLS 0)**,
máximo 6-8 filas fantasma — nunca 800.

### C4 · POS: de catálogo navegable a caja

**Bloque único "Lo que más vendés". Techo duro: 24 tiles en mobile, 36 en desktop. Nada debajo.**
Pasado el tile ~24, la probabilidad de encontrarlo scrolleando cae por debajo de la de
tipear 3 letras — y el scroll infinito es lo que rompe los 15 segundos.

**Cómo se definen los rápidos — automático primero, manual como override:**

1. Base: `sold14d` (ya existe y **ya ordena la grilla** — `pos-screen.tsx:215-227`).
2. Catálogo nuevo sin ventas: caer a los que tienen precio y stock, alfabético + bloque "Fijá tus rápidos".
3. **Override manual — "fijar" (pin)**, hasta 8, siempre primeros. Resuelve lo que nunca
   liderará por ritmo porque no tiene código: pan, fraccionados, cigarrillos sueltos,
   bolsas, hielo. → requiere columna nueva (pregunta abierta G2).
4. **Los tiles NO se reordenan solos durante el turno.** Congelar el orden por sesión/día:
   un tile que se mueve entre ventas es un error de cobro esperando pasar.

**Cuando el producto no está en los tiles — es el caso NORMAL, no la excepción:**

- 2 caracteres reemplazan tiles por resultados (ya pasa; mantener), capados a 24, buscando **nombre y código**.
- Chip de categoría → tiles de esa categoría, capado a 48 + "ver todos".
- **Sin resultados, hoy muere en un texto** ("Ningún producto coincide", `pos-screen.tsx:1195`).
  Debe ser accionable en un tap: `No encontré "coca 2.25"` → **[Cobrar monto suelto]** ·
  **[Darlo de alta]**. Las dos capacidades ya existen (`AltaRapida`, monto libre); falta
  ponerlas donde el cajero se traba con gente esperando.

> Presupuesto operativo: **si el cajero tiene que scrollear para cobrar, la app falló.**

### C5 · Jerarquía de acceso por pantalla

| Pantalla | Orden de recursos |
| --- | --- |
| **POS** | escanear → buscar (nombre+código) → pines → chip de categoría → alta rápida / monto suelto. *"Explorar" no existe; el scroll no es un recurso de acceso* |
| **`/admin/productos`** | buscar (nombre+código, **sumar escaneo**: el dueño tiene el lector en el mostrador) → índice de categoría → lista → ficha. "Ver los 1.240" existe pero último y explícito |
| **Ingreso** | escanear → buscar. **Ya es correcto — no agregarle grilla** |
| **Precios / Vencimientos / Stock bajo** | ninguno: son **colas de trabajo**, llegan filtradas y ordenadas por plata en juego. Chips solo si superan ~40 ítems |
| **Reportes** | la categoría es dimensión de agregación, no camino de acceso. Sin cambios |

---

## D) Benchmark

**Square (verificado).** La grilla de favoritos se arma a mano (Checkout → Favorites,
mantener presionado un casillero para asignar ítem o atajo) y tiene **tope de 7 páginas de
grilla**. La comunidad es explícita en que **con miles de ítems poner "favoritos" ítem por
ítem no escala**, y la guía oficial recomienda para inventarios grandes **escanear SKU/GTIN**
y apoyarse en la Library (ordenada alfabética/numéricamente) + categorías dentro de la
grilla. → Valida exactamente nuestra dirección: **tiles curados + scan/búsqueda primero**,
y que el pin manual sea un complemento acotado (nuestro tope de 8), no el mecanismo principal.

**Virtualización vs paginación (verificado, guía general).** Consenso: la paginación sirve
para "unos cientos" de ítems; **a partir de miles, virtualizar** (renderizar solo lo visible)
da los beneficios de la paginación con UX de scroll continuo. Recomendaciones asociadas:
mantener el estado de paginación **en la URL** para no perder el lugar al refrescar (ya lo
hacemos con `?cat=`/`?p=`/`?d=`) y no abusar del largo de página. → 2000 productos cae de
lleno en "dataset grande": **virtualizar la lista larga y acotar server-side**, en vez de
paginación numerada (que además es mala en mobile).

**POS argentinos (Fudo, Bistrosoft) — NO verificado en el punto que importa.** Ambos son
sistemas de gestión gastronómica ampliamente usados en AR (Fudo: cloud, mesas, stock,
integraciones con MP y delivery; Bistrosoft: PDV táctil para mostrador). **Las búsquedas no
arrojaron documentación sobre cómo manejan catálogos de miles de ítems** (grilla, límites,
búsqueda). Marcar como **no verificado**: no usarlo como evidencia. Si el owner quiere el
dato duro, la vía es una demo o su documentación de producto.

**Herramientas de inventario en general (patrón, no cita puntual).** El patrón dominante
para catálogos grandes es search-first + filtros facetados + listas virtualizadas, con la
categoría como **filtro**, no como árbol de navegación obligatorio.

Fuentes:
- [Set up item grid — Square Support](https://squareup.com/help/us/en/article/8334-set-up-item-grid)
- [Square for Retail POS App: Actions and Defaults](https://squareup.com/help/us/en/article/5777-square-retail-pos-app-actions-and-defaults)
- [How many item grid pages can you have? — Square Community](https://community.squareup.com/t5/Archived-Discussions-Read-Only/How-many-item-grid-pages-can-you-have/td-p/32873)
- [Quick Tile setup for categories? — Square Community](https://community.squareup.com/t5/Orders-Menu-Items-Catalog/Will-Square-Retail-have-an-Items-Grid/m-p/175024)
- [Optimizing Large Lists in React: Virtualization vs Pagination — IGNEK](https://www.ignek.com/blog/optimizing-large-lists-in-react-virtualization-vs-pagination)
- [Pagination vs infinite scroll — LogRocket](https://blog.logrocket.com/ux-design/pagination-vs-infinite-scroll-ux/)
- [Case insensitive UNIQUE constraints in Postgres — Sean Huber](http://shuber.io/case-insensitive-unique-constraints-in-postgres/)
- [Fudo (referencia general de producto)](https://www.comparasoftware.com.ar/fudo) · [Bistrosoft (referencia general)](https://bistrosoft.com/ar/bistrosoft/) — *no verifican comportamiento con catálogos grandes*

---

## E) Impacto en datos / contrato

**Todo aditivo.** Nada de lo propuesto altera el modelo de ventas ni de plata.

### Numeración de migraciones — cuidado con la colisión

- `main` llega a **029** (`029_split_leg_generico.sql`).
- La branch parkeada `feat/stockflow-split-dos-electronicas` **ya ocupa 030, 031, 032, 033**.
- → El próximo libre "formal" en main es 030, **pero usarlo colisiona** con la branch de
  pagos cuando se mergee. **Este trabajo debe arrancar en `034`.**

### Objetos nuevos propuestos (contrato a congelar antes del SQL)

| Objeto | Tipo | Nota |
| --- | --- | --- |
| `categories_nombre_uq` | índice único parcial `(store_id, unaccent_simple(name)) where status='active'` | Reusa `unaccent_simple` (ya existe, `immutable`). Sin extensiones nuevas |
| Normalización de nombres existentes | migración de datos | `trim` + colapso de espacios; reporte de colisiones |
| `fusionar_categoria(p_store_id, p_origen, p_destino)` | RPC | Reasigna `products.category_id`, archiva la origen. `SECURITY DEFINER`, owner-only, con conteo devuelto para el preview |
| `productos_buscar(p_store_id, p_q, p_categoria, p_limit, p_offset)` | RPC o query con `.range()` | Búsqueda/paginación server-side por `lower(name)` + código. **El índice ya existe**: `products_name_idx (store_id, lower(name))` (`001:124`) |
| `producto_por_codigo(p_store_id, p_codigo)` | RPC | Resolver de escaneo server-side — **mata el Riesgo 0**. Necesita índice sobre `product_barcodes(barcode)` (verificar si ya existe) |
| Pin de POS | columna `products.pos_pin_order int null` (a definir) | Solo si el owner aprueba los "rápidos" manuales (G2) |

### Cotas a agregar (baseline, aditivas y sin contrato nuevo)

- `store_alerts.low_stock` y `expiring` → `LIMIT` (`006:109-123`).
- `dashboard_summary.restock` → `LIMIT` (`027:412-434`).
- `reportes_summary.by_category` → `LIMIT` + slice en cliente (`009:168-182`).
- `categories` en `admin/productos/page.tsx:24` → `.limit()`.
- `product_barcodes` en `ingreso/page.tsx:28` → agregar `.order()` (truncado determinista).

### Dependencia nueva

Virtualizar requiere una librería (no hay ninguna). `@tanstack/react-virtual` es la opción
liviana y headless. **Toda dep nueva requiere aprobación explícita del owner** (CLAUDE.md).
Alternativa sin dep: "mostrar más" incremental (peor UX, cero riesgo). → Pregunta G4.

---

## F) Plan por fases

Secuenciado para **no colisionar con el trabajo de pagos ya en main ni con la branch
parkeada**: nada de esto toca `sales`, `sale_payments`, `payment_intents` ni las RPCs de
cobro. Migraciones desde **034**.

### Fase 1 — Parar la corrupción y las queries sin techo (lo urgente)

1. **Resolver de escaneo server-side** en POS (`producto_por_codigo`) → el escaneo deja de
   depender del precargado. **Mata el Riesgo 0.**
2. **Aviso de truncado** provisional donde haya `limit(500)`: si vuelven 500 filas, decirlo
   ("mostrando 500 de N") en vez de mentir en silencio. Barato y honesto.
3. **Cotas del baseline**: LIMIT en `low_stock`, `restock`, `by_category`, `categories`;
   `.order()` en los barcodes de Ingreso.
4. **Alta rápida del POS con categoría** (corta la fábrica de "Sin categoría").

> Fase 1 es casi toda backend/SQL, sin rediseño visual → se puede mergear rápido y es
> independiente del resto.

### Fase 2 — Búsqueda server-side + de-duplicación de categorías

5. `productos_buscar` con `q` / `categoria` / `limit` / `offset` → Productos y POS dejan de
   precargar el catálogo entero; búsqueda por **nombre y código**.
6. Índice único de categorías + migración de normalización + `fusionar_categoria`.
7. **Combobox pick-or-create** con aviso de parecidos (reusando `normalizar()`/`buscarParecidos()`).
8. Pantalla de administración de categorías (scope a confirmar — G1).

### Fase 3 — Densidad y agrupación (lo que el owner ve)

9. Drill-down de Productos (índice → lista → ficha) con umbral de catálogo chico.
10. Chips con techo + "Más" + contadores (`category-chips.tsx`).
11. POS: tiles curados con techo, empty state accionable, pines si se aprueban.
12. Los tres modos de densidad (vacío / chico / grande) y el relleno con trabajo pendiente.
13. Virtualización de las listas largas (si se aprueba la dep).

### Fase 4 — Avanzado (solo con señal real)

14. Índice trigram/`pg_trgm` para búsqueda difusa, si la búsqueda por prefijo se queda corta.
15. Subcategorías — **explícitamente NO en esta versión**.
16. Load test con catálogo sintético de 2000 SKUs (gate del baseline antes del primer cliente grande).

### Qué NO hacer (consolidado)

- No dejar el `limit(500)` "por ahora": es una falla silenciosa que **fabrica productos duplicados**.
- No accordion multinivel ni árbol de categorías. No subcategorías todavía.
- No paginación numerada (1 2 3…) — veneno en mobile. "Mostrar más" o virtualización.
- No scroll horizontal como único acceso a categorías.
- No obligar a elegir categoría al crear un producto (si bloqueás, el cajero inventa "Varios 2").
- **No autocrear categorías desde texto libre** — es literalmente la máquina de fabricar "Golosina"/"Golosinas".
- No renombrar ni fusionar sin preview de cuántos productos se mueven.
- No reordenar los tiles del POS en vivo.
- No llenar el vacío con decoración: llenarlo con trabajo pendiente.

---

## G) Preguntas abiertas para el owner

1. **Pantalla de categorías: ¿entra en esta tanda?** ¿Una pantalla completa en
   Configuración (crear / renombrar / color / orden / fusionar / archivar), o por ahora
   solo el combobox con de-duplicación dentro del diálogo de producto? *(Recomendación:
   el combobox es lo mínimo viable; la pantalla de fusión es lo que salva a un negocio ya
   ensuciado — pero puede ir en una segunda tanda.)*
2. **Rápidos del POS: ¿automático solo, o con "fijar" manual?** El automático por `sold14d`
   ya existe. El pin manual resuelve lo que nunca lidera por ritmo (pan, fraccionados,
   cigarrillos sueltos) pero **requiere columna nueva + UI**. ¿Lo incluimos?
3. **Duplicados existentes: ¿auto-merge o preguntar?** Si al aplicar el índice único
   aparecen colisiones (hoy en el DB local **no hay ninguna**: Almacén, Bebidas,
   Cigarrillos, Golosinas), ¿fusionamos automáticamente por norma o frenamos y te
   mostramos la lista para decidir caso por caso? *(Recomendación: preguntar — fusionar
   categorías mueve productos y es difícil de revertir.)*
4. **Virtualización: ¿aprobás la dependencia nueva** (`@tanstack/react-virtual`, headless,
   liviana) o preferís "mostrar más" incremental sin dep?
5. **Umbrales**: propuse **40 productos** (índice sí/no) y **24 tiles** de POS por criterio
   de producto. ¿Los validamos contra un catálogo real antes de fijarlos?
6. **Orden de arranque**: ¿empezamos por el **Riesgo 0** (escaneo server-side, invisible
   pero es el que corrompe datos) o por el **rediseño de Productos** (que es lo que ves)?
   *(Recomendación fuerte: Riesgo 0 primero — cada día con catálogo grande genera
   duplicados que después hay que limpiar a mano.)*
