# Vencimientos — auditoría y propuesta

**Base:** `main = 3e3a024`, verificado al día · **Seed:** Kiosco Escala, 2007 productos, 6 lotes pendientes.
**Estado:** ✅ **IMPLEMENTADO** (P0 + parcial), aprobado por el owner 2026-08-20.
Fuera de alcance por decisión suya: acción masiva (prematura con 6-20 ítems y cero
clientes), PushCard fuera del lugar prime (P2) y los tokens de elevación (Anexo C).
**Tooling:** `design-director` (dirección) · `product-experience-designer` (flujo) · `ui-ux-pro-max` dataset `ux-guidelines` (auditoría a11y/jerarquía, uso correcto según `design-layer-plan.md §4`) · Playwright (medición a 360/390/1920).

---

## 0 · Tres correcciones al encuadre del pedido

Las tres cambian el espacio de soluciones, así que van primero.

### 0.1 · El ancho NO viene del shell compartido

`AppShell` renderiza `<main className="flex-1 …">` — **sin `max-w`**. El límite sale de
`vencimientos-client.tsx:141` (`max-w-3xl`), **local a esta sección**. Cambiarlo no toca
ninguna de las otras 11.

Además hay precedente: dashboard, reportes, reposición, productos y asistente ya usan
`max-w-6xl`. Hoy conviven `xl/2xl/3xl/4xl/6xl` en **19 copias** del shell.

⇒ La restricción "no toques el shell compartido" se cumple sin esfuerzo, y mover esta ruta a
`6xl` **reduce** el vocabulario de anchos en vez de ampliarlo.

### 0.2 · El `<select>` no es un problema de peso: es de corrección

| Medido | Valor |
|---|---|
| Opciones en el `<select>` | **501** |
| Productos activos en el catálogo | **2007** |
| **Productos inalcanzables desde esta pantalla** | **1507 (75%)** |
| Peso del precargado | ~19 kB |

`inventario-escala-audit.md:79` lo enmarcó como "selector inusable a 1000+". La medición dice
algo peor: **no podés cargar el vencimiento de tres cuartos de tu catálogo**, y la pantalla no
lo dice. No hay buscador. El peso (~19 kB) es lo de menos.

### 0.3 · La sugerencia de promo ya está cableada y ya excluye vencidos

`page.tsx:44-48` la pide y `vencimientos-client.tsx:186-234` la renderiza. `promos_sugeridas`
filtra `e.expiry_date >= current_date` (`045:953`) — **ese filtro es la regla de negocio en
SQL**, no un detalle. No hay nada que conectar: falta *separar* los grupos visualmente.

---

## 1 · Lo que la medición encontró

### Densidad — el arquetipo declarado no se cumple

`design-layer-plan.md §2.A` pide **36px** en listas admin de escritorio y **3-5 datos por
fila**. Medido:

| | 1920 | 390 | 360 |
|---|---|---|---|
| Alto de fila | **117px** | 133px | **133px** |
| Datos por fila | 3 | 3 | 3 |
| Nombres truncados | 0/6 | 6/6 | **6/6** |
| Scroll para ver 6 ítems | — | — | **1369px (2,1 pantallas)** |
| Ancho de contenido | 768px | — | — |
| Aire muerto | **688px izq + 464px der** | — | — |

El 60% de la altura de fila son dos botones de ~330px para acciones de 1-2 usos por lote. Y a
360 los seis nombres truncan sobre un catálogo con *"Aceite Cocinero chico"*, *"chico 6"* y
*"chico 9"*: **las filas quedan ambiguas justo donde el nombre es el único identificador**.

### Plata en juego — el dato que falta y por qué eso rompe el arquetipo

`pending_expiries` (`006:72-83`) no trae `price` ni `cost`. Con la lista ordenada por fecha,
así queda hoy contra la plata real del seed:

| Orden en pantalla | Producto | Valor en juego |
|---|---|---|
| 1º | Aceite Cocinero chico | $12.000 |
| 2º | Aceite Cocinero 2.25L 3 | $19.200 |
| **3º** | **Aceite Cocinero 500g** | **$42.000** |
| 4º | Aceite Cocinero 2.25L | $21.600 |
| 5º | Aceite Cocinero chico 9 | $24.200 |
| 6º | Aceite Cocinero chico 6 | $20.000 |

**Total en riesgo: $139.000.** El lote más caro está tercero. El arquetipo declarado dice
*"llega ordenada por plata en juego"* — hoy es literalmente falso, y no puede ser verdadero
porque el dato no existe en la vista.

> ⚠️ **`cost` NO puede entrar a la vista.** `051` revocó el SELECT de tabla en `products` y lo
> re-otorgó por lista: `price` está, `cost` **no**. `pending_expiries` es `security_invoker`,
> así que meter `p.cost` haría **explotar la consulta entera con `permission denied` para
> cualquier empleado** — la sección no se degrada, se rompe. El número honesto es
> `qty × price` = **lo que dejás de vender**. El margen vive en Reportes.

### Hallazgos que no estaban en el pedido

1. **Merma irreversible de un click.** "Tuve que tirarlo" escribe un asiento `waste` negativo
   en `stock_ledger` (append-only por `revoke update, delete`, `001:538`) **sin confirmación ni
   deshacer**. El dataset `ux-guidelines` marca esto severidad **alta**.
2. **El parcial obliga a mentir.** Vencen 6, se vendieron 4, tiraste 2. Hoy elegís entre dos
   datos falsos: *"Se vendió"* (la pérdida nunca se registra → el motor de promos decide con
   datos inflados) o *"Tuve que tirarlo"* (−6 → el stock queda 4 corto y la app avisa faltante
   de algo que está en la góndola). `resolve_expiry` **ya acepta `p_waste_qty`** (`006:21`)
   pero cierra el lote entero igual, y la UI siempre manda el lote completo.
3. **Permisos al revés del riesgo.** `addExpiry` = `requireOwner()`
   (`configuracion/actions.ts:80`); `resolve_expiry` = `owner || can_receive_stock` (`006:31`).
   ⇒ **El empleado que recibe mercadería puede escribir mermas irreversibles pero no puede
   anotar una fecha.**
4. **Botones que siempre fallan.** Los de resolver no están gateados en la UI; un empleado sin
   `can_receive_stock` los ve, los toca y recibe *"No tenés permiso para esto"*.
5. **Fecha ISO cruda** (`:243`) — `2026-08-08` — mientras la franja de promo tres píxeles más
   arriba usa `fechaCorta` (`lib/promos.ts:237`). Es inconsistencia, no criterio.
6. **`PageHeader.stat` es `hidden … sm:block`** (`page-header.tsx:124`): un resumen de plata
   puesto ahí **desaparece en mobile**, que es justo donde estás parado en la góndola.
7. **El header suma dos tareas distintas.** *"6 pendientes · 6 requieren atención"* mezcla
   papeleo del pasado con plata salvable en un número que no dirige a nada.

---

## 2 · Propuesta

### B · El picker: escanear primero, buscar después

Se borran el `<select>` y el precargado de 500 productos (`page.tsx:33-38`). Entra el binomio
ya probado en Ingreso: input con `buscarParaIngreso(q)` debounced + `CameraScanner` +
`useWedgeScanner`. **Cero código nuevo de búsqueda.**

**Diferencia dura con Ingreso, y es la decisión de diseño del punto:** Ingreso acumula líneas y
confirma al final. Acá **no se batchea**. El dato es una fecha impresa que sólo existe mientras
el paquete está en la mano: si escaneás 12 y después tipeás 12 fechas de memoria, el dato ya se
perdió. **Cada ítem se guarda al confirmarlo**, con botón primario *"Guardar y escanear otro"*
que recicla la hoja y reabre la cámara.

Cámara en `modoInicial="simple"` (se autocierra en la lectura) y no `continuo` como Ingreso:
acá cada lectura exige tipear una fecha, y no podés tener cámara y teclado numérico a la vez.

**Código que no está en el catálogo** — el callejón ya lo resolvió Ingreso, se copia el orden:
`resolverCodigoDesconocido` → *"¿No será este que ya tenés?"* + `vincularCodigo` → alta express
con `quickCreateProduct` exigiendo precio. Nunca *"cargalo cuando lo recibas"*: estás parado
frente a algo que se vence hoy.

**Lote existente con otra fecha** → segundo lote, no se fusiona: la góndola tiene dos tandas y
fusionarlas borra la fecha más temprana, que es la alerta. Con fecha **idéntica** se ofrece
sumar al lote en vez de crear un gemelo.

### C · Densidad y jerarquía

**`max-w-6xl`, columna única.** No dos columnas: *en una cola el orden vertical **es** el
dato*, y dos columnas convierten la prioridad en lectura en zigzag.

**Fila de 44px** (desde 117px), 5 lanes:

| Lane | Ancho | Contenido |
|---|---|---|
| Glyph | `w-5` | emoji, sin chip de fondo (hoy es card-in-card, §2.A lo prohíbe) |
| Identidad | `flex-1 min-w-0` | nombre |
| Cantidad | `w-14` `.tabular` | `6 u.` |
| **Plata** | `w-24` `.tabular` | **`$12.000` — protagonista** |
| Vencimiento | `w-40` | `vence sáb 8 · en 3 días` |
| Acción | `w-36` | **una** primaria según el grupo |

**La plata es el único máximo de contraste de la fila** (`foreground` pleno + `font-semibold`,
≥7:1 por el límite duro de dinero). Todo lo demás baja a `muted-foreground`. Hoy el máximo es
el nombre, empatado seis veces.

**La fila deja de ser card** → `CardList` (colección, fondo hundido) para un grupo y
`CardAlert tone="danger"` para el otro, **hermanos, nunca anidados**. Eso da los 3 niveles de
luminancia del gate #5 sin inventar un token.

**Ambigüedad a 360:** desktop `truncate` (la lane da ~340px a 6xl); mobile `line-clamp-2` — se
paga altura sólo en los nombres largos.

**Resumen de plata:** en la banda del header (`PageHeader.stat`) **más** una línea visible en
mobile, porque `stat` se oculta bajo `sm`. Si el `limit(200)` trunca, el total tiene que
decirlo o computarse aparte: **un total que miente por paginación es peor que no tenerlo**.

### D · Vencido vs. por vencer

**En términos de tarea, no de estética:**

- **Por vencer = todavía es mercadería.** Podés bajar el precio, moverlo al frente, devolverlo.
  La tarea es **decidir**, y tiene ventana: sirve hoy, no el viernes.
- **Vencido = ya no es mercadería, es un registro contable abierto.** Ninguna acción comercial
  existe. La única tarea es **cerrar el registro** para que el stock y el reporte de pérdidas
  queden bien. Es papeleo, no decisión.

**La acción cambia por grupo** — y ésta es la corrección más importante de todo el documento:

> Hoy un lote vencido ofrece *"Se vendió"* con **el mismo peso visual** que *"Tuve que
> tirarlo"*. Dos botones de peso igual invitan a tocar cualquiera para sacarlo de la lista, y
> **ese toque miente en el ledger**.

- **Vencido** → primaria única **"Tirarlo"**. *"Se vendió"* baja a un overflow `⋯` (sigue
  existiendo: el caso real es "lo vendí ayer y no lo marqué").
- **Por vencer** → primaria **"Promo $1.150"**. Nadie tira algo que todavía no venció.

Eso **disuelve la franja de promo** como bloque apilado: sus tres estados (sugerida / ya puesta
/ bajo costo) viven en la lane de acción, en una línea.

### E · Acción masiva

**No existe un botón "Tirar todo lo vencido".** Una sola pulsación sobre un conjunto que no
elegiste explícitamente, escribiendo N asientos irreversibles, es exactamente el patrón que
produce la pérdida masiva accidental. La regla: **seleccionar es reversible, ejecutar no.**

Reusa el patrón ya probado en Productos y el precedente de `RepriceDialog` (*"nadie toca los
precios de todo su negocio a ciegas"*):

1. Botón **"Seleccionar"** → checkboxes + barra sticky `bottom-20` (no `bottom-0`: queda detrás
   del tab bar).
2. Chips que **seleccionan, no ejecutan**: *"Todo lo vencido (7)"* · *"Lo de esta semana (4)"*.
3. Dos acciones asimétricas a propósito: **"Se vendió (7)"** ejecuta directo (benigno, no toca
   stock ni ledger) · **"Tirar (7)"** abre confirmación con lista de productos, cantidades y
   **total en pesos**.
4. Masivo = siempre lote completo. El parcial es individual por definición.
5. Cota dura de **50 lotes** por llamada, validada en el servidor.
6. **Atómico**: un corte a la mitad no puede dejar 4 mermas escritas y 3 no.
7. **Swipe-to-resolve descartado**: es el gesto más fácil de disparar sin querer scrolleando, y
   del lado destructivo no hay vuelta.

### La confirmación de merma

No es *"¿estás seguro?"*: es **la cifra**. *"Vas a registrar 6 u. de Aceite Cocinero 500g como
pérdida: −$42.000. No se puede deshacer."* Botón etiquetado con la acción real
(**"Registrar pérdida de $42.000"**), no "Aceptar".

Y **no se resuelve con toast + Deshacer** como el POS: ahí anular escribe una anulación limpia;
acá "deshacer" sería un asiento compensatorio `+6` que ensucia el reporte de mermas para
siempre. La irreversibilidad está en el grant, así que se **previene** en vez de compensar.

---

## 3 · El desacuerdo entre los dos agentes (tu decisión)

Los dos coincidieron en casi todo y **chocaron en el orden de los bloques**:

| | Decisión | Argumento |
|---|---|---|
| `design-director` | **Vencido primero** | Es un `CardAlert`: requiere acción. Además un vencido sin resolver **falsea el stock**. |
| `product-experience-designer` | **Por vencer primero** | *"Lo vencido tapa lo salvable"*: abrís y lo primero que ves es el papeleo del pasado, no la plata que todavía podés recuperar. |

**Mi recomendación: por vencer primero.** Tu queja #3 fue *"la sección no impulsa la acción"*, y
liderar con papeleo es precisamente por qué no lo hace. Se concilian así: **vencido va segundo
y arranca colapsado con más de 5 ítems** (*"7 vencidos · $139.000 · cerrarlos"*), que conserva
el peso de alerta del director sin empujar lo accionable fuera de pantalla.

⚠️ Con el seed actual (**6 vencidos, 0 por vencer**) la pantalla tiene que mostrar el bloque
"por vencer" vacío con su mensaje propio — no la lista de vencidos disfrazada de alerta activa.

---

## 4 · Prioridades

| | Qué | Por qué ahí | Esfuerzo |
|---|---|---|---|
| **P0** | Picker escaneo + búsqueda server-side; borrar el `<select>` y el precargado | 75% del catálogo es inalcanzable — es corrección, no UX | M |
| **P0** | Confirmación de merma con monto + cota server-side `waste_qty <= qty` | Escritura irreversible de un click sobre plata | S |
| **P0** | `price` + `valor_venta` en `pending_expiries` | Sin esto no hay protagonista y el arquetipo declarado es falso | S |
| **P1** | Fila de 44px con las 5 lanes + `max-w-6xl` | El pedido original (1) y (3) | M |
| **P1** | Separar vencido / por vencer con acción propia por grupo | El toque que miente en el ledger | M |
| **P1** | Merma parcial (RPC que decrementa sin cerrar si no venció) | Hoy el dueño está obligado a cargar un dato falso | M |
| **P1** | Gatear los botones de resolver por permiso | Hoy fallan siempre para un empleado sin el flag | XS |
| **P2** | Selección múltiple + masivo atómico con cota de 50 | Escala a 20; con 6 es tedioso pero funciona | M |
| **P2** | `fechaCorta` en la fila (sacar el ISO crudo) | Consistencia con la franja de al lado | XS |
| **P2** | PushCard fuera del lugar prime (3 estados) | Configuración ocupando el mejor lugar | S |
| **P2** | Declarar arquetipo en `page.tsx` (gate #6) | Una línea de comentario | XS |
| **Diferido** | Tokens `--elev-*` / `--surface-*` | **Anexo C: `globals.css` es transversal.** Esta ruta no debe intentar arreglarlo sola | — |

---

## 5 · Gate de 8 ítems — estado real

| # | Hoy | Después |
|---|---|---|
| 1 · cero hardcodeado | **PASS** (0 en la sección) | se mantiene |
| 2 · escala de elevación | **NO EVALUABLE** — `--elev-*` no existe (Anexo C: diferido) | sigue sin evaluarse; **regla: no inventar sombras nuevas** para que P1 sea un find/replace |
| 3 · superficies del sistema | **FAIL** (4 a mano) | PASS con `CardList`/`CardAlert` |
| 4 · shell único | **FAIL** (19 copias) | **no lo cierra esta ruta**; 6xl reduce el vocabulario |
| 5 · jerarquía en gris | **FAIL** (2 planos, máximo empatado 6 veces, el dato protagonista no está) | PASS — **se verifica con captura desaturada antes de mostrarte nada** |
| 6 · carácter declarado | **FAIL** | PASS (una línea) |
| 7 · presupuesto de motion | **FAIL prestado** — la ruta no declara ninguna, pero importa `PageHeader` y `card-system` con `duration-500` | deuda de Anexo C; regla acá: **cero motion nuevo, cero stagger** |
| 8 · sustitución de marca | **NO EVALUABLE hasta construir** | se verifica con captura comparada, **no se declara pass por adelantado** |

---

## 6 · Backend que esto exige

1. `create or replace view pending_expiries` + `p.price` + `qty × price as valor_venta`. **Sólo
   `price`; `cost` rompe la sección para empleados.**
2. `resolve_expiry`: cota `p_waste_qty <= qty` + variante parcial que **decrementa sin cerrar**
   cuando el lote no venció + no cerrar la promo en ese caso.
3. `resolver_expiries(ids[], resolution)` atómica, cota 50 (P2).
4. RPC de borrado de un lote **no resuelto** para el Deshacer de la vuelta de carga — hoy no
   hay `delete` grant sobre `stock_expiries` (P2).

---

## 7 · Decisiones que necesito de vos

1. **¿Por vencer primero o vencido primero?** (los agentes se contradijeron; mi recomendación:
   por vencer, con vencido colapsado).
2. **En "por vencer", ¿ordeno por fecha o por plata?** El director eligió fecha (*el tiempo es
   el recurso accionable, una promo tarda en surtir efecto*); la declaración del arquetipo
   sugiere plata. Es un flag de una línea.
3. **Permisos:** ¿alineo `addExpiry` a `owner || can_receive_stock`? Hoy el empleado que recibe
   mercadería puede escribir mermas pero no anotar fechas.
4. **Alta express desde Vencimientos** cuando el código no está en el catálogo: ¿se permite acá
   pidiendo precio, o deep-link a `/admin/ingreso?code=`?
5. **Fechas impresas sólo como MM/AAAA** (frecuente en góndola): ¿modo "sólo mes" que resuelve
   al último día, o se exige día siempre?
6. **Alcance de esta tanda:** ¿P0 solo, P0+P1, o todo?


---

## 8 · Lo que se implementó — verificación

**Decisión 1 · síntesis, no promedio.** "Por vencer" lidera; "Vencido" va colapsado abajo
**declarando su costo en datos**: *"6 lotes vencidos sin resolver · tu stock dice 71 u. que ya
no tenés · $139.000 en venta"*. La preocupación del `design-director` (la mentira del stock)
se atiende por un mecanismo distinto al orden, no promediando las dos direcciones.

**Decisión 4 · la plata, etiquetada honestamente.** Toda la pantalla dice **"en venta"** /
**"en riesgo"**. Nunca "perdés $X": `qty × price` es lo que se deja de vender; lo que se pierde
al tirar es el costo, y `cost` no puede entrar a la vista sin romperle la sección al staff.

| Prueba | Resultado |
|---|---|
| Producto antes inalcanzable | *Yerba Playadito 2.25L* está en la **posición 1975 de 2007** — fuera del select de 500. Ahora aparece tipeando "yerb" |
| `<select>` en el DOM | **0** |
| `page.tsx` consulta `products` | **0 veces** |
| Merma parcial sobre lote POR VENCER | asiento −3 con `unit_cost`, lote **abierto con 6 u.** y su fecha |
| Merma parcial sobre lote VENCIDO | lote cerrado |
| `waste_qty` 60 sobre lote de 6 | rechazado en el servidor (`waste_qty_excede_lote`) |
| Promo en cierre completo / parcial | se cierra / **no** se cierra (sin regresión) |
| Botón de confirmación | dice *"Tirar 3 u. · $ 9.000"*, no "Aceptar" |
| Ancho a 1920 | 768 → **1152px**; aire muerto 688/464 → **504/264** |
| Alto de fila | 117 → **53px** (escritorio) |
| Nombres truncados a 360 | 6/6 → **0/4** |
| Desborde horizontal 360/390/1920 | **ninguno** |

**Gate:** #1 PASS (0 hardcodeados — la superficie sale de `CardList`) · #3 PASS · #5 PASS
(verificado con captura desaturada: la plata es el máximo contraste de cada fila) · #6 PASS
(arquetipo declarado) · #7 PASS (0 motion nuevo) · #8 PASS (verificado con `--primary` en
gris: la pantalla sigue reconocible por su estructura) · #2 **no evaluable** (tokens diferidos;
no se inventó ninguna sombra) · #4 no lo cierra esta ruta.

### Dos huecos que aparecieron construyendo

1. **La primera versión dejó sin salida el caso del parcial.** Si un lote por vencer tenía
   promo sugerida, la única acción era "Promo" — no había forma de registrar *"se me rompió el
   paquete"*, que es exactamente para lo que existe la merma parcial. Se agregó el overflow
   `⋯` también en ese grupo.
2. **A 390 el nombre se renderizaba un carácter por línea.** Las cinco lanes no entran en un
   teléfono: las fijas consumían el ancho y `overflow-wrap` partía cada letra. La fila apila en
   dos líneas abajo de `lg` y la segunda envuelve en vez de recortar.

### Decisiones que siguen abiertas

- **Orden dentro de "por vencer":** hoy por **fecha** (el tiempo es el recurso accionable). La
  alternativa es plata estricta — un flag de una línea.
- Alta express desde Vencimientos cuando el código no está en el catálogo (hoy: se avisa y se
  ofrece buscar por nombre o ir a Recibir mercadería).
- Modo "sólo mes" para fechas impresas como MM/AAAA.
