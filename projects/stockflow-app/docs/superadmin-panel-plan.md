# Plan · Panel de superadmin — acceso, cartera y cobranza

**Base:** `main` (PR #252 del login pendiente de merge).
**Estado:** propuesta. Nada implementado.
**Pedido del owner (2026-08-19):** login independiente de superadmin con sus
credenciales · dashboard con gráficos y métricas · filtro de clientes ·
deudores · ingresos · evaluar sidebar · "todo lo que debe tener un panel de
superadmin para gestionar los clientes de manera más eficiente".

**Restricción que ordena todo:** hay **cero clientes pagando** hoy. El objetivo
es 10-30. El panel se usa **una vez por semana, en desktop**. Todo se dimensiona
para eso, y todo lo que se construya tiene que ser honesto con N=1.

---

## A · Dos bloqueantes que no son de diseño

Se descubrieron auditando antes de proponer. Van primero porque sin ellos el
resto no se puede usar.

### A.1 · Nadie puede entrar a `/super`. Literalmente.

Verificado contra la base local:

```sql
select email, is_superadmin from profiles;
-- 7 filas, TODAS con is_superadmin = false. Cero superadmins.
-- syntracore.studio@gmail.com no tiene perfil.
```

El bootstrap de `056_plataforma_acceso.sql:95-98` hace:

```sql
update public.profiles set is_superadmin = true
 where lower(email) = lower('syntracore.studio@gmail.com') and is_superadmin = false;
```

En una base **nueva** eso no matchea ninguna fila: las migraciones corren antes
de que nadie se registre, y no hay signup público (el onboarding es controlado).
Y `otorgar_superadmin` **exige un superadmin que ya exista** para poder otorgar.
Círculo cerrado.

La cabecera de la propia migración dice que existe *"así el acceso del owner
sobrevive a un reset de la base"* (`056:86-88`). **No lo cumple.** El único
camino hoy es crear el usuario a mano en el panel de Supabase y correr el
`update` a mano — exactamente el paso manual que la migración quería eliminar.

No se nota en local porque el entorno arrancó con `seed.sql`, que sí inserta en
`auth.users` — pero `seed.sql` sólo corre en `db reset` y **nunca en producción**.

**Arreglo:** `scripts/crear-superadmin.mjs` con `service_role`, que (1) crea el
usuario de auth con contraseña vía Admin API —única forma de setear una
contraseña; el SQL no puede— y (2) prende el flag. Idempotente, corrible una vez
en el deploy, documentado en `despliegue-plan.md`. La migración queda como red
de seguridad para el caso en que el perfil ya exista.

### A.2 · Si un cliente pierde la contraseña, no lo podés ayudar

Las credenciales se muestran **una sola vez**, al dar de alta
(`super-client.tsx:664` — *"no la vas a poder ver de nuevo"*). No existe ninguna
acción para reemitirlas. Y "Me olvidé la contraseña" manda un email que **hoy no
sale**: el SMTP está gateado por la compra del dominio (`despliegue-plan.md §5.1b`).

Con un cliente pagando, esto es una llamada que termina con el owner abriendo
Supabase a mano. Es más urgente que cualquier gráfico.

**Arreglo:** acción `reemitirCredenciales(storeId, motivo)` en `super/actions.ts`,
auditada en `platform_audit` como todas las demás, reusando el diálogo de
credenciales que ya existe.

---

## B · Login independiente de superadmin

### Lo que ya funciona (no hace falta construirlo)

El ruteo **ya está resuelto**: `src/app/page.tsx:26` evalúa `esSuperadmin`
**antes** que el redirect por rol, así que entrando por `/login` con el email
real se cae en `/super` aunque además se sea dueño de kioscos de prueba. Eso se
arregló en la fase 1 y está en `main`.

### Lo que un login separado sí compra

| A favor | En contra |
|---|---|
| **Freno propio.** Hoy el login es 30/5min por IP y 5/15min por cuenta (`login/actions.ts:90-91`), calibrado para un cajero que tipea mal. Un endpoint de plataforma puede ser 3/30min sin castigar a nadie. | **Anuncia que el panel existe.** Hoy está escondido a propósito: `requireSuperadmin` redirige a `/` en vez de tirar 403, *"quien no es superadmin no tiene por qué enterarse de que este panel existe"* (`superadmin.ts:27-29`). |
| Identidad SYNTRA en la entrada, no marca de cliente. | Un endpoint de admin **conocido y de un solo factor** es más atacable que un camino oculto. |
| Separa conceptualmente la sesión de operador de la de cliente. | |

**Recomendación:** hacerlo, en **ruta no listada**, con freno propio (3/30min),
**errores genéricos** que no revelen si un email es superadmin, y sin link desde
ningún lado.

> ⚠️ **Señalado una vez, la decisión es del owner:** separar el login **sin 2FA**
> deja la plataforma *más* expuesta que hoy, no menos — se gana descubribilidad
> sin ganar factor. El owner descartó 2FA explícitamente (2026-08-19) y se
> procede con su decisión. Queda anotado para revisar con el primer cliente
> pagando.

---

## C · Estructura del panel — **sidebar: no**

Dirección del `design-director`, y contradice el pedido con motivo:

> *"Con 4 destinos reales y uso semanal, una sidebar es un mueble con 4 cajones
> ocupando 240px de un desktop donde lo que quiere ancho es la tabla de 30 filas.
> La del dueño existe porque tiene 14 destinos y uso diario multi-tarea."*

**Propuesta: header propio + nav horizontal de 4 tabs** — `Cartera` (default) ·
`Cobranza` · `Ingresos` · `Actividad`.

**Umbral explícito de promoción a sidebar:** 8+ destinos **o** uso diario. Antes
de eso es imitar la forma del panel del cliente sin su necesidad.

**No reusar `app-shell`:** está casado con `getSession()`, `puedeAbrir()`,
permisos de miembro y `AvisoSuscripcion`. Meterle un modo superadmin contamina
la ruta caliente del cliente para ahorrar ~60 líneas. Se reusa la **gramática**
(`card-system`, `CardLabel`, `tabular`, `Badge`, tokens), no el componente.

**No negociable:** el cromo del superadmin debe **verse distinto** del panel del
cliente. El del dueño es white-label con el accent del negocio; éste va fijo,
marca SYNTRA, misma base `#0A0D13` pero header en otra clave. *El error caro de
este panel es suspender el negocio equivocado* — la señal de contexto es
prevención, no branding.

---

## D · Gráficos: **distribución no, tiempo sí**

El código actual dice, en `super-client.tsx:~178`, *"deliberadamente SIN
gráfico: con 10 clientes un gráfico es decoración"*. El director lo corrigió a
medias en vez de borrarlo, y el matiz es el criterio que queda:

- **Falso para gráficos de tiempo.** La serie mensual de cobrado tiene 12 puntos
  aunque haya 3 clientes, y contesta *"¿crezco o estoy estancado?"* — que ningún
  color de fila contesta.
- **Cierto para gráficos de distribución.** Un donut de 10 clientes al mismo
  precio son 10 porciones iguales: cero información, y encima roza el GMV que se
  decidió no mostrar.

### Métricas de ESTADO vs métricas de HISTORIA

| Honestas desde el cliente #1 (estado, no promedian nada) | Necesitan historia (≥3 meses con pagos) |
|---|---|
| Por mes comprometido · sin cobrar hoy · días de atraso del peor · cuántos en prueba y qué día vence cada una · para cortar · sin plan · **última venta por negocio** | Cobrado por mes · tiempo medio de cobro · conversión prueba→pago · churn · acumulado |

**Nunca:** ejes vacíos, "$0" permanente, "0%" de un cociente sin denominador.
*Un renglón que dice cero todas las semanas entrena a no mirar la pantalla, y esa
desconfianza no se recupera.*

### Pantalla progresiva, con umbral en código

| N | Qué se ve |
|---|---|
| 0 | No es un dashboard: es el alta. Un CTA, cero cards. (Lo que ya hay está bien.) |
| 1-4 | Lista + tira de estado. **Cero gráficos.** Honesto y completo. |
| ≥5 **o** ≥3 meses con pagos | Emerge la fila de series. |

Para el bloque todavía en construcción se reusa la gramática ya inventada en
`profit_coverage === null`: no ocultarlo mudo, **mostrar el progreso hacia él** —
*"Cobrado por mes · llevás 2 meses asentados; en octubre esto muestra tu curva."*
Convierte el vacío en una promesa con fecha en vez de en una pantalla rota.

### Las tres visualizaciones que ganan su lugar (cero-dep)

> **Corregido 2026-08-19.** Una versión anterior de este doc afirmaba que la app
> no tenía librería de gráficos. **Es falso:** `recharts@^3.10.0` está en
> `package.json:26` y **en uso** en `admin/reportes/reportes-client.tsx:5-18`
> (`BarChart`, `AreaChart`, `PieChart`, `Tooltip`, `ResponsiveContainer`). Las
> barras CSS conviven con ella para casos simples.

Consecuencia: **no hay que sumar ninguna dependencia** ni pedir aprobación de
deps — la decisión es sólo *qué herramienta usar para cada pieza*:

| Pieza | Herramienta | Por qué |
|---|---|---|
| Cobrado por mes (12 barras) | **recharts** | Ya está paga; ejes, tooltip y responsive gratis, y queda consistente con los reportes del dueño |
| Grilla de cobranza (negocios × 6 meses) | **CSS grid** | No es un gráfico, es una tabla de cuadraditos: recharts no aporta nada |
| Composición de la cartera (barra segmentada) | **CSS** | Una barra de 5 segmentos no justifica un `ResponsiveContainer` |

1. **Cobrado por mes** — 12 barras verticales CSS.
   `sum(subscription_payments.monto) group by periodo`. Truco que lo hace
   valioso: **contorno = comprometido, relleno = cobrado**; el hueco *es* la
   mora, se lee sin leyenda. Aparece con ≥3 meses.
2. **Grilla de cobranza** — filas = negocios, columnas = últimos 6 meses, celda =
   pagado / parcial / impago / no-aplica. No es un gráfico: es una tabla de
   cuadraditos. **Sirve con 3 clientes y sigue sirviendo con 30.** Separa al
   cliente-problema-crónico del que se atrasó una vez — distinción que el estado
   actual (un solo badge "debe") borra por completo. *Es lo de mayor valor por
   línea de código de todo el plan, y el owner no lo pidió.*
3. **Composición de la cartera** — una barra horizontal segmentada: al día /
   debe / prueba / sin plan / de baja. Reemplaza al donut, honesta con N=3.

**Descartar como decoración:** pie de ingresos por cliente · línea de MRR (con
altas de a una es una escalera de 3 escalones que la barra ya cuenta) ·
sparklines por fila (ruido a 30 filas) · cualquier gauge de "salud".

---

## E · Jerarquía: arriba va trabajo nominado, no KPIs

*La sentada semanal no empieza con un número, empieza con una lista de nombres.*

1. **"Para hacer esta semana"** — acciones con nombre propio: *"Llamar a El
   Trébol · debe $120.000 · 45 días"* · *"Cortar a X"* · *"Vence la prueba de Z
   el jueves"* · *"W no vende hace 12 días"*. Es el **único** bloque que puede
   estar vacío sin dañar la confianza: "Nada pendiente" acá es un logro.
2. Tira de 3 cifras de estado (por mes · sin cobrar · en prueba) — lo que ya
   existe, promovido a cards.
3. La cartera: tabla densa con chips de filtro.
4. Series, condicionales.

**El gráfico cierra la sentada, no la abre.**

**Hallazgo suelto:** hoy `ventas30d` / `ultimaVenta` están en la fila pero **no
son alerta**. Un cliente que dejó de vender hace 10 días se da de baja antes de
deberte plata: es la señal de retención más temprana disponible, y está desde el
cliente #1. Tiene que subir a "para hacer esta semana", no quedarse en gris.

---

## F · Ficha por cliente — `/super/[slug]`

Sí. El motivo no es el volumen, es la **historia**: el historial de pagos, el
timeline de `platform_audit` y las notas no entran en un diálogo, y son
exactamente lo que se lee **durante** la llamada de cobro.

Contenido: encabezado con estado + acciones · pagos de 12 meses · uso (última
venta, 30d, productos, miembros) · timeline de auditoría · notas ·
credenciales/reset.

Los diálogos actuales quedan: alta, credenciales y pago son actos de un paso. El
de pago debe dispararse desde la fila **y** desde la ficha. **La fila navega, no
se expande.**

> **Gap que esto cierra — verificado en vivo:** `platform_audit` hoy la lee
> **sólo el cliente** (`admin/configuracion/actividad-syntra.tsx:21`). SYNTRA
> escribe su propia bitácora y **no puede consultarla**. Al intentar leerla con
> `service_role` durante la fase 1, Postgres contestó textual:
>
> ```
> 42501 · permission denied for table platform_audit
> hint: GRANT SELECT ON public.platform_audit TO service_role;
> ```
>
> O sea que la única forma de auditar hoy es `psql` contra la base. Es una
> migración de una línea, pero **es un GRANT nuevo sobre la tabla más sensible
> del sistema**: entra con la ficha por cliente, que es lo que la va a leer, y no
> antes — un grant sin llamador es exactamente cómo se abrieron `admin_stores`,
> `promo_vigente` y `cobranza_escalon`.

---

## G · Lo que falta y no se pidió

- **Copiar el mensaje de cobro** (WhatsApp armado: nombre, monto, meses, alias).
  *El cuello de botella del cobro manual no es saber quién debe: es redactar
  ocho mensajes.*
- **Registrar el aviso enviado.** "45 días de atraso" se lee distinto si ya
  reclamaste tres veces. `cobranza_escalon` (060/061) modela la escalera
  automática; falta el registro del **contacto humano**.
- **Notas + próximo contacto (fecha).** CRM mínimo. `subscriptions.notas` ya
  existe; falta UI y un `seguimiento_el date`.
- **Checklist de onboarding por cliente nuevo**: creado → entró → cargó productos
  → primera venta → 7 días vendiendo. Todo derivable de datos que ya existen, y
  es lo que **predice si paga el mes 2**.
- **Filtros como chips** (deben · en prueba · sin plan · inactivos · de baja) +
  buscador. A 30 filas deja de ser opcional.
- **"Cobrado este mes"** — lista plana de pagos asentados con monto y nota, para
  **conciliar contra el banco**. Hoy no hay forma de verificar que lo marcado
  coincide con las transferencias reales.
- **Export CSV** de pagos. Barato ahora, se agradece en marzo (y ante el contador).

---

## H · Diferencias con el dashboard del dueño

**Reusar** (gramática, no pantalla): `card-system`, `CardLabel`, `tabular`,
`pesos`, `Badge`, `VerTodo`, tokens, el patrón de degradación honesta (`—` + el
porqué) y el de conteo real vs array acotado.

**Diferenciarse en cuatro ejes:**

| Eje | Dueño | Superadmin |
|---|---|---|
| Unidad de análisis | productos, **día** | clientes, **mes** — *no tiene "hoy"*: no copiar "Vendido hoy / Ganancia estimada" |
| Densidad | mobile-first, dedo | desktop, mouse, **tabla comparable** de 30 filas |
| Tono | motivar (*"cargá tus costos"*) | mostrar consecuencias (*"deja de poder vender"*) |
| Motion | rico | mínimo funcional. **`CountUp` no: animar "sin cobrar" es celebrar la mora.** |

---

## I · Fases

**Riesgo #1:** construir el dashboard de gráficos primero y llenarlo de ceros.

1. ~~**Acceso real** — `crear-superadmin.mjs` (A.1) + `reemitirCredenciales`
   (A.2).~~ **HECHA** (2026-08-19). Verificado de punta a punta contra la base
   local: el script crea la cuenta, deja entrar y es idempotente; la reemisión
   genera la clave, corta las sesiones, obliga a cambiarla en el próximo ingreso
   y deja fila en `platform_audit` con actor, motivo e IP.
2. **Login independiente** (B) — ruta no listada, freno propio, errores genéricos.
3. **Estructura + filtros + ficha** (C, F, y los chips de G) — útiles con **1
   cliente**.
4. **Cobranza** (D.2 grilla, G: mensaje, registro de contacto, notas,
   conciliación).
5. **Series** (D.1, D.3) — se activan solas cuando hay historia.

### Decisiones que necesita el owner

1. **¿Ruta del login?** No listada (ej. `/syntra/entrar`) vs `/super/login`.
2. **¿Reemisión de credenciales invalida la anterior al instante**, o conviven
   hasta que el cliente entre con la nueva? (Lo segundo evita dejar una caja sin
   acceso en hora pico.)
3. **¿La grilla de cobranza entra en esta ronda?** Es lo de mayor valor por línea
   de código y es lo único que no pidió.
4. **¿Confirma sin sidebar** (4 tabs), sabiendo que el umbral de promoción es 8+
   destinos o uso diario?
