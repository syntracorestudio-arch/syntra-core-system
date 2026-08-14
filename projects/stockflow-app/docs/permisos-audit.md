# Auditoría de permisos del empleado — StockFlow

**Base:** `593ff9d` (merge del PR #226, = `origin/main`).
**Método:** barrido sistemático de las 5 columnas de permiso, de las 20 rutas y de
las ~60 RPCs, más **impersonación real con JWT** contra la base local. Todo lo que
dice "verificado" abajo se corrió; lo que no se pudo correr está marcado.

> **Solapamiento declarado.** El bloque B1 (`docs/identidad-acceso-plan.md`, sin
> commitear al escribir esto) ya tocó permisos: filtrado del nav, anular acotado
> al POS, fiado acotado a la cuenta del cliente atendido, `can_see_costs` fuera de
> la lista. Cada hallazgo dice si está **en main**, **resuelto por B1** o **ambos**.
> Nada de esta auditoría depende de que B1 se mergee.

---

## Veredicto

**El aislamiento entre negocios está sólido. El que no existe es el aislamiento
entre el dueño y su propio empleado.**

Verificado en vivo: Luci —cajera del negocio 1, `can_see_costs = false`, sin
ningún permiso especial— **no puede leer nada del negocio 2** (`0 filas`,
`not_a_member`), pero **sí puede leer toda la plata del negocio 1**: el costo de
cada producto, la ganancia acumulada (`$308.530` en el fixture), el libro de fiado
completo y las dos RPCs de tablero.

La causa es una sola, y es **la misma que la escalada de privilegios del bloque A**:
las policies de Postgres son de **FILA**, no de **COLUMNA**. `002_rls_policies.sql:136-137`
dice, textual, *"Editar precios/costos y archivar: solo el dueño"* — y es cierto para
**escribir**. Para **leer**, `products_select` (002:139-140) le da al equipo entero la
fila completa, `cost` incluido. La intención escrita en `001_initial_schema.sql:49`
(*"el empleado ve precio de venta, nunca el costo"*) **nunca se implementó**.

Esto sería teórico si la app fuera sólo server-side. **No lo es:**
`src/lib/supabase/browser.ts:9-11` publica la anon key en el bundle, y el empleado
logueado tiene un JWT válido en sus cookies. Con eso llega a PostgREST por su
cuenta. **`requireOwner()` en la página es una cortina sobre una API abierta.**

| | |
| --- | --- |
| Fugas CRÍTICAS (plata del dueño legible por cualquier cajero) | **9** (6 + 3 del barrido exhaustivo) |
| Permisos decorativos (sólo UI) | **0** — ninguno; todos tienen respaldo en SQL |
| Permisos invisibles (sólo server) | **3** — los 3 los arregla B1 |
| Server actions sin validar sesión | **1** (`roleHome`) |
| Rutas con guarda incorrecta | **0** |
| Aislamiento cross-tenant | **correcto** en los 4 controles |

---

## A) Matriz de enforcement

Leyenda: **UI** = la pantalla oculta/muestra · **Action** = la server action valida ·
**SQL** = la RPC levanta `not_allowed` · **RLS** = hay policy de fila que lo respalda.

| Flag | UI | Action | SQL | RLS | Veredicto |
| --- | --- | --- | --- | --- | --- |
| `can_sell_on_credit` | `pos/page.tsx:145`, `fiado/[id]/page.tsx:67`, `fiado/page.tsx:48` | `fiado/actions.ts:21` | `003:103`, `004:29`, `021:111`, `023:92`, `027:117`, `045:382` | `002:180-183` (`clients` write) | **COMPLETO** |
| `can_apply_discount` | — *(ninguna)* | — *(ninguna)* | `003:178`, `021:182`, `021:311`, `023:156`, `027:181`, `028:91`, `029:78`, `045:450` | — | **INVISIBLE** → ver A.1 |
| `can_void_sale` | `caja/page.tsx:46`; **B1** agrega `pos-screen.tsx:178` | `caja/actions.ts:23` | `003:335` | — | **COMPLETO** (era INVISIBLE en el POS; lo arregla B1) |
| `can_receive_stock` | `pos/page.tsx:147`, `ingreso/page.tsx:11`; **B1** agrega el nav (`app-shell.tsx:30`) | `pos/actions.ts:520`, `ingreso/actions.ts:34`, `productos/actions.ts:227,293,329,579` | `003:270`, `006:31`, `008:81`, `037:209`, `039:46`, `041:49`, `045:551` | `002:148,168,209` (`auth_can`) | **COMPLETO** — el mejor cubierto de los cinco |
| `can_see_costs` | **B1** lo saca de la lista y lo deriva de `can_receive_stock` | `equipo/actions.ts:93` | `015:219`, `045:937`, `045:847` (recorte condicional) | — **y ese es el problema** | **PARCIAL** → ver A.2 |

**Ningún permiso es decorativo.** Toda server action que no chequea el flag llama a
una RPC que sí lo chequea; lo verifiqué RPC por RPC. El riesgo de este proyecto no
está en el bypass de la acción, está en la **lectura**.

### A.1 · `can_apply_discount` es invisible, no roto
Ocho RPCs lo validan; ninguna pantalla lo mira. El cajero sin el permiso ve el campo
de precio manual, lo edita, cobra y **la venta falla entera** con `not_allowed` — con
el cliente enfrente. No es una fuga: es el mismo bug de UX que B1 le arregló a
`can_void_sale` en el POS. **Recomendación: espejar el flag en el POS** (P1).

### A.3 · BARRIDO DE PROMESAS VACÍAS (decisión del owner, 2026-08-14)

`can_apply_discount` resultó **dormido**, no invisible: ocho RPCs lo validan y
**ninguna pantalla manda `unit_price`** — verificado sobre todo `src/`, y la
línea del carrito sólo tiene `cantidad`. Nadie puede cambiar el precio de una
venta, **ni el dueño**. Lo que escribí antes en A.1 —"el cajero edita el precio
y la venta falla"— describía una pantalla que no existe.

**Decisión: se saca el toggle, se deja la validación.** El razonamiento del
owner, textual en lo que importa: *un toggle que promete "puede hacer
descuentos" y no habilita nada es la misma clase de mentira de producto que ya
sacamos en otros lados* (el contador de "500 activos", el "todo con stock
suficiente"). Los casos legítimos ya están cubiertos —promos (baja de precio por
producto), monto libre (importe arbitrario), redondeo de vuelto—; lo que queda
es **el descuento de mostrador ad-hoc, que es justamente el que fuga margen sin
que se note**, y nadie lo extrañó porque todavía no hay usuarios.

La columna se queda (default false, inalcanzable, inofensiva) y **las 8
validaciones en SQL también**: ese guard es correcto y no queremos reconstruirlo
cuando la función llegue.

**El residuo se apagó en el momento (migración `053`).** Habían quedado 2
miembros con el flag en `true`, de cuando el toggle existía. Mi recomendación
era arreglarlo en la migración que trajera la función; **el owner la rechazó, y
con razón**: eso es un acordate-después, y en este proyecto los acordate-después
tienen historial propio —el fallback del límite de 500 que nunca se construyó,
el encabezado desactualizado del plan de onboarding, el "drift conocido" que
volvió tres veces—.

> Costo de hacerlo ahora: una línea. Costo de no hacerlo: dos empleados con un
> permiso que **nadie les dio a conciencia**, en otro contexto y meses después.
> Mínimo privilegio gana.

#### Y el barrido, porque era la SEGUNDA promesa vacía

La primera fue `can_see_costs`. Dos en la misma pantalla dejan de ser casos y
pasan a ser un patrón, así que se verificó **cada flag restante** contra el
criterio duro: *con el flag en ON, ¿un empleado llega de verdad a hacer algo que
con OFF no podía?*

| Flag | Acción concreta y alcanzable | Veredicto |
| --- | --- | --- |
| `can_sell_on_credit` | Medio de pago "Fiado" en el POS (`pos-screen.tsx:1685`) + entrada a la cuenta del cliente que atiende (`:1933` → `/admin/fiado/[id]`) | ✅ **verificado** |
| `can_void_sale` | El POS ofrece «Deshacer» tras cobrar (`pos-screen.tsx:773`) | ✅ **verificado** |
| `can_receive_stock` | Alta rápida en el POS (`:1188`) + `/admin/ingreso` entera | ✅ **verificado** |
| `can_close_register` | `/admin/caja` con payload recortado + entrada en el menú del POS | ✅ **verificado en vivo** |
| `can_see_reports` | `/admin/reportes` con `reportes_reposicion` + entrada en el menú del POS | ✅ **verificado en vivo** |
| `can_apply_discount` | **ninguna** — nadie manda `unit_price` | ❌ **dormido → toggle removido** |
| `can_see_costs` | *(ya no es toggle: acompaña a `can_receive_stock`)* | — |

**La regla que queda:** un permiso nuevo no se considera terminado cuando el
servidor lo valida. Se considera terminado cuando existe **una acción concreta
que el empleado alcanza con el flag en ON y no alcanza con OFF** — y esa acción
se prueba abriendo la app con su cuenta, no leyendo el código. Los dos agujeros
de la fase 3 (el POS sin navegación, el nav sin los flags nuevos) se
encontraron así y ningún test los había visto.

### A.2 · `can_see_costs` es el flag más honesto y el más incumplido
Es el único con recorte **condicional** bien hecho (`045:847`: `promos_listado`
arma el jsonb con o sin costos según el flag) y con gate duro (`015:219`,
`045:937`). Y da igual: quien lo tiene en `false` **lee `products.cost`
directamente**. El flag protege la puerta mientras la pared no existe.

---

## B) Fugas de datos del dueño — verificadas en vivo

Prueba: `set local role authenticated` + `request.jwt.claims` con el `sub` de Luci
(staff, `can_see_costs=false`). Salida real abajo.

| # | Qué se fuga | Dónde | Severidad | Evidencia |
| --- | --- | --- | --- | --- |
| **B-1** | **`products.cost`** de todo el catálogo | `002_rls_policies.sql:139-140` (`products_select` sin recorte de columna) | **CRÍTICA** | `5 filas`, costo promedio `$2.124` |
| **B-2** | **`sale_items.unit_cost`** ⇒ margen y ganancia de cada venta | `002:194-195` (`sale_items_select`) | **CRÍTICA** | `394 líneas`, ganancia total `$308.530` |
| **B-3** | **`stock_ledger.unit_cost`** ⇒ precios de proveedor | `002:197-198` (`stock_ledger_select`) | **CRÍTICA** | `0` en el fixture (sin compras cargadas) — la policy igual lo permite |
| **B-4** | **`client_ledger` completo** ⇒ deuda de TODOS los clientes, sin `can_sell_on_credit` | `002:200-201` (`client_ledger_select`) | **CRÍTICA** | `3 movimientos` visibles |
| **B-5** | **`dashboard_summary`**: `profit`, `cash_in`, `credit_given`, `avg_previous`, deudores | `007_dashboard.sql:31` y `008_caja_real_y_merma.sql:129` — sólo `perform rpc_member`, cero chequeo de rol. `grant … to authenticated` en `007:163` | **CRÍTICA** | devolvió las 9 claves, incl. `{"profit": 0.00, "avg_previous": 36800.00, …}` |
| **B-6** | **`reportes_summary`**: `money`, `top_profit`, `dead_stock`, `credit`, `waste` | `009_reportes.sql:55` — ídem, sólo `rpc_member`. `grant` en `009:333` | **CRÍTICA** | devolvió las 13 claves |
| **B-7** | **`cierre_caja`**: recaudación del día, por medio de pago, venta por venta | `013_caja_y_equipo.sql:38` — ídem | **ALTA** | misma clase que B-5/B-6 |
| **B-8** | `margen_default_pct` + `min_margin_pct` viajan al POS **de todo empleado**, tenga o no `can_receive_stock` | `src/app/pos/page.tsx:148-149` | **MEDIA** | precio + margen% ⇒ el costo se despeja de memoria |
| **B-9** | `roleHome(profileId)` es una server action **sin sesión** que usa `createAdminClient()` (service_role) y acepta un `profileId` arbitrario ⇒ oráculo de rol | `src/app/login/actions.ts:165-178` | **MEDIA** | requiere adivinar un UUID; devuelve 1 bit |

### Segunda tanda — el barrido exhaustivo (pedido del owner)

Después de cerrar las seis de arriba corrí el barrido completo: toda tabla o
vista alcanzable por `authenticated` con columnas de plata. Aparecieron **cuatro
más**, y dos candidatas resultaron ya estar bien.

| # | Qué se fugaba | Dónde | Severidad | Evidencia |
| --- | --- | --- | --- | --- |
| **B-10** | **`store_settings.margen_default_pct` / `min_margin_pct`** | `002:124` (`settings_select`) | **CRÍTICA** | `35.00 / 25.00` visibles. **Ésta es la que hacía inútil cerrar `cost`**: con `products.price` a la vista (y tiene que estarlo) más el margen, el costo de TODO el catálogo se despeja de memoria. El arreglo B-8 —sacarlos del payload— era cosmético: la tabla se lee directo con el JWT |
| **B-11** | **`sales.total`** ⇒ la recaudación histórica | `002:190` (`sales_select`) | **CRÍTICA** | `1.343 ventas, $11.836.620` |
| **B-12** | **vista `daily_totals`** ⇒ lo mismo, ya agrupado por día | `001:454` | **CRÍTICA** | `21 días, $11.829.220` |
| **B-13** | **`promos.cost_at_start`** ⇒ el costo congelado al crear la promo | `045:78` (`promos_select`) | **ALTA** | 5 de 6 promos con costo |

**Ya estaban bien** (verificadas, para que nadie las vuelva a auditar): `expenses`
→ `0` filas para un empleado, ya era owner-only · `client_balances` → `0`, es
`security_invoker` y **siguió sola** al arreglo de `clients`/`client_ledger`
(B-4), que es la señal de que ese arreglo se hizo en la capa correcta.

**No-fugas confirmadas** (miré y no lo son, para que nadie las vuelva a auditar):
`pos/page.tsx:100-139` — el catálogo del POS **no** lleva costo, sólo `price` con la
promo ya aplicada · `vencimientos/page.tsx:29-37` — `product_name, expiry_date, qty,
days_left`, limpio · `promos/actions.ts:105` (`lotesDelProducto`) — sólo fecha y
cantidad · `fiado/[id]/page.tsx:27` — el ledger **de ese cliente**, acotado a 100 ·
`promos_listado` (`045:847`) — recorta costos por flag, es el patrón correcto.

### El control que prueba que el patrón correcto ya existe
`margenes_erosionados` (`015:219`) levantó **`not_allowed`** con la misma sesión que
leyó todo lo demás. La casa ya sabe hacerlo bien; falta aplicarlo parejo.

### Controles cross-tenant (los 4 pasaron)
`products` de otro negocio → `0 filas` · `dashboard_summary` de otro negocio →
`not_a_member` (`rpc_member`) · usuario repetido entre negocios → aislado
(`verify-identidad-empleado.sql` test 9) · empleado sintético → mismo RLS que
cualquiera (test 8).

---

## C) Revisión ruta por ruta

| Ruta | Guarda hoy | ¿Correcta? | Recomendación |
| --- | --- | --- | --- |
| `/pos` | `requireSession` (`pos/page.tsx:18`) | ✅ | — |
| `/admin` (tablero) | `requireOwner` (`admin/page.tsx:16`) | ✅ | — |
| `/admin/caja` | `requireOwner` (`caja/page.tsx:18`) | ✅ | **pero** `cierre_caja` no gatea (B-7). Ver D-1: separar "cerrar mi turno" de "ver la recaudación" |
| `/admin/fiado` | `requireOwner` (`fiado/page.tsx:20`) | ✅ | la lista expone la deuda de todos: queda del dueño |
| `/admin/fiado/[id]` | `requireSession` + `canCharge` (`:15,:67`) | ✅ **(B1)** | superficie acotada al cliente atendido — correcta |
| `/admin/ingreso` | `requireSession` + `can_receive_stock` (`:10-11`) | ✅ | el modelo a imitar: guarda + flag en la misma página |
| `/admin/vencimientos` | `requireSession` (`:14`) | ✅ | ver D-2: hoy **cualquier** empleado carga y resuelve vencimientos, sin flag |
| `/admin/promos` | `requireSession` + `redirect` si no es owner (`:11,:17`) | ✅ | ver D-4: read-only para el empleado |
| `/admin/promos/carteles` | `requireSession` (`:10`) | ⚠️ | **sin gate de rol** — el cartel no tiene plata del dueño, así que no es fuga; es la única sección de promos que el empleado ve. Formalizarlo (D-4) |
| `/admin/productos` | `requireOwner` (`:13`) | ✅ | — |
| `/admin/precios` | `requireOwner` (`:9`) | ✅ | — |
| `/admin/gastos` | `requireOwner` (`:24`) | ✅ | ver D-5: se queda owner-only |
| `/admin/reportes` | `requireOwner` (`:24`) | ✅ | ver D-6: versión sin plata para el empleado |
| `/admin/equipo` | `requireOwner` (`:9`) | ✅ | — |
| `/admin/configuracion` | `requireOwner` (`:11`) | ✅ | — |
| `/admin/asistente` | `requireOwner` (`:16`) | ✅ | — |
| `/super` | `requireSuperadmin` (`:8`) | ✅ | endurecido en el bloque A |
| `/login`, `/clave` | `getSession` a propósito (`:52`, `:24`) | ✅ | documentado en `clave/page.tsx:19` |

**Ninguna ruta tiene la guarda equivocada.** Las dos fugas históricas (`/admin/caja`
y `/admin/fiado` con `requireSession`) están corregidas y comentadas en el código.

**Server actions:** las 60 exportadas validan sesión — **salvo `roleHome`** (B-9).

---

## D) Permisos que faltan

Evaluados contra la operación real de un kiosco: turnos, el dueño que no está de
noche, el empleado que repone la góndola, la rotación de personal.

| # | Capacidad | ¿La necesita el cajero? | Recomendación | Flag | Default |
| --- | --- | --- | --- | --- | --- |
| D-1 | **Cerrar la caja / arqueo** | **Sí** — el del turno noche cierra; el dueño no está | **GRANT, partido en dos** | `can_close_register` | **OFF** |
| D-2 | **Cargar vencimientos** | **Sí** — es quien ve la fecha al reponer | **GRANT** — ya lo hace | *(usar `can_receive_stock`)* | — |
| D-3 | **Contar stock / total en góndola** | **Sí** — puesta en marcha y reposición | **GRANT** — ya lo cubre `039:46` | *(usar `can_receive_stock`)* | — |
| D-4 | **Ver promos / carteles** | **Sí, read-only** — el cartel tiene que coincidir con la caja | **GRANT lectura, DENY alta** | *(ninguno: read-only para todo staff)* | — |
| D-5 | **Registrar un gasto** | **No** | **DENY** — ver abajo | *(ninguno)* | — |
| D-6 | **Reportes sin plata** | **Sí** — "qué se está por acabar" es su trabajo | **GRANT versión sin plata** | `can_see_reports` | **OFF** |

### D-1 · El arqueo es dos cosas distintas y hay que partirlas
"Cerrar la caja" y "ver cuánto se hizo hoy" viajan juntas en `cierre_caja` (013:22),
y por eso la sección terminó siendo owner-only entera. En un kiosco real el cajero
**tiene** que poder declarar el efectivo que hay en el cajón al cerrar su turno; lo
que no tiene que ver es la ganancia ni el histórico.

Propuesta: `cierre_caja` recorta el payload igual que `promos_listado` (`045:847`) —
con el flag devuelve todo; sin el flag devuelve **sólo lo que el cajero cuenta**
(efectivo esperado vs. contado, diferencia, cantidad de ventas), **nunca** `profit`,
`avg_previous` ni el desglose por medio de pago del mes.
*Escenario que justifica el flag aparte:* el dueño confía en su cajera de años para
cerrar, y no en el pibe que entró la semana pasada. Con `can_close_register` puede
distinguirlos; con `can_void_sale` o `can_receive_stock`, no.

### D-4 · Promos: leer sí, crear no
Crear promo = cambiar el precio que cobra la caja. Eso es del dueño y ya está bien
cerrado (`create_promo`, `045` → `role <> 'owner'` ⇒ `not_allowed`). Pero el empleado
**necesita** ver qué está en promo y poder imprimir el cartel: si el cartel de la
góndola no coincide con lo que cobra la caja, el cliente discute en el mostrador.
Alcanza con lo que ya hay — sin flag nuevo: `promos_listado` ya recorta costos por
`can_see_costs`, y `/admin/promos` debería mostrarle al empleado la vista de
carteles en vez de rebotarlo a `/admin`.
**Activar una promo sugerida: NO.** La sugerencia se calcula sobre margen — dársela
al empleado es darle el margen.

### D-5 · Gastos se queda del dueño (el argumento, no la asunción)
Es la única sección donde un empleado puede **sacar plata del sistema sin que se note**:
un gasto falso de $20.000 "proveedor" cuadra la caja de un faltante de $20.000. A
diferencia de anular una venta (que deja `voided_by` y motivo, `003:335`), un gasto
es un asiento legítimo — no hay anomalía que detectar después. Y el beneficio es casi
nulo: el gasto lo carga el dueño a la noche en dos minutos. **Deny.**

### D-6 · Reportes: partir por plata, no por sección
Al cajero le sirve "qué se está por acabar" y "qué se vendió más" — eso es
reposición, su trabajo. No le sirve, y no debe ver, `money`, `top_profit`,
`dead_stock` (valuado a costo) ni `credit`.
`reportes_summary` ya devuelve un jsonb por bloques: **recortar por flag es cambiar
qué claves se arman**, exactamente como `promos_listado`.
*Escenario:* el dueño quiere que la encargada pida mercadería sola, sin abrirle los números.

### El set final: **2 flags nuevos**, no seis
`can_close_register` y `can_see_reports`. Todo lo demás se resuelve con los flags que
ya existen o sin flag.
**Lo que recomiendo NO hacer:** un flag por sección (`can_see_promos`,
`can_load_expiries`, `can_count_stock`). Nadie los va a otorgar de a uno; el dueño de
un kiosco piensa en "confío en esta persona para X", no en una matriz de 11 casillas.
`can_receive_stock` **ya significa** "esta persona maneja la mercadería" y cubre
vencimientos, conteo y góndola de forma coherente.

### Cómo se ven en `/admin/equipo`
Hoy son 4 toggles planos (tras B1). Con dos más son 6 — el límite de lo que se lee de
un vistazo. Agrupar en dos bloques con el lenguaje del kiosquero:

**En el mostrador** — Fiar · Cambiar precios en la venta · Anular ventas
**Además de atender** — Cargar mercadería · Cerrar la caja · Ver qué se vende

Con una línea de verdad debajo de cada uno, como las que dejó B1 (*"Puede registrar
lo que entra — y ver cuánto te costó"*). "Cerrar la caja" debe decir explícitamente
**"cuenta el efectivo y cierra el turno — no ve la ganancia"**, porque es justo lo que
un dueño va a querer saber antes de tildarlo.

---

## E) Tests

`supabase/tests/verify-permisos.sql` — impersonación con JWT, **las dos direcciones**
para cada permiso, más los controles cross-tenant.

| Bloque | Qué afirma |
| --- | --- |
| **11** | **REGRESIÓN CRÍTICA**: la caja del empleado funciona ENTERA con el recorte puesto — vender, precio manual, fiar, anular, alta rápida, monto libre y split — y `register_sale` **sigue snapshoteando `unit_cost`**. No es obvio que funcione: es una propiedad de que las RPCs sean `security definer`. Si alguien "simplifica" una a `security invoker`, la caja se cae para todos los empleados y este bloque lo canta |
| **12** | **BARRIDO AUTOMÁTICO**: impersona a una cajera **con todos los permisos apagados** y cuenta cuántas filas de columnas de plata puede traer de verdad. Cubre las dos formas de reabrir (grant por columna y RLS por fila) — probado rompiéndolo a propósito en ambas |
| 1 | **Estanqueidad de columnas**: staff sin `can_see_costs` no lee `products.cost`, `sale_items.unit_cost` ni `stock_ledger.unit_cost` (B-1/2/3) |
| 2 | **Fiado**: sin `can_sell_on_credit` no lee `client_ledger` ni `clients`; con el flag, sí (B-4) |
| 3 | **RPCs de plata**: `dashboard_summary`, `reportes_summary`, `cierre_caja` levantan `not_allowed` para staff sin flag y responden al owner (B-5/6/7) |
| 4 | `can_sell_on_credit` ON/OFF sobre `register_sale` con `payment_method='account'` |
| 5 | `can_apply_discount` ON/OFF sobre `unit_price` manual |
| 6 | `can_void_sale` ON/OFF sobre `void_sale` |
| 7 | `can_receive_stock` ON/OFF sobre `register_purchase` y `quick_create_product` |
| 8 | `can_see_costs` ON/OFF sobre `margenes_erosionados` y el recorte de `promos_listado` |
| 9 | **Cross-tenant**: cada uno de los anteriores, apuntando al negocio ajeno |
| 10 | **El owner nunca pierde nada** (anti-regresión: el arreglo no puede romper al dueño) |

`src/lib/permisos.test.ts` — donde el chequeo vive en TypeScript: la derivación
`can_see_costs ← can_receive_stock` y el espejo UI/servidor de cada flag.

---

## F) Plan por fases

**Fase 1 — bugs vivos (`051`) — ✅ IMPLEMENTADA Y VERIFICADA.** Las 6 fugas
críticas más las dos de TypeScript. Es lo único que no podía esperar: con la app
desplegada, cualquier cajero leía la ganancia del negocio. Resultado medido,
misma sesión de cajera que antes leía todo:

| | Antes | Después |
| --- | --- | --- |
| `products.cost` | 5 filas, promedio $2.124 | `permission denied` |
| `sale_items.unit_cost` | 394 líneas, ganancia $308.530 | `permission denied` |
| `client_ledger` (sin `can_sell_on_credit`) | 3 movimientos | `0` |
| `dashboard_summary` | las 9 claves | `not_allowed` |
| `reportes_summary` | las 13 claves | `not_allowed` |
| `cierre_caja` | la recaudación | `not_allowed` |
| **precio, stock y nombre del catálogo** | visibles | **visibles** (el POS no perdió nada) |
| **el dueño** | todo | **todo** — tablero, reportes, caja y márgenes intactos |

Efecto colateral honesto: cuatro asserts de tres suites viejas
(`verify-rpcs`, `verify-promos`, `verify-total-gondola`) leían columnas de costo
**con el rol del cajero** para verificar lo que la RPC había escrito. Se movieron
a leer como `postgres`: eso **sube** el privilegio del assert, no baja el del
producto — mismo criterio que ya se había usado con `sale_payments` en
`verify-split.sql`. Ninguna verificación se debilitó para que un test pasara.

Lo que se hizo, punto por punto:
1. `revoke select (cost) on products` · ídem `sale_items.unit_cost`,
   `stock_ledger.unit_cost` y `promos.cost_at_start`. **Radio de impacto: cero** —
   verifiqué que ninguna consulta de la app lee esas columnas directamente; todas
   pasan por RPCs `security definer`, que son inmunes al grant de `authenticated`.
   El patrón ya existe en la base: `products` **ya tenía** grants por columna para
   `UPDATE` (lista curada que excluye `id`, `store_id`, `stock`). Se copia, no se inventa.
2. `client_ledger_select` y `clients_select` → `auth_can(store_id,'can_sell_on_credit')`.
   `sales_select` y `sale_items_select` → owner (`daily_totals` es
   `security_invoker` y hereda, sin tocar la vista).
3. Gate de rol en `dashboard_summary`, `reportes_summary`, `cierre_caja`.
4. Los dos márgenes de `store_settings` salen de la tabla y pasan por
   `margenes_del_negocio()`, gateada por `can_receive_stock` — que es quien los
   necesita de verdad (el alta propone precio desde el costo). 5 sitios de lectura
   actualizados.
5. `roleHome` **borrado**, no arreglado (B-9): era un `export` de un archivo
   `"use server"` sin sesión, con `service_role`, y sin un solo llamador.
6. El POS ni siquiera pide los márgenes si no puede dar de alta (B-8).

**Fase 2 — RESUELTA, y no como estaba planteada.** Lo que figuraba como
"espejar `can_apply_discount` en el POS" partía de una premisa falsa: no hay
pantalla que cambie precios. Se removió el toggle (§A.3). `can_void_sale` y
`can_receive_stock` ya los había arreglado B1.

### ROADMAP — el descuento de mostrador (NO construir todavía)

Cuando llegue, **no va solo**: va con el precio por medio de pago (efectivo vs.
lista), que el owner ya había mandado al roadmap como feature propia durante
promociones fase 2. Son la misma familia —ajuste de precio del lado del
mostrador— y diseñarlas por separado termina en dos mecanismos que se pisan.

Condición: **evidencia de piloto real**. Hoy no hay usuarios, así que no hay
forma de saber si el kiosquero quiere descuento por línea, por ticket, o sólo el
precio de efectivo. Construir las tres "por las dudas" es exactamente cómo se
llega a una pantalla de precios que nadie entiende.

Lo que YA está listo para ese día: la columna `can_apply_discount` y las 8
validaciones de `unit_price` en SQL. No hay que rehacer el backend.

**Fase 2 (redacción original, para trazabilidad).** Espejar `can_apply_discount` en el
POS (A.1): hoy el cajero sin el permiso edita el precio, cobra y la venta falla
entera con el cliente enfrente. `can_void_sale` y `can_receive_stock` ya los
arregló B1. Es UX, no seguridad — el servidor ya corta bien.

**Fase 3 — permisos nuevos (`052`) — ✅ IMPLEMENTADA.** `can_close_register` y
`can_see_reports`, aprobados por el owner con una condición dura: *el permiso no
sirve si otorgarlo entrega el margen*. Resultado:

| | Se partió así |
| --- | --- |
| `cierre_caja` | **Sí, inline.** El cajero recibe `efectivo_esperado`, `ventas_del_turno` y `anuladas`. NO recibe `facturado`, `entro_en_caja`, `fiado`, `cobros_fiado`, `by_method` ni el detalle de 300 ventas — sumar cualquiera de esos dos últimos daría la recaudación |
| `reportes_summary` | **No, y por eso no se tocó.** `by_date`, `by_weekday` y `by_category` son `sum(total)` y NADA más: censurarlas dejaba al empleado con una pantalla llena de huecos y al dueño con un `if` alrededor de cada bloque. El empleado tiene `reportes_reposicion`, una RPC propia con unidades, faltantes, vencimientos y franjas — cero plata, calculada desde cero. El reporte del dueño queda intacto y owner-only |

Los cuatro descartes se mantienen: `can_receive_stock` ya significa "maneja la
mercadería" y cubre vencimientos/conteo/góndola; gastos sigue siendo del dueño.

**Dos agujeros que aparecieron recién al mirar la app corriendo**, los dos de la
misma clase que la auditoría ya había encontrado un nivel más arriba —*el
permiso existe, la puerta no*—: el POS **no tiene barra de navegación** (para el
empleado es toda la app), así que sin un menú en su header las dos pantallas
eran inalcanzables; y `puedeAbrir()` no conocía los flags nuevos, así que
tampoco aparecían en la barra del panel. Ninguno de los dos lo detectó un test:
los dos se vieron abriendo la app con la cuenta de la empleada.

> **Por qué la fase 3 no se hizo sola:** la 1 arregla bugs (no hay decisión que
> tomar); la 3 **agrega capacidades** y define qué ve un empleado del negocio de
> otra persona. Eso es tuyo. Mientras tanto `cierre_caja` y `reportes_summary`
> quedaron **owner-only**, que es el estado correcto por defecto: hasta hoy la app
> se comportaba como si fueran owner-only (las páginas son `requireOwner`), sólo
> que la API no lo cumplía. Nadie pierde nada que estuviera usando.

### Dos errores propios, anotados porque la lección es reutilizable

**1 · El primer barrido era ciego por construcción.** Filtraba por
`has_table_privilege(…, 'select')`, que devuelve **false** cuando el permiso pasa
a ser por columna. O sea: el barrido dejaba de ver exactamente las tablas que el
arreglo acababa de tocar. Lo descubrí porque **reintroduje una fuga a propósito y
el test siguió verde**.

> Un detector que descarta candidatos por una condición que el propio arreglo
> vuelve falsa no detecta regresiones — sólo se felicita.

El bloque 12 se reescribió para no preguntar por privilegios sino por el **dato**:
impersona y cuenta filas.

**2 · La primera versión del bloque 12 medía con una cajera que sí tenía
permisos.** Daba verde porque Luci puede fiar, así que `client_balances`
devolvía filas **legítimamente**. Un test-piso tiene que correr con **todos los
permisos apagados** y contra el negocio que **tiene datos** — si la tabla está
vacía, el conteo da 0 y el test se felicita igual.

Las dos veces el error fue el mismo: **confiar en que verde significa correcto,
sin haber visto nunca el test en rojo.**

### La regla que queda escrita
> **RLS es de FILA. El recorte por COLUMNA es GRANT.**
> Si un dato es del dueño y vive en una tabla que el equipo lee, esconderlo con
> `requireOwner()` en la página **no lo esconde**: la anon key está en el bundle y
> el empleado tiene JWT. O se revoca la columna, o el dato sale por una RPC
> `security definer` que mire el flag. Tercera opción no hay.

Es la misma lección del bloque A (`profiles.is_superadmin`), aplicada a la plata en
vez de al privilegio. Que haya reaparecido tres semanas después, en otras seis
tablas, dice que es un patrón del proyecto y no un descuido puntual.
