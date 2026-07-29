# StockFlow — Onboarding de catálogo: audit + plan

> **Estado: PROPUESTA (2026-07-30) — sin código, sin migraciones.**
> Objetivo: definir la mejor forma de cargar el catálogo de un cliente NUEVO
> (kiosco/almacén AR real, 800–2000+ SKUs). La carga manual uno-por-uno es
> inviable: pierde al cliente. El PRD ya lo declara riesgo nº1
> (`docs/prd.md` §riesgos: "Carga inicial del catálogo (barrera nº1)").
>
> Investigación: código real verificado (migraciones 003/008/010/011/012/034-036,
> `pos/actions.ts`, `ingreso-client.tsx`, `scripts/importar-sepa.mjs`), queries
> read-only a la DB local, benchmark con fuentes.

---

## 0. Confirmación previa: los nombres raros del catálogo de prueba

"Alfajor Jorgito zero 3", "Rumba familiar 4" y similares son **datos sintéticos
generados** por `supabase/seed_escala.sql:130-134`: el seed combina base ×
variante × sufijo numérico (`v_nombre := base || ' ' || variante || ' ' || 1+i%9`),
por eso un grep literal del nombre completo da 0. En la DB local existen **solo
en "Kiosco Escala"** (store `3333…`, la tienda de prueba del seed de escala; 14
filas matching) — 0 filas en El Trébol/Doña Rosa (fixture) y **0 filas en
`catalogo_publico`**. El seed de escala no toca el catálogo público y nunca corre
en producción (regla del plan de despliegue: "nunca correr NINGÚN
`supabase/seed*.sql`"). Contenido, sin fuga. ✔

---

## A. Reuse audit — lo que YA existe

### A.1 El catálogo público (migraciones 011/012): máquina sí, datos no

`catalogo_publico` es **identidad global por diseño** — regla de privacidad
explícita en el header de 011: solo código+nombre+marca, **nunca precio, stock ni
ventas**; sin `store_id`.

| Campo | Nota |
|---|---|
| `ean` (PK) | también acepta claves `n:slug` para productos sin EAN (012) |
| `nombre`, `marca` | identidad |
| `fuente` | `'sepa'` \| `'comunidad'` |
| `confirmaciones` | señal de confianza anónima (cuántos negocios lo confirmaron) |

**RPCs**: `catalogo_buscar(ean)` · `catalogo_buscar_nombre(texto)` (unaccent
ilike, prefijo primero, limit 12) · `catalogo_aportar` (dedup por EAN; si el
nombre coincide +1 confirmación; nunca pisa; sin moderación) ·
`catalogo_vincular_ean` (vincula una clave `n:` a un EAN real).

**Cobertura REAL hoy: 36 filas.** Son el seed curado de la migración 012
(cigarrillos + mostrador: SEPA publica **0 cigarrillos sobre 83.730 productos**,
verificado al construirla). Probes locales: coca 0 · quilmes 0 · yerba 0 ·
marlboro 4. **El import masivo nunca se corrió** — la promesa "escaneá y el
nombre aparece" hoy es falsa en la práctica.

### A.2 El import SEPA (`scripts/`): ETL completo, nunca ejecutado a escala

`importar-sepa.mjs` (+ `normalizar-producto.mjs` + `leer-zip.mjs`) es un pipeline
terminado: CKAN `datos.produccion.gob.ar` → ZIP diario (~329 MB) → ZIP por cadena
→ `productos.csv` pipe-delimited → filtro EAN 8-14 dígitos → normalización de
descripciones de góndola (sufijos de empaque, encoding roto, Title Case) → merge
por EAN "el nombre más largo gana" → `confirmaciones = cadenas que lo vieron` →
upsert en tandas de 1000 con `--dry-run`. Corrida manual (sin npm script ni
cron). Licencia de los datos: CC-BY 4.0 (solo atribución).

Notas para la corrida real: hay un bug conocido de descarga silenciosamente
truncada documentado en el propio script (verificación de `content-length` ya
agregada); `normalizar-producto` no tiene tests y `tieneEncodingRoto` es código
muerto.

### A.3 Dónde se usa el catálogo hoy: SOLO en el POS

Flujo actual del scan-miss (el único integrado): escaneo → miss local →
`producto_por_codigo` (RPC 034, dedup server-side) → miss → `catalogo_buscar` →
**alta rápida con nombre prefilled** ("Lo reconocimos. Revisá el nombre y poné tu
precio") + typeahead `catalogo_buscar_nombre` + **contribute-back silencioso**
(`catalogo_vincular_ean` si eligió del catálogo, `catalogo_aportar` si tipeó).

**Gaps encontrados:**
1. **Admin `createProduct` e Ingreso: cero integración** — ni lookup ni
   contribute-back. El alta manual completa no recibe ayuda del catálogo.
2. **Bug**: en el alta por texto (sin barcode) el typeahead queda deshabilitado
   (early-return con `sugerencia` truthy) y no se contribuye nada.
3. **Seguridad**: los RPCs `catalogo_*` son anteriores al revoke global de 016 y
   no tienen gate interno → verificar y **revocar EXECUTE de `anon`**
   (hoy la única barrera es `requireSession()` en la capa de actions).
4. El catálogo **no trae categoría ni precio** (por diseño) → la categoría tiene
   que salir de otro lado (ver §C: chip sticky de sesión).
5. Cero tests de los RPCs de catálogo; `rpc-contracts.md` no documenta ninguno.

### A.4 Los 4 caminos de carga existentes — ninguno es masivo

No existe NINGÚN código CSV/XLSX en `src/` ni dependencias de parsing.

| Camino | ¿Crea producto? | ¿Costo? | ¿Stock? | Ritmo real |
|---|---|---|---|---|
| POS alta rápida (`quickCreateProduct`) | sí | **NO** | **NO** (queda 0) | ~10 s/SKU |
| Admin ProductDialog (`createProduct`) | sí | sí | sí (`initial_stock` → ledger `initial`) | ~60-90 s/SKU (modal) |
| Ingreso (`register_purchase`) | **NO — solo repone** | sí | sí (delta) | ~10 líneas/3 min, con scanner |
| `adjust_stock` | no | no | sí | owner-only, 1 producto/call |

**Hallazgos estructurales:**
- **Ingreso es el molde natural del loop de onboarding** (scanner wedge+cámara,
  costo prefilled con radar de inflación, vencimientos, margen en vivo, submit
  por tandas jsonb)… pero (a) no puede crear productos (`product_not_found`),
  (b) el scan-miss muere en "no está en tu catálogo" sin ofrecer alta, y (c) es
  **la única página que quedó con el preload pre-Fase-2**: caps duros de 500
  productos alfabéticos + 2000 barcodes + 3000 filas de ledger → con 2000 SKUs,
  ~75% del catálogo es inalcanzable para recibir mercadería. Deuda que el
  onboarding vuelve urgente (§F3).
- `products.stock` no es escribible por `authenticated` (grant por columna) y
  `stock_ledger` no tiene insert grant → **toda carga masiva de stock pasa por
  RPC definer o service_role**. `adjust_stock` es 1×call → 2000 SKUs serían 2000
  round-trips: hace falta un camino batch.
- `adjust_stock` con reason `'initial'` **no guarda `unit_cost`** → las cargas
  iniciales son invisibles para la métrica "comprado" y el radar de costos.
- **Categorías**: no se pueden crear desde la app, sin `unique(store_id, name)`
  ni normalización (duplicados "Golosinas"/"golosinas " partirían reportes), y
  las dos listas default (010 vs seed_escala) ya driftearon.
- **Dedup por nombre server-side: inexistente** (admin: warning client-side
  sobre la primera página de 50). Un import re-corrido duplicaría todo SKU sin
  barcode (~12% del fixture realista).
- Onboarding real hoy: `crearNegocio` (superadmin) → `create_store` → 8
  categorías default → **0 SKUs**. El paso 4 del plan de despliegue dice "Cargar
  catálogo (o importar)" — el "importar" no existe.

**Activos directamente reutilizables para el onboarding:** núcleo ETL de
importar-sepa (upsert 1000, validación EAN, encoding, normalización, dry-run) ·
`register_purchase` ya acepta un array jsonb (precedente directo de un RPC
batch) · el shape SQL probado de `seed_escala` (`on conflict (store_id, barcode)
do nothing`) · **la superficie de limpieza post-carga ya está construida**
(`productos_buscar`, `categorias_resumen`, categorizar en masa con cap 500,
señales "sin costo"/"sin categoría").

---

## B. El cuello de botella real

Cargar un catálogo son TRES datos de naturaleza distinta:

| Dato | Naturaleza | ¿Automatizable? |
|---|---|---|
| **Identidad** (nombre/EAN/categoría/precio sugerido) | pública | SÍ (catálogo + margen default) |
| **Costo** | del negocio (facturas, memoria del dueño) | NO — pero es rápido de dictar y **diferible** |
| **Stock inicial** | del negocio (la góndola física) | NO — es **el campo más caro** de capturar |

Ningún import elimina el conteo físico. Por eso el plan optimiza el **loop
completo por ítem**, con esta tesis:

> **"Listo para vender" ≠ "inventario completo".**
> El mínimo vendible por producto es identidad + precio + categoría. El costo se
> difiere (la señal "sin costo" ya existe y guía la limpieza). El conteo se
> difiere casi siempre: el stock negativo está permitido por default
> (`business-rules`), el monto libre cubre lo no cargado, y el stock real entra
> solo por "Recibir mercadería" con cada reposición de las semanas siguientes.
> **Una sola pasada física; contar únicamente categorías de alto valor
> (cigarrillos).** Tocar 1000 productos dos veces es peor que cualquier UI.

**Prerequisito duro: correr el import SEPA ANTES del primer onboarding.** Con el
catálogo en 36 filas todo scan es un miss y el loop duplica su costo (~6 h vs
~3 h 40 para 1000 SKUs). Sin SEPA cargado, la promesa comercial es falsa.

---

## C. Caminos de onboarding y flujo día-1 recomendado

### C.1 Scan-to-populate — pantalla nueva "Carga inicial" (el corazón)

Modo de sesión (no un modal por producto): fusión de alta rápida + ingreso
optimizada para repetición. Mobile-first; wedge USB (foco permanente, como el
POS) o cámara.

**Setup de sesión (30 segundos, una vez):** margen por defecto (→ precio auto =
costo + margen, redondeado con el redondeo que ya existe en `store_settings`,
siempre editable) y el switch "¿contar stock hoy?" (default NO).

**El loop:**
```
412 cargados · sesión 1h 22m          ← contador vivo
[🥤Bebidas][🍫Golosinas*][🚬Cig]…     ← categoría = CHIP STICKY
⌸ Escaneá el próximo producto…   [📷]
─ HIT del catálogo ─
✓ Coca-Cola 500ml        (editable)
Costo $[ 900 ]   Cant [ — ]           ← Cant solo si "contar: sí"
Precio $1.200 ← auto (30%, editable)
        [ Guardar y seguir ⏎ ]
```

Reglas que sostienen el ritmo:
- **Categoría = chip sticky, no un campo por producto.** El recorrido es físico,
  estante por estante: cambia cada 50-150 ítems con un tap. Por eso la categoría
  **no se difiere** — diferirla regenera la fábrica de "Sin categoría" que el
  drill-down vino a matar. El categorizar-en-masa queda como red de seguridad.
- **Precio es el único campo obligatorio.** Costo primero en el tab-order (el
  kiosquero lo dicta de memoria; costo estimado hoy > costo exacto nunca). Sin
  costo → tipea el precio directo y cae en la señal "sin costo".
- **Enter = guardar + refocus en el scan**, persistencia optimista en background.
  Todo operable sin mouse.
- **Re-scan de algo ya cargado** (mismo producto en dos estantes): no es error —
  "Ya cargado · $1.200" con Cant enfocado para sumar. El dedup de
  `producto_por_codigo` garantiza que no nazcan duplicados.
- **Vencimiento NO está en esta pantalla** (es del flujo de Ingreso; acá mata el
  ritmo).
- **Miss del catálogo: inline, sin cambiar de pantalla** — la misma card con el
  nombre vacío y enfocado + typeahead de `catalogo_buscar_nombre` (el camino que
  ya existe para cigarrillos: elegís de la lista y tu scan vincula el EAN). El
  aporte al catálogo ocurre en silencio (ya cableado en `quickCreateProduct`);
  cero UI de "¿querés contribuir?". Cada miss del cliente 1 es un hit del
  cliente 2 — el efecto de red ya está en el schema.

**Target: 8-12 s/ítem** (hit sin conteo ≈ 8 s; miss +8-12 s; conteo +4-5 s).

**Escritura:** RPC nueva `carga_inicial_item` (producto + barcode + asiento
`initial` **con `unit_cost`**, atómico, gate `can_receive_stock`) o extensión de
`quickCreateProduct` con costo+cantidad. Detalle en §F1.

### C.2 Import CSV — el mínimo que sobrevive un no-técnico

Contexto real: **lo opera la persona de SYNTRA sentada al lado del dueño**, no el
dueño solo. Eso permite recortar:

- **Solo CSV** en MVP (si llega un .xls, el operador lo convierte en el momento;
  parsear xlsx = dependencia nueva = decisión del owner, §G).
- UX: subir archivo → **preview de las primeras 5 filas** con un dropdown por
  columna (`Nombre / Precio / Costo / Código / Stock / Ignorar`, auto-detección
  por header como sugerencia) → "Crear 812 productos" → **resumen honesto**:
  "812 creados · 40 sin precio · 3 códigos duplicados omitidos".
- **La regla estrella: lista de proveedor (solo costos) + margen de sesión =
  catálogo vendible en 10 minutos.** Es la feature, no un edge case.
- Filas sin precio NI costo se importan igual (la identidad sirve) y caen en las
  señales de salud. Todo entra **sin categoría a propósito** → se resuelve con
  categorizar en masa (search-first: "coca" → todos → Bebidas). NO construir
  mapeo de categorías en el CSV.
- Post-import, la caminata física cambia de naturaleza: de carga a
  **verificación por muestreo** (2-3 scans por estante), no revisar los 1000.

### C.3 Alta sin código (panadería, fraccionados, sueltos)

20-60 ítems, **bloque final de ~30 min** de la sesión (no romper el ritmo del
scan). Modo batch tipo planilla: `[nombre][precio][Enter → fila nueva]` con
categoría sticky; emoji/color a los ~12 más vendidos (se vuelven tiles del POS,
que es como se venden). **Cigarrillo suelto = UN producto genérico** (la
contabilidad fina de sueltos no paga su costo de carga); los atados van por el
catálogo curado de 012 + vinculación de EAN. Sin EANs inventados (regla de 012).

### C.4 Secuencia del día 1 (~1000 SKUs)

1. **Pre-día (SYNTRA, remoto):** SEPA importado · store creado · margen/redondeo
   configurados · lector USB probado · pedir el export del sistema viejo si hay.
2. **09:00** — con CSV: import + mapeo (45 min) y saltar a 4 como verificación;
   sin CSV: directo a 3.
3. **09:00-13:00** — caminata física con el scan loop, estante por estante.
   **Bebidas primero** (pocos SKUs, máxima rotación: si el día se corta, lo que
   más vende ya está). Dos personas (dueño dicta costos, operador escanea):
   baja a ~8-9 s/ítem.
4. **13:00-13:30** — cigarrillos como bloque propio, **acá SÍ contar stock**
   (alto valor, precio volátil, sensible a robo).
5. **13:30-14:00** — batch sin código + tiles del POS.
6. **14:00 — go-live**: una venta real de prueba + briefing de 5 min: "lo que no
   está: **monto libre con etiqueta** — mañana lo cargamos" + dónde ver la lista
   de puesta a punto.
7. **Semanas 1-2 (sin visita):** el stock entra solo por Recibir mercadería con
   cada reposición (el costo se completa ahí, prefilled); limpieza guiada por
   las señales de salud.

**La matemática a 1000 SKUs:**

| Escenario | Cuenta | Total |
|---|---|---|
| CSV + verificación por muestreo | 45 min + ~1 h 30 | **≈ 2 h 15** |
| Scan loop sin conteo, ~80% hit (SEPA cargado) | 800×10 s + 200×20 s + 20% pausas | **≈ 3 h 40** |
| Ídem CON conteo total | +1000×5 s | ≈ 5 h 10 (no recomendado día 1) |
| Sin SEPA (todo miss) | 1000×20 s | ≈ 6 h+ → **por eso SEPA es prerequisito** |

**En todos los escenarios recomendados, el cliente vende la misma tarde.** Esa es
la promesa comercial (claim a confirmar, §G).

### C.5 Momentos de confianza

- Contador vivo de sesión + **beat de cierre por categoría** ("🍫 Golosinas
  lista — 143 productos en 26 min"): progreso por estante, no una barra
  abstracta contra "1000".
- Cierre del día como ACTIVO: "824 productos · valor de catálogo $X · 213 sin
  costo · 40 sin categoría".
- Post-onboarding = **las señales de salud que YA existen** (sin costo, sin
  categoría, stock bajo del índice de categorías) reencuadradas como checklist
  "Puesta a punto" las primeras semanas; cada contador linkea al drill-down
  filtrado ya construido.
- **Señal faltante que vale oro** (follow-up): "montos libres repetidos de la
  semana, con sus etiquetas" (el snapshot `product_name` ya se guarda). Cada
  "Fotocopias $500" recurrente es un producto que falta cargar — la lista de
  deuda de onboarding se escribe sola vendiendo.

---

## D. Calidad de datos

- **Dedup por barcode**: ya es duro server-side (`producto_por_codigo` +
  `unique (store_id, barcode)`); el importador CSV lo hereda: código duplicado →
  skip contado en el resumen.
- **Dedup por nombre**: no existe server-side; el importador normaliza con
  `unaccent_simple` y reporta duplicados probables como WARNING en el resumen
  (no bloquea — "Agua Villa 1.5L" vs "500ml" son productos distintos).
- **Listas de proveedor sucias**: reusar `normalizar-producto.mjs` (ya resuelve
  sufijos de góndola, encoding roto, Title Case, marcas S/D→null). Agregarle los
  tests que nunca tuvo cuando se toque.
- **Categoría**: chip sticky en sesión + categorizar en masa post-import. **NO
  auto-asignación por IA en MVP** — candidata futura con datos reales de 2-3
  onboardings.
- **Clase Riesgo-0**: cerrada en el POS; el importador nace con las mismas
  garantías (validación EAN, `on conflict do nothing`, counts honestos, nunca
  "éxito" con filas descartadas en silencio).
- **Categorías (deuda conocida del audit de escala)**: `unique(store_id,
  lower(name))` + creación in-app quedan pendientes; el onboarding MVP no las
  necesita (las 8 default alcanzan) pero un import futuro que cree categorías
  sí.

---

## E. Benchmark

- **SEPA / Precios Claros** — VIVO en 2026: dataset diario, ~70k productos
  (retail + mayorista), CC-BY 4.0.
  [Base SEPA](https://datos.produccion.gob.ar/dataset/sepa-precios) ·
  [SEPA Mayorista](https://datos.produccion.gob.ar/dataset/precios-claros-sepa-mayoristas) ·
  [Precios SEPA](https://www.argentina.gob.ar/economia/industria-y-comercio/defensadelconsumidor/precios-sepa)
- **Loyverse**: import de ítems por CSV con template + round-trip
  export→editar→import. [Loyverse Help](https://help.loyverse.com/help/importing-and-exporting)
- **Square**: import CSV masivo; límites prácticos (~30k SKUs) reportados por
  usuarios — *no oficial*. [Square Community](https://www.sellercommunity.com/t5/Questions-How-To/Importing-Items-into-Square/m-p/86640)
- **Competencia AR de kiosco** — el patrón "carga masiva Excel + remarcado %" es
  estándar del rubro; **GDS publicita "6.500 productos precargados"** → el
  catálogo precargado ya es un claim de mercado en AR (*claims de marketing, no
  verificados*). [GDS Sistemas](https://www.gdssistemas.com.ar/evaluacion/maxikiosco/) ·
  [KioscoSoft](https://www.kioscosoft.com.ar/) ·
  [Gestión Comercio](https://gestioncomercio.com.ar/)
- **Open Food Facts**: 3M+ productos, dump JSONL abierto, uso comercial
  permitido; cobertura AR *no cuantificada* → posible complemento del SEPA para
  identidad (a validar con probes antes de invertir).
  [OFF Data](https://world.openfoodfacts.org/data)
- Migración desde POS competidor (export CSV del sistema viejo): práctica
  estándar de la industria; en AR los sistemas de kiosco son mayormente
  desktop/planillas → asumir CSV/Excel heterogéneo, no APIs.

---

## F. Plan por fases

> **Nota (2026-07-30):** para el kiosco CERO DATOS — probablemente la mayoría del
> mercado — el §H re-scopea esta sección: el pulido de la captura orgánica (F1a)
> va ANTES que la pantalla "Carga inicial" (que se degrada a F1c) y F2 se
> pospone detrás de F3. F0 no cambia: sigue siendo el prerequisito de todo.

Reglas transversales: migraciones **aditivas** desde **037** (030-033 siguen
reservadas por la branch de pagos parkeada), **contrato congelado en
`rpc-contracts.md` antes de cada fase** (sumando los `catalogo_*` que nunca se
documentaron), TDD para todo SQL nuevo, `syntra-scale-security-baseline`
(cotas, gates de membresía, counts honestos), safe-commit-gate por PR, gate
visual del owner para la UI nueva, merge manual del owner.

### F0 — Encender el catálogo (horas; sin código de producto)
Correr `importar-sepa.mjs` completo (local primero, cloud cuando exista),
validar cobertura con probes (coca/quilmes/yerba/serenito/marlboro), vigilar el
bug de descarga truncada. Documentar la corrida (fecha, filas, % con marca) y
los RPCs `catalogo_*` en `rpc-contracts.md`. **Sin esto, nada de lo demás rinde.**

### F1 — MVP "Carga inicial" (~2-3 días + gate visual) → **el MVP del primer cliente es F0+F1**
- **Migración 037**: RPC `carga_inicial_item` — crea producto + barcode +
  asiento `initial` **con `unit_cost`** en una transacción; gate
  `can_receive_stock`; idempotente ante re-scan (si el código existe, devuelve
  el existente para el camino "sumar stock"). TDD con suite propia.
- **Pantalla "Carga inicial"**: sesión (margen default + ¿contar?), loop con
  chip sticky de categoría, miss inline con typeahead, re-scan suma, batch "sin
  código", contador vivo + beat por categoría + resumen de cierre.
- **Hardening que viaja en la misma fase**: fix del typeahead roto del alta por
  texto · revoke EXECUTE de `anon` sobre `catalogo_*` (verificar grants
  primero) · error-check del insert de barcode en admin `createProduct`
  (inconsistencia vs quickCreate).

### F2 — Import CSV (~1-2 días; solo si el cliente trae export o lista de proveedor)
Server action batched (tandas ≤500, patrón de categorizar-en-masa) + UI de
upload/mapeo de columnas/preview 5 filas/resumen honesto. Dedup por barcode
(skip) y nombre (warning). Sin xlsx, sin undo, sin mapeo de categorías, sin
detección de encoding exótica (el operador está presente).

### F3 — Ingreso a escala (~1-2 días; puede ir después del go-live)
La deuda que el onboarding vuelve urgente: migrar Ingreso a search-first (matar
los caps 500/2000/3000 con `productos_buscar` + `producto_por_codigo`), alta
inline en scan-miss (reusar el camino del POS), y catálogo en el ProductDialog
de admin (lookup + contribute-back).

### Explícitamente NO construir en MVP
Parseo xlsx · conteo físico obligatorio/wizard de inventario completo ·
undo/rollback de imports · merge inteligente de duplicados por nombre · mapeo de
categorías desde CSV · fotos/proveedores/facturas · UI de moderación del
catálogo público · modo offline de la sesión · auto-categorización por IA ·
coordinación multi-dispositivo (dos celulares ya funcionan gracias al dedup
server-side).

---

## G. Preguntas abiertas para el owner

1. ¿Los kioscos target suelen tener sistema previo con export (CSV/Excel)?
   ¿Cuáles se ven más (GDS, KioscoSoft, planillas caseras)?
2. ¿Tenés/vas a llevar **lector USB (wedge)** al onboarding? (la cámara no anda
   en iPhone/Safari — `BarcodeDetector` no existe ahí).
3. ¿Qué formatos de **listas de proveedores** manejás hoy? (calibra el mapeo CSV)
4. Margen por defecto de sesión: ¿un único valor global (p. ej. 30%) alcanza
   para MVP, o lo querés por categoría?
5. ¿El onboarding asistido es **parte del precio o servicio pago aparte**? (el
   PRD sugería pago; condiciona cuánta UX debe sobrevivir un dueño solo)
6. ¿Confirmás el claim comercial **"vendés la misma tarde"**? (sostenible según
   la matemática de §C.4)
7. Para F2: ¿autorizás una dependencia de parsing **xlsx** o mantenemos solo CSV?

**Agregadas por el análisis cero-datos (§H):**

8. ¿OK **suprimir el push/email diario de stock bajo** para productos sin
   baseline de stock? (cambia el comportamiento de una alerta que ya corre —
   hoy a un kiosco orgánico le diría "te quedaste sin Coca-Cola… y otros 399
   bajo mínimo" TODAS las mañanas)
9. El techo de **≤10 s por miss en mostrador** es presupuesto de diseño, no dato
   medido — ¿lo validamos con el primer cliente real?
10. ¿OK el **protocolo comercial C-lite** (visita de 60-90 min: cigarrillos con
    conteo + setup; el resto entra vendiendo; caminata completa como opcional
    de semana 3) y su framing en la venta?
11. ¿OK el **reorden de fases** F1a→F1b→F1c con F2 (CSV) detrás de F3?

---

## H. El kiosco CERO DATOS — onboardear vendiendo

> **Este es probablemente el segmento MAYORITARIO del mercado target**: papel y
> lápiz, sin control de stock, nada que importar. No es un edge case del plan —
> es el caso central, y cambia la recomendación de F1.

### H.1 Por qué la caminata de 3-4 h es la venta equivocada acá

Sin datos previos no hay import: el catálogo solo puede nacer capturando ítems.
Pero el kiosquero cero-datos es también el más escéptico — no decidió todavía
que confía en el sistema, y una inversión de 3-4 h ANTES de ver el primer valor
es exactamente lo que no va a bancar. La tesis del doc ("listo para vender ≠
inventario completo") deja de ser una concesión y pasa a ser **el modelo de
onboarding**: cada producto se toca UNA vez — cuando se vende o cuando se
repone — y el sistema demuestra valor desde la primera venta.

### H.2 Tres modelos, cuantificados

Supuestos declarados: ~1000 SKUs en góndola · ~300 líneas de venta/día · Pareto
top 200 SKUs ≈ 80% de las líneas (cigarrillos solos 25-35% en kiosco AR) ·
**SEPA corrido (F0) = ~80% de hit en scan-miss** — sin F0 toda la fricción se
duplica: F0 es aún MÁS crítico en el camino orgánico que en la caminata.

| | **A — Caminata completa** | **B — Orgánico puro** | **C — Híbrido (top ~180 + orgánico)** |
|---|---|---|---|
| Upfront | ~3 h 40 | **~15 min** | **~1 h - 1 h 15** |
| Fricción mostrador día 1 | ~0 | ~150 misses ≈ 25 min (½ de las líneas) | ~55 misses ≈ 9 min (~18%) |
| Fricción día 7 / 14 | ~0 | ~7% / ~2% de líneas | ~3% / ~1% |
| Catálogo ≥90% automático | hora 0 | día 10-14 | **día 4-7** |
| "Vendido hoy" / medios de pago | día 1 | día 1 | día 1 |
| Margen confiable | día 1 (~80% facturación) | converge con restocks (~70% día 21) | **día 1 (~80%)** |
| Low-stock / reponer confiable | solo cigarrillos día 1 (el conteo se difiere igual) | **NUNCA por sí solo** (ver H.5) | cigarrillos día 1; resto = B |
| Costo psicológico | 3 h 40 ANTES de ver valor | cero upfront; el sistema "molesta" cada 2 ventas el día 1 | 1 h; valor visible esa tarde |

**El hallazgo honesto que decide:** en señales de STOCK, A casi no le gana a C —
el propio plan difiere el conteo salvo cigarrillos, así que la caminata completa
tampoco compra alertas de reposición. Sus 2 h 30 extra compran solo margen de la
cola (~20% de la facturación) y cero fricción la primera semana. **C captura
~80% del beneficio al ~30% del costo; B-pulido captura el resto vendiendo.**

### H.3 Reuse audit del camino orgánico: mayormente CONSTRUIDO

Lo que ya existe (verificado):
- **Scan-miss → alta rápida**: nombre SEPA prefilled ("Lo reconocimos…"), precio
  con autoFocus, typeahead del catálogo, contribute-back silencioso, dedup
  server-side, y el producto cae al carrito con la venta siguiendo. HIT real ≈
  **5-8 s**; miss 12-20 s.
- **Monto libre** como escape del mostrador (primario en el empty-state a
  propósito): cobra sin bloquear la venta, snapshot `product_name` guardado.
- Diferencial de mercado real: **Loyverse no tiene alta-en-venta** (hay que ir
  al back office) y el Auto Create de Square generó quejas por PISAR nombres
  propios — nuestro diseño (prefill editable + `catalogo_aportar` que nunca
  pisa) ya es el correcto.

Lo roto o faltante para que "onboardear vendiendo" sea genuinamente bueno:

| # | Gap | Detalle |
|---|---|---|
| 1 | **Gate de cajero UI ≠ server** | La UI del POS exige owner (`canCreate={isOwner}`) pero el server acepta `can_receive_stock` (default true). Un cajero con permiso ve "No tenés permiso…" con el scanner muerto en plena venta. **Fix de 1 línea que desbloquea el modelo entero** cuando el dueño no atiende el mostrador. |
| 2 | Sin captura de costo | Alta rápida no captura costo (correcto en mostrador) y no existe NINGÚN momento posterior que lo pida → backfill post-venta (H.6). |
| 3 | `price_updated_at` nunca se setea | Todo el catálogo orgánico nace marcado "precio viejo" en `data_health.stale_prices` (falso positivo latente — hoy no se renderiza; arreglar antes de que se muestre). |
| 4 | Typeahead roto en alta por texto | Ya identificado en §A.3; en orgánico duele más. |
| 5 | Sin indicador de progreso | Nada trackea completitud ni celebra el llenado (H.6). |
| 6 | Sin agregación de montos libres | El snapshot existe pero nada lo agrega — la "lista de deuda que se escribe sola" hay que construirla. |
| 7 | **Las señales de stock mienten** | Ver H.4 — el bloqueante más serio. |

### H.4 Las señales que mienten con catálogo a medias — "modo puesta en marcha"

Un producto nacido por alta rápida arranca `stock 0, cost null, sin categoría` y
vende hacia stock NEGATIVO (permitido por default). Para el sistema de señales,
ese estado normal es una emergencia:

| Señal | Qué muestra en falso (kiosco orgánico ~400 SKUs) | Acción |
|---|---|---|
| `low_stock_products` (umbral default 3) | **100% del catálogo desde la creación** (`0 ≤ 3` antes de la primera venta) | raíz — filtrar por `stock_confiable` |
| Push/email diario 09:00 | *"Te quedaste sin Coca-Cola 500ml… Y otros 399 productos bajo mínimo"* — **todas las mañanas** (dedupe por día) | **suprimir** no-confiables (la señal más dañina: día 2 = desinstalación) |
| Dashboard "Para reponer" | catálogo entero; `dias_restantes` **negativo en rojo** | filtrar por confiables + reframe del vacío |
| Grilla del POS | **cada producto orgánico pintado "sin stock"** en la pantalla del cajero | badge "sin contar" en vez del tratamiento agotado |
| `shelf_value` | **$0** con la góndola físicamente llena | suprimir durante el modo |
| `by_category` | una sola barra "Sin categoría" = 100% (drill-down neutralizado) | se cura solo con el categorizar-en-masa semanal |
| `dead_stock` | — | **ya está bien guardado** (stock>0 + cost + 30 días): es el modelo a imitar |
| `top_units`, "Vendido hoy", medios de pago | correctos desde la venta 1 | **intactos — es lo que ve el escéptico el día 1** |
| `cost_coverage` + banner "Cargar costos (N)" | verdad útil | intacto — motivador de progreso |

**Mecanismo:** flag por producto **`stock_confiable`** = tiene al menos un
asiento de baseline en el ledger (`initial`, conteo/ajuste, o "total en góndola"
de H.5). Derivable del ledger — sin migración de schema obligatoria; si se
materializa, es aditivo (037+). Fin del modo: **automático y por producto** (el
flag prende con su primer baseline); la card de progreso se retira sola (H.6).
Sin switch manual. Nota: el único eje de madurez que existe hoy (`days_of_use`
de Reportes) va por edad de VENTA — el onboarding orgánico es exactamente edad
alta + catálogo incompleto, el eje nuevo es completitud.

### H.5 La pieza de convergencia: "total en góndola" en Recibir mercadería

"Recibir mercadería" con delta **no alcanza** para el orgánico: el producto nace
en 0 → vende a −8 → ingreso +30 → el sistema dice 22 pero la góndola tiene
`inicial_desconocido + 22`. **El corrimiento es permanente: sin baseline, el
low-stock orgánico no converge NUNCA.** El fix es un campo opcional en el propio
ingreso (el dueño ya está parado frente al estante reponiendo):

```
Coca-Cola 500ml · stock según sistema: -8
Llegaron: [ 30 ]
¿Cuántos tenés EN TOTAL ahora, contando lo que llegó? [ 41 ]  ← opcional
```

Un campo: escribe ajuste-a-total (baseline) + costo del ingreso, y ese producto
prende `stock_confiable` para siempre. Con esto el orgánico converge producto a
producto en 2-6 semanas. Complemento opcional: micro-conteo "contá un estante"
= la misma pantalla de sesión de F1c con el conteo prendido, framing *"cada
estante que contás enciende sus alertas"*.

### H.6 Recomendación día-1 para el kiosco cero-datos

**Protocolo C-lite (60-90 min) + la maquinaria orgánica como LA inversión de
producto.** La visita: setup (margen default, redondeo, tiles de sueltos) →
**cigarrillos como bloque CON conteo** (única categoría donde las señales de
stock pagan día 1: alto valor, precio volátil, sensible a robo) → bebidas si
sobra tiempo → **todo lo demás entra vendiendo**. Framing comercial: *"Hoy
cargamos lo que más plata mueve. El resto se carga solo: cada producto lo tocás
UNA vez."* La caminata completa queda como opcional de semana 3 para un dueño ya
convencido — casi siempre innecesaria.

Por qué la inversión de código va al orgánico y no a la pantalla dedicada: **el
mostrador pulido sirve al 100% de los clientes para siempre** (todo producto
nuevo del universo entra por ahí, también post-onboarding); la pantalla de
sesión se usa una vez por cliente.

Las piezas de producto (mobile-first):
- **First-sale sheet** (pulir alta rápida): sheet desde abajo con **numpad
  grande** (el del monto libre), **precio como ÚNICO campo** — la categoría acá
  SÍ se difiere (la regla del chip sticky era para la caminata; en mostrador el
  orden es aleatorio y la absorbe el categorizar-en-masa semanal) — y escape
  **"Cobrar sin cargar"** (monto libre con la etiqueta SEPA prefilled en el
  snapshot → alimenta la lista de deuda en vez de perderse). Presupuesto: **≤10 s
  por miss, techo duro 15 s** (menos que un pago con tarjeta); hit-SEPA ≈ 6-8 s.
- **Backfill de costo post-venta, en momento muerto**: chip no-bloqueante tras
  cerrar ticket — *"3 productos nuevos hoy · ¿les ponés costo?"* → filas
  `[nombre | $costo | skip]`. Nunca interrumpe el próximo scan.
- **Card "Puesta en marcha"** (dashboard, arriba): la métrica es el **% de
  líneas de HOY que salieron con scan automático** — nunca una barra contra
  "1000 productos" (denominador fantasma que deprime); el % sube solo (~50% día
  1 → ~75% día 3 → ~93% día 7). *"Día 3 · 148 productos cargados · 84% de tus
  ventas de hoy salieron automáticas"* + accesos a costos/categorizar. Retiro
  automático: 7 días ≥95% → "Tu catálogo ya trabaja solo". En el POS solo un
  toast al cierre de caja ("Hoy cargaste 22 productos vendiendo").

### H.7 Impacto en F1 — re-scope

**Respuesta directa: pulir la captura orgánica va ANTES que la pantalla "Carga
inicial", y la pantalla se degrada a un modo fino que reusa lo mismo.** No se
elimina (el bloque de cigarrillos del día 1 y los micro-conteos la necesitan),
pero deja de ser el corazón.

- **F0 — SEPA: intocado y MÁS crítico.** En orgánico cada miss ocurre con un
  cliente esperando; sin prefill el alta revienta el presupuesto de latencia.
- **F1a (NUEVO, primero, ~2-3 días): pulido orgánico.** First-sale sheet +
  escape con etiqueta + backfill de costo + `stock_confiable` + gating de
  señales (cron, dashboard, POS grid, shelf_value) + card "Puesta en marcha".
  Los fixes que ya estaban en F1 viajan acá (typeahead, revoke `anon`, +
  **gate de cajero UI≠server** y **`price_updated_at` en el alta**).
- **F1b (~1 día): "total en góndola" en Recibir mercadería.** RPC de
  ajuste-a-total + costo atómico (aditiva, TDD, contrato congelado antes).
- **F1c (post-go-live): pantalla de sesión** fina reusando los componentes de
  F1a — unifica caminata inicial, bloque de cigarrillos y micro-conteos. Para
  el primer cliente alcanza su versión mínima.
- **F2 (CSV): detrás de F3** — irrelevante para el segmento mayoritario; se
  activa si un cliente concreto trae archivo.
- **F3 (Ingreso a escala): sube de prioridad** — Ingreso es el motor de
  convergencia del orgánico y F1b vive adentro; conviene sanearlo cerca.

### H.8 NO construir (además de lo del §F)

Barra de progreso contra un total fantasma · gamificación (rachas/badges) ·
prompts de costo bloqueantes en mostrador · wizard "contá todo para activar
alertas" · switch manual global de "modo puesta en marcha" (todo automático por
producto) · campo categoría en el alta de mostrador.

### H.9 Benchmark adicional

- **Square "Auto Create"**: crear ítems escaneando GTIN con prefill de
  nombre/imagen/descripción desde catálogo + IA — pero con quejas reales de
  usuarios por autofill invasivo que PISA nombres propios.
  [Square Auto Create](https://squareup.com/help/us/en/article/7992-automate-item-creation-with-square-for-retail) ·
  [queja "Please Stop Invasively Auto-Creating"](https://community.squareup.com/t5/Orders-Menu-Items-Catalog/Please-Stop-Invasively-Auto-Creating-Item-Name-Based-on-UPC/m-p/720232)
  → Lección: prefill siempre editable, nunca sobreescribir — el `catalogo_aportar`
  que "nunca pisa" ya es el diseño correcto.
- **Loyverse**: no tiene alta-on-the-fly desde la pantalla de venta (ítems se
  crean en el back office). [Loyverse items](https://help.loyverse.com/help/how-add-items-loyverse-back-office)
  → La alta rápida en scan-miss es un **diferencial de mercado**, no un parche.

*Fuentes de código adicionales §H: `low_stock_products` (001), cron de alertas
(`api/cron/alerts`), `dashboard_summary`/`reportes_summary` (034),
`categorias_resumen` (036), `store_settings` defaults (001/015/019),
`register_sale` monto libre (003/023/028), gates de alta rápida
(`pos/actions.ts` + `pos-screen.tsx`), umbrales de Reportes
(`reportes-client.tsx`).*

---

*Fuentes de código: migraciones 003/008/010/011/012/016/034-036 ·
`src/app/pos/actions.ts` · `src/components/pos/pos-screen.tsx` ·
`src/app/admin/productos/actions.ts` · `src/app/admin/ingreso/*` ·
`scripts/importar-sepa.mjs`, `normalizar-producto.mjs`, `leer-zip.mjs` ·
`supabase/seed_escala.sql` · docs: prd, roadmap, database, business-rules,
inventario-escala-audit, despliegue-plan, rpc-contracts.*
