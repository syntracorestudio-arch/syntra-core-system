# StockFlow — Auditoría responsive / mobile

> **Estado: AUDITORÍA (2026-08-03). Sin cambios de código.** Este documento es el
> mapa de reparación: qué está roto, **por qué causa** (no por pantalla), la regla
> que arregla cada causa, y en qué orden conviene tocarlo.
>
> **Disparador:** reporte del owner desde un Android real — en el POS, al escanear,
> la hoja de alta rápida se corta y se va de la pantalla.

---

## 0. El hallazgo que reordena todo

La sospecha inicial era *"falta `min-w-0`/`truncate` por todos lados"*. **Es falsa** y
conviene dejarlo escrito para no perder tiempo ahí: la higiene de truncado está bien
—44 de 48 filas correctas en admin, 10 de 16 en el POS— y dos auditorías independientes
lo confirmaron por separado.

**La causa real es una sola y está concentrada:** los diálogos y hojas de la app no
tienen altura máxima ni scroll propio. El `overflow-y-auto` está puesto en el fondo
negro y el panel crece sin techo. Cuando el contenido supera la pantalla, el excedente
sale por arriba y por abajo, y **no hay forma de alcanzarlo**.

Lo que hace que esto recién aparezca ahora es el contenido:

| | Catálogo real (83.381 productos) | Datos de prueba |
| --- | --- | --- |
| Nombre promedio | **32 caracteres** | ~15 |
| Percentil 95 | **50** | — |
| Máximo | **62** | — |
| En MAYÚSCULAS | 139 productos | 0 |

Un nombre largo **no rompe por ser largo**: rompe porque dispara la lista de sugerencias
del catálogo (+176px) dentro de una hoja que ya no tenía margen. Con datos de prueba la
hoja medía 527px y entraba; con datos reales llega a 721px.

---

## 1. Evidencia medida

Medición con Playwright sobre el negocio de escala (2000 productos) cargado con los **20
nombres reales más largos** del catálogo, una categoría de nombre largo, un precio de 7
dígitos y cantidades de 4 dígitos.

### 1.1 Sin teclado — entra raspando

| Superficie | Viewport | Alto del panel | ¿Entra? |
| --- | --- | --- | --- |
| POS · alta rápida (base) | 390×844 | 527px | sí |
| POS · alta rápida + sugerencias | 390×844 | 643px | sí |
| POS · alta rápida + sugerencias + cantidad | 390×844 | **721px** | sí, con 123px de sobra |
| Productos · nuevo producto | 390×844 | 740px | sí |
| Productos · nuevo + vencimiento | 390×844 | **856px** | **NO** (12px de más) |
| Productos · nuevo + vencimiento | 360×800 | **872px** | **NO** (72px de más) |

### 1.2 Con el teclado abierto — se rompe siempre

El teclado de Android ocupa ~290px. Es el estado normal: el cajero está tipeando el precio.

| Superficie | Viewport útil | Alto | Excedente | Controles fuera de la pantalla |
| --- | --- | --- | --- | --- |
| **POS · alta rápida** | 360×510 | 643px | **+133px** | ⬇ `Guardar y agregar` · ⬇ `Cobrar sin cargarlo` · ⬇ `+ ¿Cuántos tenés?` · ⬇ `+ Categoría` |
| **Productos · nuevo** | 360×510 | 872px | **+362px** | ⬆ `Cerrar` · ⬆ `Elegir ícono` · ⬆ **campo Nombre** · ⬇ `Guardar` · ⬇ vencimiento |
| Productos · nuevo | 390×554 | 856px | +302px | ⬆ `Cerrar` · ⬇ `Guardar` · ⬇ vencimiento |

En los tres casos: `max-height: none`, `overflow-y: visible`, **el panel no puede
scrollear**. El botón que cierra la operación queda fuera y no hay gesto que lo alcance.
Eso es exactamente lo reportado.

---

## 2. Clases de causa

### C1 · Diálogos y hojas sin altura acotada — **la dominante**

**11 de los 12 contenedores de diálogo de la app.** Como tres son componentes `Dialog`
locales compartidos, son **~19 diálogos renderizados en 10 pantallas**.

El patrón roto, repetido textualmente:

```
overlay: "fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 …"
panel:   "w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-md …"
```

El `overflow-y-auto` está en el overlay y el panel no tiene `max-h`. Con
`align-items: end`, el excedente sale por el borde superior — y el scroll **no llega a
offsets negativos**: es contenido inexistente para el usuario.

| Dónde | Archivo | Severidad |
| --- | --- | --- |
| Alta rápida del POS | `pos-screen.tsx:2172-2173` | **P0** — el bug reportado |
| Monto libre | `pos-screen.tsx:1962-1963` | **P0** — tiene `autoFocus`, abre el teclado al montarse |
| `Dialog` compartido de Productos | `products-client.tsx:1478-1479` | **P1** — sirve a 3 diálogos, incluido el peor (872px) |
| `Sheet` de los selectores de fecha | `date-pickers.tsx:80-84` | **P1** — 3 pantallas (Caja, Reportes, Gastos) |
| `Dialog` de Equipo | `equipo-client.tsx:433` | P1 — 3 diálogos |
| `Dialog` de ficha de cliente | `cliente-detalle.tsx:418` | P1 — 2 diálogos |
| Import CSV | `import-dialog.tsx:134` | P1 |
| Gastos (nuevo / anular) | `gastos-client.tsx:285`, `:424` | P1 / P2 |
| Caja, Vencimientos, Fiado, Precios | `caja-client.tsx:287`, `vencimientos-client.tsx:223`, `fiado-client.tsx:236`, `precios-client.tsx:231` | P2 |
| 5 overlays centrados del POS | `pos-screen.tsx:967`, `:1060`, `:2509`, `cobro-qr-dialog.tsx:119`, `cobro-point-dialog.tsx:138` | P2 — latente (contenido corto hoy) |

**El arreglo ya está escrito en el repo.** `category-chips.tsx:217/224` usa el mismo
overlay con el panel acotado:

```
panel: "max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl … p-4 sm:max-w-md sm:rounded-2xl"
```

Es el único de los 12 que está bien. Se copia, no se inventa.

### C2 · Cero manejo de teclado y zonas seguras — **toda la app**

- **`env(safe-area-inset-*)`: 0 ocurrencias** en todo `src/`, incluido `globals.css`.
- **`viewportFit: "cover"` ausente** en `layout.tsx:16-22` → aunque se agregara `env()`,
  hoy resolvería a `0`. Es prerrequisito.
- **`visualViewport`: 0 ocurrencias.** Nada reacciona al teclado.
- `interactiveWidget` no declarado → Chrome Android usa `resizes-visual`: el teclado
  **no achica el viewport de layout**, así que las hojas ancladas abajo quedan tapadas.

Consecuencias concretas:

| Síntoma | Archivo |
| --- | --- |
| **El botón "Confirmar ingreso" queda detrás de la barra de pestañas** | `ingreso-client.tsx:742` usa `bottom-0`; `products-client.tsx:682` ya resolvió bien con `bottom-20 sm:bottom-4` |
| La barra de pestañas pierde 16-24px bajo la barra gestual | `app-shell.tsx:69` |
| El botón primario de las 11 hojas queda a 20px del borde físico | los 11 paneles `p-5` |

Nota: `dvh` está bien usado en toda la app (cero `vh`), pero **`dvh` no cambia con el
teclado** — no alcanza para este problema.

### C3 · Anchos fijos que ahogan el texto

| Dónde | Efecto medido a 360px | Archivo |
| --- | --- | --- |
| Fila del preview de import: un `shrink-0` de ~190px | deja **~98px** (≈12 caracteres) para el nombre y desborda la fila | `import-dialog.tsx:278-280` |
| Selector de columna `w-40 shrink-0` | deja 136px al encabezado del CSV del cliente | `import-dialog.tsx:244` |
| Donut de Reportes `h-44 w-44 shrink-0` sin apilado | deja **100px** a la leyenda; nunca pasa a vertical | `reportes-client.tsx:630-631` |
| Arte del `PageHeader` (112-128px fijos) | deja ~144px al título; los subtítulos dinámicos se van a 4 líneas | `page-header.tsx:84-88` |
| `w-28 shrink-0` con la palabra "Transferencia" | el texto (113px) no entra en su caja (112px) | `pos-screen.tsx:2620` |

### C4 · Desborde horizontal

No hay `overflow-x: hidden` global, así que cualquier desborde escapa al documento.

- **Grilla de medios de pago** `grid-cols-6` (`pos-screen.tsx:1548`): el token
  `"Transfer."` no se puede partir y fuerza ~390px en un contenedor de 328px.
- La fila del import de C3.

*Medición: a 360px con un ítem en el carrito el documento no llegó a scrollear
horizontalmente, pero el margen es nulo. Se arregla igual: es una bomba de tiempo.*

### C5 · Contenido de usuario sin truncar (pocos casos, pero reales)

| Dónde | Por qué importa | Archivo |
| --- | --- | --- |
| **`AvisoBanner`** — `flex-1` sin `min-w-0` ni `truncate` | Es el **único** lugar donde un nombre de producto se renderiza sin truncar, y lo usan **10 pantallas**. Un nombre sin espacios lo desborda | `aviso.tsx:38` |
| **Chips de categoría** — `shrink-0` sin `truncate` ni `max-w` | Un chip con nombre largo se come la fila entera: reintroduce el bug que ese componente vino a arreglar | `category-chips.tsx:352-370` |
| Hoja "Más" a 2 columnas | ~13 caracteres por categoría, en la pantalla que existe para leerlas todas | `category-chips.tsx:251` |
| Faltan `gap` entre nombre truncado y monto | La elipsis toca el número | `reportes-client.tsx:518`, `dashboard-client.tsx:369` |
| `<option>` con nombres de producto | Android corta sin elipsis; no hay forma de ver el completo | `vencimientos-client.tsx:244` |

### C6 · Tiles del POS indistinguibles — **el único que cuesta plata**

`line-clamp-2` sobre tiles de ~92px de texto muestra **~27 de 62 caracteres** a 390px
(~23 si el nombre está en mayúsculas). Dos productos que difieren solo en el final
—`…Coca Cola x 500ML` vs `…x 2.25L`— se ven **idénticos**.

No es cosmético: el cajero cobra el equivocado y el stock de los dos queda mal.

---

## 3. Reglas de reparación

### R1 · Altura de superficies — tres bandas

Medidas contra ~690px útiles (Android típico, sin teclado).

| Contenido | Patrón | Ejemplos |
| --- | --- | --- |
| **≤ 420px** | Diálogo centrado, sin scroll propio | "¿débito o crédito?", "¿dónde cobrás el QR?" — ya están bien |
| **420-690px** | **Hoja anclada abajo**: `max-h-[85dvh]`, cuerpo con scroll propio, acción primaria fija al pie, `pb-[env(safe-area-inset-bottom)]` | Alta rápida, monto libre, selectores de fecha |
| **> 690px, o más de 6 campos** | **Pantalla completa** con header y Guardar propios | Diálogo de producto (872px). En mobile eso no es un diálogo: es un formulario |

**Umbral para recordar:** *si con el teclado abierto no se ve el campo enfocado + el
botón primario, dejó de ser una hoja.*

**Sin wizard por pasos.** Los pasos se justifican cuando una decisión cambia lo que
viene después (como el ruteo del split). El diálogo de producto es una lista plana de
campos: partirlo agrega toques y esconde el margen justo cuando se fija el precio.
Pantalla completa con secciones (Identidad · Precio y margen · Stock · Extras).

### R2 · Nombres: una línea, dos líneas o completo

```
REGLA DE NOMBRES — StockFlow

Preguntá: ¿el nombre DECIDE, o solo IDENTIFICA?

1 línea (truncate)      → el usuario ya sabe qué busca y decide OTRA COSA:
                          el precio, la fecha, el monto, el orden.
                          Listas densas donde tocar abre la ficha.

2 líneas (line-clamp-2) → el usuario ELIGE ENTRE PARECIDOS,
                          o CONFIRMA algo que mueve plata o stock.

Sin cortar (wrap)       → no hay pantalla siguiente que muestre el nombre entero.
                          Si lo cortás acá, para el usuario ese nombre no existe.

Desempate: ¿cuánto cuesta deshacer un error acá?
  Un toque                                   → truncá.
  Anular una venta, ajustar stock, renombrar → no truncás.

Prohibido: tooltip/title (no existe en touch), marquesina,
           y achicar la fuente para que entre.
```

**Nombre completo obligatorio** (hoy truncados): línea del carrito **en el paso
Confirmar** (`pos-screen.tsx:1474`) · opciones del buscador del alta (`:2254`) · nombre
confirmado del catálogo (`:2218`) · aviso "ya tenés algo parecido"
(`products-client.tsx:1196`) · preview del remarcado masivo (`:1037`) · campo Nombre del
diálogo de producto (`:1171`, debe ser `textarea` de alto automático) · detalle de venta
en Caja.

### R3 · Tiles del POS — 2 columnas por debajo de 400px

`minmax(104px,1fr)` → `minmax(160px,1fr)` **solo en la clase base**; `sm:` y `xl:` no se
tocan (a 640px+ siguen 4 y 6 columnas).

A 390px: 2 columnas → tiles de ~174px → ~25 caracteres por línea → **~50 con
`line-clamp-2`, exactamente el p95 del catálogo**.

**Costo aceptado por el owner:** 6 tiles por pantalla en vez de 9. Se paga con que la
grilla ya viene rankeada por rotación (los primeros son los que se venden todo el día) y
el escaneo es el camino primario. Ganancia lateral: 174px es mejor blanco táctil que
104px para alguien apurado.

### R4 · Nombres del catálogo: versión corta editable

Al dar de alta desde el catálogo, prellenar con una **versión corta** y mostrar el
original en gris debajo. **Nunca se pierde**: marca + tamaño con unidad + variante/sabor
— son los tres discriminadores del mostrador.

**Cota dura:** el acortado **no puede producir un nombre igual a otro producto del
negocio**. Si colisiona, se alarga hasta distinguirse; si no se puede, queda el original.
Sin esa cota, "acortar" fabrica exactamente los gemelos que estamos eliminando.

No se guarda el nombre original: es recuperable por el EAN (`catalogoRef`).

Copy: *"Lo acortamos para que se lea en la caja. Podés cambiarlo."* · *"En el catálogo:
{nombre completo}"* · al pasar los ~40 caracteres, avisa sin bloquear: *"Se va a ver
cortado en la caja."*

### R5 · Teclado y zonas seguras

1. `viewportFit: "cover"` + `interactiveWidget` en `layout.tsx:16` (prerrequisito: sin
   esto `env()` es 0).
2. `pb-[env(safe-area-inset-bottom)]` en la barra de pestañas (`app-shell.tsx:69`) y en
   los paneles de hoja.
3. Unificar los sticky de abajo con el criterio que **ya usa Productos**
   (`bottom-20 sm:bottom-4`), empezando por `ingreso-client.tsx:742`.

---

## 4. Plan de arreglo por fases

**Dentro de cada fase: primero los componentes compartidos** — un arreglo, muchas
pantallas.

### P0 — camino de venta. Bloquean la prueba de los 20 escaneos

| # | Qué | Dónde | Clase |
| --- | --- | --- | --- |
| 1 | Acotar la hoja de alta rápida y la de monto libre (`max-h-[85dvh]` + scroll propio + acción al pie) | `pos-screen.tsx:2173`, `:1963` | C1 |
| 2 | `viewportFit` + `interactiveWidget` + safe-area en barra de pestañas y hojas | `layout.tsx:16`, `app-shell.tsx:69` | C2 |
| 3 | Desborde horizontal de los medios de pago | `pos-screen.tsx:1548` | C4 |
| 4 | Grilla del POS a 2 columnas bajo 400px | `pos-screen.tsx:1362` | C6 |

> **Por qué bloquean la prueba de cámara:** el ciclo completo del escaneo termina en la
> hoja de alta rápida con el teclado abierto. Hoy, en ese estado, `Guardar y agregar`
> está fuera de la pantalla: la prueba de los 20 escaneos **no se puede completar** sin
> el punto 1.

### P1 — pantallas diarias de admin

5. El `Dialog` compartido de Productos (arregla 3 diálogos de una) — `products-client.tsx:1478`
6. El `Sheet` de los selectores de fecha (3 pantallas) — `date-pickers.tsx:80`
7. Los 8 diálogos ad-hoc restantes (mismo patrón)
8. **Diálogo de producto → pantalla completa** (es el de 872px; ver R1)
9. `AvisoBanner`: `min-w-0` + `break-words` — 10 pantallas — `aviso.tsx:38`
10. Botón de Ingreso detrás de la barra de pestañas — `ingreso-client.tsx:742`
11. Chips de categoría con nombres largos (`max-w` + `truncate`; hoja a 1 columna en mobile) — `category-chips.tsx:352`, `:251`
12. Nombre completo donde R2 lo exige

### P2 — cosmético

13. `PageHeader` a 360px (paso de tamaño del arte en mobile) — `page-header.tsx:84`
14. Donut de Reportes que no apila — `reportes-client.tsx:630`
15. `gap` faltantes — `reportes-client.tsx:518`, `dashboard-client.tsx:369`
16. `<option>` con nombres largos — `vencimientos-client.tsx:244`
17. Fila del preview de import — `import-dialog.tsx:278`

---

## 5. Qué NO construir

- **Tooltip / long-press para ver el nombre completo** — no existe en touch y el cajero
  está apurado.
- **Marquesina** en los tiles.
- **Auto-ajuste del tamaño de fuente** para que entre: 10px en un mostrador con mala luz
  es peor que truncar.
- **Parser de variantes** para extraer el "distintivo" a una segunda línea: falla en
  silencio justo con los sabores, que es el caso peor.
- **Wizard por pasos** para el diálogo de producto.
- **Renombrado masivo automático** del catálogo ya cargado. Si aparece el dolor, una
  acción manual con preview y confirmación — nunca de fondo.
- **Columna nueva de "nombre original"**: es recuperable por el EAN.
- **Normalizar unidades "inteligentemente"** (0.5 L → 500 ml): cambia lo que dice el
  envase y confunde al que compara con la góndola.

---

## 6. Cómo se verificó

- Dataset de estrés en el negocio de escala (`dueno@escala.test`, 2000 productos): los
  **20 nombres reales más largos** del catálogo (hasta 62 caracteres), una categoría de
  nombre largo, un precio de 7 dígitos y cantidades de 4 dígitos. **No** el fixture de 5
  productos — probar con nombres cortos es lo que escondió este bug durante meses.
- Medición programática con Playwright a **360×800** y **390×844**, y con el alto
  reducido a **510/554** para representar el teclado abierto.
- Para cada superficie se midió: alto del panel, `max-height`, si puede scrollear, y
  **qué controles concretos quedan fuera de la pantalla** (por nombre).
- Auditoría de código en paralelo sobre las 8 clases de causa, con `file:line`.

**Regla que queda para el futuro:** cualquier pantalla nueva se revisa con el dataset de
estrés, no con datos de demo. El contenido corto es el que esconde estos bugs.
