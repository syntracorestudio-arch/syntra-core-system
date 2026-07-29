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

---

*Fuentes de código: migraciones 003/008/010/011/012/016/034-036 ·
`src/app/pos/actions.ts` · `src/components/pos/pos-screen.tsx` ·
`src/app/admin/productos/actions.ts` · `src/app/admin/ingreso/*` ·
`scripts/importar-sepa.mjs`, `normalizar-producto.mjs`, `leer-zip.mjs` ·
`supabase/seed_escala.sql` · docs: prd, roadmap, database, business-rules,
inventario-escala-audit, despliegue-plan, rpc-contracts.*
