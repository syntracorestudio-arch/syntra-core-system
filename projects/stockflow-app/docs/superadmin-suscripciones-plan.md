# StockFlow — Superadmin, panel de control y suscripciones

> **Estado: PLAN (2026-08-18). Sin código, sin migraciones.** Base verificada: `7608ee9`.
> Próxima migración libre: **056**.
>
> Todo lo que afirma este documento se verificó contra el código o contra la base. Lo que
> es criterio y no hecho está marcado como tal.

**Restricción que ordena TODO el documento: hay CERO clientes pagando.** Cada propuesta se
dimensiona para 1-10. Cualquier cosa que cueste más de lo que ahorra a esa escala está mal
dimensionada, por buena que sea.

## Decisiones del owner — CONGELADAS (2026-08-18)

| | |
| --- | --- |
| **Precio** | **$60.000 por mes**, por negocio |
| **Vencimiento** | **día 10 de cada mes** — el cliente tiene hasta ese día para pagar |
| **Medio de cobro** | **transferencia a alias**, sin integración de pagos |
| **El panel** | **se queda en `/super`**, se endurece, no se muda |
| **Rediseño del login** | **autorizado** — se reescribe el reference-lock después del OK sobre el prototipo vivo |
| **Condición fiscal** | ⚠️ ver §G — hay que resolverlo antes de cobrarle al primer cliente |

---

## A · Por qué no entrás a `/super`

Son **dos causas encadenadas**. La primera es trivial; la segunda no se ve mirando el flag.

### A.1 · El flag está apagado

Los 7 perfiles de la base local tienen `is_superadmin = false`. No es un bug de guarda ni
de redirect: **es el dato**.

El flag sólo se otorga editando la base a mano — deliberado, `src/lib/superadmin.ts:9-14`:

> *"Se marca a mano en la base después de aplicar las migraciones… Es deliberado que no
> haya UI para otorgarlo: si se pudiera dar desde la app, cualquier owner comprometido
> escalaría a ver todos los negocios."*

Se lo puse a `dueno@escala.test` para probar el panel de trazabilidad y **se lo saqué al
limpiar el estado de prueba**. De ahí que hoy rebote.

### A.2 · Aunque lo prendas, la raíz no te lleva a `/super`

`src/app/page.tsx`:

```
:11  if (session) redirect(role === "owner" ? "/admin" : "/pos");   ← corta acá
:24  if (perfil?.is_superadmin) redirect("/super");                  ← nunca se evalúa
```

El chequeo de superadmin está **debajo** del early-return por sesión de negocio. Como
`dueno@escala.test` **es owner de Kiosco Escala**, siempre cae en `/admin`.

⇒ El redirect automático a `/super` **sólo funciona para un superadmin sin ninguna
membresía activa en un negocio activo** — condición impuesta por `getSession`
(`src/lib/session.ts:88`, `:89`, `:93`).

### Desbloqueo hoy

```sql
update public.profiles set is_superadmin = true where email = 'dueno@escala.test';
```

…y entrás **escribiendo `/super` a mano**. El proxy (`src/lib/supabase/proxy.ts:6`) y
`requireSuperadmin` funcionan bien; lo que falla es sólo el ruteo desde la raíz.

---

## B · Autenticación de plataforma

### B.1 · El flag deja de otorgarse por SQL

**Problema:** el acceso de SYNTRA a su propia plataforma depende de que nadie toque una
fila. No sobrevive a un reset de la base ni a una limpieza de datos de prueba — pasó hoy.

**Propuesta:** RPC `security definer` que sólo puede ejecutar un superadmin existente, más
un **bootstrap por migración** que siembra el primero con el email del owner. El
razonamiento de `superadmin.ts:12-14` (no dar UI a los owners) se respeta: quien otorga es
un superadmin, no un dueño de kiosco.

### B.2 · Agujeros que la auditoría encontró en `/super`

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | `crearNegocio` **no tiene rate limit** — las otras dos acciones sí | `super/actions.ts:46-137`, sin `limitarSuper` (que existe en `:232`) |
| 2 | `crearNegocio` **no audita** | `actions.ts:46-137` sin `registrarOFallar` |
| 3 | `negocio_creado` está tipada y **no la emite nadie** | `src/lib/auditoria.ts:21` + etiqueta `:29`, cero emisores |
| 4 | `stores.created_by` y `members.created_by` **siempre NULL** | `055:112-116`; `create_store` (`010:21-27`) no los acepta |
| 5 | **Un owner puede hacer UPDATE de su propio `stores.status`** | policy de FILA `002:98-100` + `grant update on stores to authenticated` `001:518` |

El **#2 contradice literalmente la cabecera de la migración que lo instauró** (`055:22-24`:
*"TODAS las mutaciones de /super, no sólo las de emergencia. La excepción es lo que vuelve
inútil el registro"*). Es una excepción que se coló.

El **#5 es la misma clase de escalada que la 049 arregló en `profiles`**: policy de fila +
grant de tabla ⇒ el permiso alcanza **todas** las columnas. La migración 019 ya lo había
anticipado por escrito (`019:21-24`) y **el endurecimiento nunca se hizo**. Un dueño
suspendido no puede reactivarse (no tiene sesión), pero un dueño activo puede tocar
columnas que no le corresponden — `ai_assistant_enabled`, entre otras.

### B.3 · 2FA — sí, pero no todavía

**Hoy la plataforma entera de SYNTRA está detrás de email + contraseña de un solo factor**,
con rate limit de 5 intentos / 15 min por cuenta (`login/actions.ts:91`) y **fail-open**
(`src/lib/rate-limit.ts:25-28`). No hay MFA en el código (cero resultados de
`mfa|2fa|totp`) y está deshabilitada en `supabase/config.toml:311-318`. Tampoco hay captcha
(`config.toml:225-229`).

**Criterio:** con cero clientes el riesgo real es bajo. Con el primer cliente pagando, una
credencial comprometida deja de ser un problema nuestro y pasa a ser **la caída total del
negocio de otro**. Va antes de ese hito, y es configuración de Supabase Auth +
enrolamiento, no desarrollo.

### B.4 · Break-glass — documentado, no construido

El camino de emergencia es el `service_role` desde el panel de Supabase. Queda escrito que
usarlo es un evento excepcional que **se anota a mano en `platform_audit`**. Construir un
mecanismo propio a esta escala es inventar una puerta trasera para no usar la que ya existe.

### Lo que NO hay que construir

`platform_audit` (055) ya es sólida y no necesita nada: append-only real (sin grants de
update/delete **para nadie**, `055:56-58`), `reason` de 10+ caracteres validado en la base
(`055:44`), y **el dueño lee las filas de su negocio** vía RLS (`055:59-61`).

**Lo único que falta es que la lea SYNTRA:** hoy `/super` escribe la bitácora y **no puede
consultarla** — no hay ninguna lectura de `platform_audit` en `src/app/super/`.

---

## C · Panel de control

### Las tres preguntas de la semana, en orden

1. **¿Quién me debe?** — estado de suscripción y desde cuándo.
2. **¿Quién se está por ir?** — días sin vender.
3. **¿Cuánto entra este mes?** — suma de los activos. Con 10 clientes es una suma, no un
   gráfico.

### Las señales de salud ya existen

Todas salen de la vista `admin_stores` (`019:45-56`), que `/super` ya lee. Verificado
contra la base — los tres negocios de prueba muestran **exactamente los tres estados** que
el panel tiene que distinguir:

| Negocio | Equipo | Productos | Ventas | Última venta | Lectura |
|---|---|---|---|---|---|
| Kiosco Escala | 3 | 2007 | 1347 | hoy | sano |
| Kiosco El Trébol | 3 | 5 | 201 | hace 4 días | vivo, catálogo mínimo |
| Kiosco Doña Rosa | 1 | 1 | 0 | **nunca** | nunca arrancó |

### Dos arreglos de datos ANTES de construir encima

**1 · `ultima_venta` no filtra por estado** (`019:50`), a diferencia de `ventas`, que sí
exige `completed` (`019:49`). Es la **única de las cinco agregaciones sin filtro de
estado**: una venta anulada cuenta como pulso. Y "última venta" es justamente la señal de
abandono. Una línea de SQL.

**2 · Ninguna agregación tiene ventana temporal.** "1347 ventas" es desde siempre: no
distingue un cliente activo de uno que vendió mucho hace un año. El panel necesita al menos
*ventas de los últimos 30 días*.

### Lo que NO va

- **Gráficos de evolución, cohortes, embudos.** Con 10 clientes una tabla ordenable dice
  más y cuesta cero.
- **GMV / facturación ajena.** Hoy la vista cuenta ventas pero **nunca suma plata** de
  ningún negocio, y saber cuánto factura un cliente no ayuda a cobrarle. Es dato que no
  necesitamos tener.

### Costo a vigilar

`admin_stores` corre **5 subqueries correlacionadas por cada negocio**, sin cota de fecha
(`019:47-52`), y `page.tsx:17` trae 200 filas de una. A 10 clientes es gratis. Conviene
saberlo antes de los 100, no descubrirlo.

---

## D · Cobro de la suscripción — MANUAL

**Decisión del owner: transferencia a alias.** Los datos la respaldan.

### Por qué no la integración automática

La app **no tiene cuenta de MercadoPago de SYNTRA**. `src/lib/mercadopago.ts:5-9` es
explícito:

> *"SYNTRA no toca la plata: el token es del kiosquero y el dinero le entra a él."*

Toda la integración de MP (migraciones 025-033) es el cobro **del kiosco a su comprador
final**. Cobrar suscripciones sería una integración **nueva de punta a punta** — OAuth
propio, webhooks propios, conciliación — no un reuso de lo que hay.

### Modelo de datos (contrato a congelar antes del SQL)

- **`subscriptions`** — una por negocio: precio mensual, día de vencimiento, estado.
- **`subscription_payments`** — **append-only**: fecha, monto, período cubierto, medio,
  quién lo marcó. Es lo que permite contestar *"quién me debe"* con honestidad: **sin
  historial, el estado es una opinión**.

**`stores.status` NO se toca para esto.** Admite sólo `active|suspended` (`001:32`) y es la
guarda de acceso (`session.ts:93`). El estado de cobro es **otra dimensión**: un negocio
puede deber y seguir operando durante toda la escalera. Mezclarlos haría que marcar una
deuda apague la caja de alguien.

### Disparador concreto para automatizar

Cuando marcar pagos y perseguir transferencias pase de **~30 min/mes** — con este flujo,
alrededor de los **12-15 clientes**. Antes de eso, integrar es gasto sin retorno.

---

## E · Escalera de cobranza

### La restricción del owner, y por qué hoy no se puede cumplir

> **Los mensajes de cobranza son SÓLO del dueño. Un cajero viendo "tu jefe debe la
> suscripción" es humillante para el cliente.**

La auditoría encontró que **la maquinaria actual no puede garantizar eso**:

| Pieza | Estado | Evidencia |
|---|---|---|
| Fila de notificación owner-only (`member_id IS NULL`) | ✅ existe, RLS sólida | `002:214-223` |
| Email al dueño (destinatario resuelto por `role='owner'` en SQL) | ✅ estructuralmente owner-only | `020:68-74` |
| **Nadie lee `notifications` en la app** | ❌ log write-only | sólo `alerts/route.ts` y `push.ts` la tocan |
| **El push NO respeta el filtro** | ❌ **fuga** | `notifyStore` guarda owner-only pero `sendPushToStore` sin `memberId` no filtra (`push.ts:55-59`, `:142`) |
| **Un empleado puede tener suscripción push** | ❌ | se suscribe desde `/admin/vencimientos`, staff-accessible (`app-shell.tsx:33`, `vencimientos/actions.ts:66`) |

⇒ **Un aviso de deuda mandado por push le llega al teléfono del cajero.** Es exactamente lo
prohibido. **Arreglar esa fuga es requisito previo de la escalera, no un detalle posterior.**

### La escalera — recalculada con el vencimiento del día 10

> El plan original ponía el recordatorio **el** día 10. Con la decisión del owner, el 10 es
> **la fecha de vencimiento**, no el momento de avisar: recordarle el mismo día que vence
> no es un recordatorio, es un reproche. El aviso va **antes**.

| Momento | Qué pasa | Canal | Tono |
|---|---|---|---|
| **Día 7** | *"Se vence el 10"* — todavía no debe nada | Email al dueño + fila `notifications` | Informativo |
| **Día 10** | Vence. **No pasa nada visible.** | — | — |
| **Día 12** | *"Venció el 10, ¿lo pagaste?"* — margen para la transferencia que salió tarde o el pago que no vi | Email | Recordatorio |
| **Día 18** | *"Si no se regulariza, el 25 se suspende"* — fecha explícita, sin sorpresas | Email + aviso visible in-app | Escalada |
| **Día 25** | Suspensión vía `stores.status` | Guarda existente (`session.ts:93`, `049:175-177`) | Corte |
| **Al pagar** | El owner marca el pago → **todo desaparece** | — | — |

**Por qué el margen del 10 al 12:** el cobro es por transferencia y la conciliación es
manual. Entre que el cliente transfiere y el owner lo ve pueden pasar horas o un fin de
semana. Reclamarle a alguien que ya pagó es peor que reclamar un día más tarde.

**Los 15 días del 10 al 25** son deliberados: es un servicio que el kiosco usa para vender
todos los días. Cortarle la caja rápido no acelera el cobro — le rompe el día y transforma
un atraso en una baja.

### La trampa que hay que resolver en el diseño

**Al suspender, el dueño no puede leer NADA dentro de la app**: `getSession()` devuelve
null y no hay pantalla de suspendido — sólo un banner en `/login` (`motivos.ts:38-39`). Y
hoy `cambiarEstado` **no manda ningún aviso** (`super/actions.ts:163-180`): el dueño se
entera porque no le abre.

⇒ **El email es el único canal que sobrevive a la suspensión.** Por eso es el canal
principal de la escalera, no un complemento del aviso in-app.

### Qué se reusa y qué falta

**Se reusa:** el patrón de cron con `Bearer CRON_SECRET` (`alerts/route.ts:24-28`,
triplicado hoy en los 3 routes), el dedupe por índice unique parcial
`(store_id, dedupe_key)` (`001:296-297`), y el corte por `stores.status`.

**Falta:** un cron nuevo. Los tres existentes son diario (09:00), día 1 y lunes
(`vercel.json:1-16`).

**Recomendación: UN solo cron diario** que mire qué día es y decida, en vez de cuatro
entradas de `vercel.json` (7, 12, 18, 25). Razones concretas: los meses no tienen todos los
mismos días, el dedupe ya resuelve la repetición —`(store_id, dedupe_key)` con la clave
`cobranza:<periodo>:<escalon>`—, y con un solo cron la escalera se lee entera en un archivo
en vez de repartida en cuatro schedules.

---

## F · Login para tres actores

> ✅ **Rediseño AUTORIZADO por el owner (2026-08-18).**
>
> Existe un reference-lock aprobado — `docs/reference-locks/marca-login-shell.md`, con OK
> sobre el prototipo vivo del 2026-07-22, **autoridad nivel 4** de `design-layer-plan.md`.
> Con la autorización, el camino queda: `design-director` → variantes vivas → **OK del owner
> en su navegador** → commit → **el lock se reescribe con lo aprobado**, no antes.
>
> Lo que el lock fija y **no** está en discusión salvo que el owner lo diga: el split panel,
> el overlay hacia `--background`, la imagen neutra de rubro (*"el mismo login sirve a
> cualquier vertical"*), el form sin card flotante sobre el glow, y el footer de marca.

### El problema, medido

El chip que el owner lee como *"Kiosco Escala · no es acá"* es
`{nombreKiosco ?? slug}` más un link, en `login/page.tsx:173-186`.

**Pero la causa de fondo es peor que el chip:** las cookies `sf_kiosco` y `sf_kiosco_n`
**no se borran nunca — ni al cerrar sesión**. `signOut` (`login/actions.ts:154-158`) no las
toca, y su `maxAge` es **un año** (`actions.ts:13`). El dispositivo queda pegado al negocio
anterior, y `?cambiar=1` sólo las **ignora en ese render** (`page.tsx:56`): si volvés a
`/login` pelado, el negocio viejo reaparece.

Dos consecuencias verificadas:
- El dueño que abre su login en un equipo donde entró un empleado **ve el nombre de un
  negocio ajeno** y tiene que tocar "No es acá".
- Si el `select` de `stores.name` falla al loguear (`actions.ts:139`), `sf_kiosco` se
  actualiza pero `sf_kiosco_n` **conserva el nombre anterior**: el chip muestra el nombre
  viejo con el slug nuevo.

### Dirección propuesta

**La lleva `design-director` antes de una línea de código** (workflow de variantes vivas,
`design-freedom-v2 §4`).

Entrada única que **no pregunta quién sos**: un campo que se adapta a lo que escribís —
email ⇒ dueño; algo que no es email ⇒ aparece el código de negocio. El superadmin entra por
el mismo campo con su email real, **sin ninguna pista visual de que el panel existe**
(mismo criterio que `superadmin.ts:27-29`: *"quien no es superadmin no tiene por qué
enterarse de que este panel existe"*).

**Y el código de negocio se olvida al cerrar sesión.** Recordar el terminal es útil;
recordarlo para siempre y mostrarlo como afirmación sobre quién sos, no.

### Restricciones que la propuesta debe cumplir

- **Presupuesto operativo** (`design-layer-plan.md §2.A`): `--ease-out` en entradas **y**
  salidas · prohibido `ease-in`, `ease-in-out`, spring y bounce · nunca `scale(0)` (arrancar
  en 0.95-0.97 + opacity) · desplazamiento ≤8px.
- **El login es la excepción permitida del sistema**: *"3D solo en login"* y *"loops
  infinitos solo en pantallas sin tarea (login, empty states)"*. Además **no es ruta
  autenticada**, así que el techo de 240ms no le aplica literalmente. Es la pantalla donde
  el propio sistema permite carácter — desaprovecharlo sería el error opuesto al genérico.
- **Gate anti-genérico** (§3, 8 ítems, **antes** de mostrarle nada al owner). Con una
  advertencia honesta: los ítems 1-4 **hoy fallan en todo el proyecto** — 29 colores
  hardcodeados, cero tokens `--elev-`/`--surface-`, 37 superficies fuera de `card-system`,
  19 shells copiados. Están **reconocidos y diferidos** en el Anexo C del propio doc. La
  pantalla nueva **no debe sumar deuda**, aunque no le toque saldarla.
- **R2 de responsive**: el nombre del negocio hoy usa `truncate` (`page.tsx:177`). Si ese
  nombre **decide** algo (y decide: te dice si estás en el negocio correcto), la regla pide
  dos líneas o sin cortar.

---

## G · Fiscal — señalado, no resuelto

**Sí: cobrar suscripciones obliga a facturar.** Un monotributista debe emitir comprobante
por **cada** prestación de servicio; para servicio prestado en Argentina es **Factura C**,
sin discriminar IVA, emitida **al momento de prestar el servicio**.

**`docs/fiscal-afip.md` NO cubre esto y hay que decirlo en el doc.** Ese documento trata al
**kiosco facturándole a sus clientes** (WSFEv1, Factura C del kiosquero, el problema de
*nuestro cliente*). Acá el vendedor es **SYNTRA** y el comprador es el kiosquero: **otro
problema con el mismo nombre**.

**Recomendación:** con ≤10 clientes, facturar a mano en el formulario web de ARCA (4-5
minutos por factura, una vez al mes). **No construir facturación en la app.**

### ⚠️ La condición fiscal declarada no permite cobrar

El owner declaró **"consumidor final"**. Eso no es una condición desde la que se pueda
facturar: **es la categoría del que compra, no del que vende**. Un consumidor final no está
inscripto ante ARCA y por lo tanto **no puede emitir comprobantes**.

Con el precio congelado, el número es concreto:

| | |
| --- | --- |
| Precio | $60.000 / mes / negocio |
| Por cliente, al año | $720.000 |
| Tope de **monotributo categoría A** (vigente desde agosto 2026) | **$12.009.410** anuales |
| ⇒ margen a este precio | **~16 clientes** antes de recategorizar |

O sea: el camino natural es **inscribirse en monotributo**, y la categoría de entrada cubre
holgadamente el horizonte de 1-10 clientes de este plan.

**Esto no bloquea nada del software** — la app se construye igual. Bloquea **cobrarle al
primer cliente**, que es un hito distinto y anterior al despliegue.

**No es un tema que resuelva el equipo técnico.** Queda anotado como pendiente del owner,
con un contador, antes de emitir el primer cobro. Se escribe acá porque un plan que asume
resuelto algo que no lo está es peor que uno que lo deja abierto.

---

## H · Fases

| # | Fase | Contenido |
|---|---|---|
| **1** | **Desbloqueo y acceso** | Orden del redirect en `page.tsx` (A.2) · otorgar el flag sin SQL (B.1) · los 5 agujeros de `/super` (B.2) |
| **2** | **Higiene de datos del panel** | `ultima_venta` con filtro de estado + ventana de 30 días (C). Una migración, sin UI |
| **3** | **Eje de suscripción** | Contratos congelados → tablas → panel con "quién me debe" y señal de abandono (C + D) |
| **4** | **Escalera de cobranza** | **Precedida por arreglar la fuga de push** (E) |
| **5** | **Login de tres actores + 2FA** | `design-director` primero, prototipo vivo, OK del owner, lock nuevo (F) · 2FA antes del primer cliente pagando (B.3) |

### Preguntas abiertas para el owner

**Contestadas el 2026-08-18** — ver el bloque de decisiones congeladas: precio ($60.000),
vencimiento (día 10), rediseño del login (autorizado).

**Sigue abierta, y es la única que bloquea cobrar:**

1. **La inscripción fiscal** (§G). "Consumidor final" no habilita a facturar. Con un
   contador, antes del primer cobro — no antes del primer despliegue.

**Y una que no había preguntado y ahora importa:**

2. **¿El primer cliente paga desde el mes 1, o hay período de gracia?** Cambia si el alta de
   un negocio arranca la suscripción o si hay que poder diferirla. Es una columna, pero
   conviene decidirlo antes de congelar el contrato de `subscriptions`.

---

## Verificación del entregable

- Cada afirmación con `archivo:línea` de `7608ee9`.
- Contratos de las tablas nuevas congelados en `rpc-contracts.md` **antes** del SQL.
- El login pasa los 8 ítems del gate **antes** de mostrárselo al owner, y no suma deuda de
  los ítems 1-4.
- **Prueba explícita de la fuga de push:** un empleado con suscripción **no** recibe el
  aviso de cobranza. Es el requisito innegociable del owner.
- Ninguna propuesta toca el camino de cobro ni el aislamiento entre negocios.
