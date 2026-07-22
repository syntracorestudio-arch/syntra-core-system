---
section: hero
status: approved
approved_by: owner (Matias / SYNTRA CORE)
date: 2026-07-17 (objeto) · 2026-07-22 (fondo "La Tinta")
decision: código nativo contra una referencia externa aprobada (workflow variantes vivas)
supersedes: "v1 'Estratos Luminosos' (asset estático image-first, 2026-06-19) — el asset sobrevive en /e/[slug] y OG; el hero ya no lo usa"
---

# Reference Lock — Hero v2 · "El Vórtice"

> **APROBADO E IMPLEMENTADO** (PR #141, merged 2026-07-17). Este lock documenta
> lo que el owner aprobó en su navegador tras una jornada con 8 direcciones
> descartadas. Se escribe DESPUÉS de la aprobación (workflow variantes vivas).

## Objetivo comercial / rol

Primera impresión y `<h1>` único. Debe vender en ~2s: **SYNTRA construye
sistemas digitales premium para negocios reales**. Es la **pieza-firma**: la
sección más impactante del sitio. KPI: reflejo del valor <2s + deseo de seguir
+ clic en el CTA primario.

## Qué es (v2)

El protagonista es un **objeto 3D real** (R3F) en la zona derecha: un **nudo
trenzado de vidrio negro con luz violeta interna** que gira lento, sigue al
cursor y se puede **rotar 360° arrastrando con el mouse**.

Reemplaza al asset estático "Estratos Luminosos" (v1): el hero era la sección
más estática del sitio y el owner pidió que fuera la más viva.

## Origen y decisión clave: réplica NATIVA, no runtime de terceros

La dirección salió de una escena de la comunidad de Spline elegida por el owner
("Glass Knot Vortex"). Tras validar que ese ERA el objeto (embebiendo la escena
real), se decidió **replicarla en three.js puro**:

- El runtime de Spline pesa ~1.8MB y estampa un **badge "Built with Spline"**
  (quitarlo requiere plan pago).
- Spline corre sobre three.js ⇒ los mismos valores en el mismo motor dan los
  mismos píxeles. Se extrajeron del runtime en memoria y se transcribieron.

**Ground truth del rig (extraído del runtime, 2026-07-17) — no tocar sin motivo:**

| Elemento | Valores |
| --- | --- |
| Geometría | `TorusKnotGeometry(165, 28, 500, 50, p=4, q=10)` (trenzado doble) |
| Cámara | fov 45 · position [0, 0, 1000] |
| Renderer | **NoToneMapping** · exposure 1 · shadowMap PCF |
| Luz 1 | Hemisférica sky `#d3d3d3` / ground `#828282` @ 0.75 |
| Luz 2 | Direccional `#ffffff` @ 1 · pos [0, 790, 445] · castShadow |
| Luz 3 | Direccional `#ffffff` @ 2 · pos [0, -814, 256] · castShadow |
| Luz 4 | Point **violeta `#7136ff`** @ 2.8 (6.5 en nuestra escala) · **decay 0** · distance 2000 · pos [96.5, 0, 0] · **SIN castShadow** |
| Material | Phong · color `#2d2d2d` · specular `#404040` · shininess 30 · envMap de estudio (`spline-matcap.png`, extraída) · `combine: AddOperation` · reflectivity 0.55 |

Dos correcciones que costaron iteraciones y hay que **preservar**:

1. **La point violeta NO proyecta sombra**: su sombra PCF cortaba el recorrido
   del violeta en parches duros (en la referencia el violeta fluye continuo).
2. **NoToneMapping**: la curva fílmica por defecto de three comprimía TODOS los
   brillos — era la causa del "le falta luz" que el owner marcaba.

## Interacción (aprobada)

- **Idle:** gira en el plano (período 44s) + bamboleo en dos ejes desfasados
  (27s / 33s) → nunca se lee un loop.
- **Cursor:** se desplaza e inclina hacia el mouse, amortiguado.
- **Drag:** click + arrastre lo rota **360° libre**, con inercia al soltar.
  **El seguimiento del cursor se SUSPENDE mientras arrastrás** (si no, la
  traslación enmascara la rotación y el drag "no se siente").
- Sensibilidad calibrada por el owner: 0.0045 / 0.0035 · decaimiento 0.93.

## Disciplina técnica (invariantes)

- Lazy (`dynamic ssr:false`) vía decider; monta **solo desktop lg+ y sin
  `prefers-reduced-motion`**. En mobile no se descarga ni se renderiza 3D.
- `frameloop` gateado por `useInView` (pausa fuera de viewport, nunca `"never"`).
- dpr capado [1, 1.5] · antialias off · CLS 0 (capa `absolute inset-0`).
- **La capa del objeto NO puede vivir dentro del contenedor de fondo (`-z-20`)**:
  ahí no recibe eventos de puntero y el drag deja de funcionar. Vive en su propia
  capa con hit-testing real.
- Estado del puntero a **nivel módulo** con funciones puras (`stepInertia`,
  `trackPointer`, `beginDrag`…): el React Compiler prohíbe mutar props/args de
  hooks dentro de `useFrame`.
- **El H1 sigue siendo el LCP**: entrada palabra por palabra SOLO en desktop; en
  mobile/SSR pinta estático.

## Excepción de paleta declarada

El **violeta `#7136ff`** está habilitado **solo como luz interna del vórtice**,
por decisión explícita del owner (2026-07-17), como excepción de pieza-firma. NO
se extiende al resto del sitio ni al fondo: la paleta sigue siendo
navy/near-black + electric (#2563eb/#60a5fa) + warm (#e7c8a0/#d97706).
Ver `docs/creative-library/signature-palette-exception.md`.

## Archivos

- `src/components/marketing/hero/hero-anillos-3d.tsx` — escena (rig + material + interacción).
- `src/components/marketing/hero/hero-anillos.tsx` — decider lazy (desktop + motion).
- `src/components/sections/hero-section.tsx` — composición: copy izquierda, objeto derecha, capas de fondo.
- `public/visual-assets/syntra/hero/spline-matcap.png` — entorno de estudio (80KB) que genera las planchas de reflejo.

## Criterios binarios (verificados en el prototipo aprobado)

- [x] El objeto lee **vidrio negro** (cuerpo negro + planchas de reflejo blanco líquido), no plástico ni grafito.
- [x] El violeta **recorre continuo** las caras internas, sin cortes ni parches.
- [x] Idle perceptible sin marear; nunca se detiene.
- [x] Drag rota 360° con inercia y **se siente** (sin traslación que lo enmascare).
- [x] No compite con H1/subtítulo/CTAs (scrim izquierdo intacto, AA).
- [x] Mobile/reduced-motion: hero limpio, 0 bytes de 3D, sin CLS.
- [x] `tsc` · `lint` · `build` verdes · consola sin errores.
- [x] Sin dependencias de terceros ni badge de marca ajena.

## Anti-loop: lecciones de la jornada (8 direcciones descartadas)

Se probaron y rechazaron: monolito de estratos · chip/placa tipo Blendr · red
plexus · video de fondo (placeholder) · anillos entrelazados (3 materiales) ·
nudo esculpido en Blender · render offline en Cycles. Qué dejó:

1. **La referencia del owner se REPLICA, no se interpreta.** Cuando pide
   "exactamente igual", las versiones "inspiradas en" no sirven.
2. **Pedir los VALORES, no describir el look.** Las capturas del editor de
   Spline (luces, material) destrabaron en minutos lo que horas de tuning a ojo
   no lograron.
3. **Si la referencia es una escena real, embeberla primero para validar el
   objeto**; recién después decidir cómo replicarla. Separa "¿es este el objeto?"
   de "¿cómo lo construimos?".
4. **Los renders offline (Cycles) no son comparables a lo que ve el usuario**:
   el runtime tiene otro presupuesto. Si el destino es la web, iterar en la web.
5. Un objeto 3D protagonista se juzga **en movimiento y en el navegador del
   owner**, nunca en un frame quieto.

---

# Reference Lock — Hero, FONDO v3 · "La Tinta"

> **APROBADO POR EL OWNER EN SU NAVEGADOR** (2026-07-22). Cierra el pendiente
> que este lock arrastraba desde 2026-07-18: el hero ya tiene fondo propio.
> Deroga los intentos no aprobados de la saga (placas de vidrio azules,
> estructura, cámara con horizonte).

## Qué es

El fondo dejó de ser un objeto con silueta y pasó a ser **luz**: la atmósfera
del espacio donde vive el vórtice. Masas de tinta azul que se difunden en un
campo casi negro, sin un solo borde duro, recorriendo la sección completa.

**Referencia del owner:** escena "Liquid Gradient Abstract Background" de Spline
Community (remix oscuro). Dato que destrabó la paleta: al muestrear sus píxeles
reales, el gradiente entero vive entre `#000000` y `#0a2655` (p99) — el "azul
eléctrico" que uno percibe es **contraste local contra el campo casi negro**,
no luminancia real. Copiar el azul percibido habría dado un fondo 5× más
brillante que la referencia.

## Paleta aprobada (hue lock 214-224°)

| Rol | Hex |
| --- | --- |
| Vacío / costura con Servicios | `#04070E` |
| Aire oscuro | `#060B14` |
| Primera insinuación (ya es azul, no gris) | `#09182F` |
| Masa en sombra | `#0F2A5C` |
| Cuerpo iluminado (promedio del área azul) | `#17459E` |
| Cresta | `#1D4ED8` |
| Núcleo | `#2563EB` — **≤1,5% del encuadre** |

Por debajo de 210° lee teal/cyan (prohibido en la web); por encima de 228°
entra en índigo → cliché IA. **El eléctrico `#2563EB` no es "un azul" en esta
web: es el token del CTA.** Si el fondo lo ocupa a gran área, el botón primario
deja de ser el azul más brillante de la pantalla y se cae la jerarquía de
acción — ahí es donde el hero empieza a leer como SaaS genérico.

## Criterios binarios (medidos, no a ojo)

| Criterio | Umbral | Medido 2026-07-22 |
| --- | --- | --- |
| Contraste H1 sobre el peor píxel de su columna | ≥14:1 | **15,3:1** (peor momento de la serie) |
| Contraste subtítulo | ≥7:1 | **9,0:1** |
| Materia visible (cobertura de la sección) | ≥85% | **87%** |
| Se lee como azul (`>#0F2A5C`) | ≤34% | **12,5-35,2%** según el momento |
| Cuerpo luminoso (`>#17459E`) | ≤12% | **4,6%** |
| Núcleo `#2563EB` | ≤1,5% | **0,7%** |
| Esquina superior izquierda | no debe quedarse oscura | **12,4 → 28,8** de luminancia |
| Perf | 60 FPS · CLS 0 | **cumple** |

## Decisiones de composición (no reabrir sin pedido del owner)

1. **El foco luminoso NO va donde está el nudo.** El vórtice es vidrio negro
   con reflejos blancos: sobre azul brillante se vuelve un recorte plano. Lleva
   un **pozo oscuro** sobre su mitad superior para que esos reflejos existan.
2. **La irregularidad no puede venir de la posición en X.** Una rampa lateral
   produce, por construcción, la lectura "mitad azul / mitad oscura" que el
   owner rechazó. La densidad desigual la dan **baches negativos salpicados**.
3. **Ningún blob anclado en una esquina.** Un bache fijo deja esa zona
   permanentemente oscura — fue exactamente el defecto que el owner detectó en
   el margen superior izquierdo. Todo orbita salvo el bache que protege el H1.
4. **El grano va ENCIMA del gradiente**, no debajo: es lo que lo convierte en
   atmósfera fotografiada en vez de render limpio de plantilla.
5. **La point light violeta del rig queda en 3.0** (era 6.5). Sobre negro puro
   separaba el nudo del vacío; con azul detrás el fondo ya hace ese trabajo, y
   azul + violeta juntos son la firma cromática del render de IA genérico.
   Solo puede verse DENTRO de la silueta del nudo.
6. **El mouse mueve el fondo por VELOCIDAD, nunca por posición.** El vórtice ya
   responde a la posición del puntero; si el fondo hiciera lo mismo, las dos
   respuestas se sumarían y todo se sentiría pegado al cursor.

## Anti-loop: lecciones del fondo (además de las del objeto)

1. **Muestrear la referencia, no describirla.** La descripción a ojo ("azul
   eléctrico saturado") era falsa; los píxeles decían `#0a2655`. Una spec de
   color escrita sobre la percepción habría mandado a implementar mal.
2. **Un fondo no puede usar el mismo material que el protagonista.** Las placas
   fallaron por eso: vidrio contra vidrio, el ojo compara y el fondo pierde.
3. **Cuando el resultado tiene una lectura estructural equivocada, el problema
   es la estructura, no los valores.** El "mitad y mitad" no se arreglaba
   calibrando: había que sacar la rampa en X.
4. **Con fondo en movimiento, un frame no prueba nada.** Las garantías
   (contraste, cobertura, % de azul) se verifican con una serie temporal; el
   pico manda sobre el promedio.

## Archivos

- `src/components/marketing/hero/hero-liquido.tsx` — el shader (props expuestas:
  `speed`, `scale`, `focus`, `well`, `ceilLeft`, `intensity`, `contrast`,
  `warp`, `dither`, `pointer`).
- `src/components/marketing/hero/hero-camara.tsx` — base CSS + eco estático en
  mesh-gradient para mobile / reduced-motion.
- `src/components/marketing/hero/hero-anillos-3d.tsx` — canvas, rig y nitidez.
- `src/components/sections/hero-section.tsx` — orden de capas (el quad es opaco:
  grano, scrim y costura van encima del canvas; el contenido necesita `z-10`).

---

## Actualización 2026-07-22 — póster, LCP y ciclo del fondo (PR #151, #153, #154)

**El shell del Hero es rail propio y así queda.** Navbar + Hero usan
`SHELL_ESCENARIO` (exportado desde `container.tsx`; antes estaba duplicado
string-a-string en dos archivos). No se unifica con el resto por dos razones
verificadas: el logo tiene que alinear con el H1 —se ven juntos en la primera
pantalla— y la cámara del vórtice usa `setViewOffset` anclado al **viewport**, así
que mover el shell descoloca la escena aprobada. Ver **[grilla.md](grilla.md)**.

**Póster mobile re-horneado.** Abajo de 1024 no hay canvas y el objeto es un webp;
venía de la luz violeta en **6.5**, la vieja. En desktop eso se bajó a 3.0 porque
"azul + violeta juntos son la firma cromática del render de IA genérico que la
marca evita" — o sea que en mobile se seguía mostrando justo el violeta que se
había sacado. Re-horneado desde la escena viva con el rig exacto del dump de
Spline. Control con las dos intensidades y la misma pose: el asset viejo
reproducía el horneado a 6.5 (7.1% de violeta contra 7.2%); el nuevo baja el
violeta saturado de **2.3% a 0.2%**. 29.5 → 39.2KB.

**La entrada above-the-fold pasó de framer a CSS.** El gate en JS no funcionaba:
`useDesktop()` usa `useSyncExternalStore` con `getServerSnapshot=false` y React usa
ESE valor en el render de hidratación, justo cuando framer aplica su `initial`. Y
aun funcionando, framer no puede animar hasta que hidrata: en mobile eso dejaba el
subtítulo en `opacity:0` dentro del HTML servido y, como es más grande que el H1 en
un teléfono (29988 vs 20832 px²), se quedaba con el LCP. Con media query no hay JS.
Producción, 4G lento, CPU 4×, mediana de 3 corridas: **4068 → 1480ms** a 390px.
Desktop conserva su entrada y ahora arranca en el primer pintado.

**"La Tinta" — el ciclo dejó de cortarse.** Dos causas:
1. El canvas corre con `frameloop` demand fuera de viewport y el navegador congela
   el rAF en segundo plano, pero `uTime` salía de `clock.elapsedTime`, que mide
   tiempo real. Instrumentado: tras 3s fuera daba **−2.32s** — R3F reinicia el
   reloj, así que el fondo saltaba *hacia atrás*. Ahora lleva su propio tiempo
   acumulado con el delta acotado a 50ms.
2. El hash del ruido armaba productos de hasta **2.1e5** antes del `fract()` y la
   GPU trabaja en float32: error medio 0.0169 contra 0.0009 del hash de Hoskins
   que lo reemplaza. Esa pérdida está correlacionada con la posición ⇒ escalones
   de borde recto que el cizallamiento del puntero arrastra.

**Descartados con medición, para no volver a probarlos:** banding de 8 bits (el
dither anda, meseta más larga 7px), curvas de nivel de la rampa de color (se
probaron tres formulaciones y **la actual salió mejor** que los reemplazos) y
quiebres temporales del ruido (cero en 60s). **La rampa aprobada no se tocó.**

### Criterios binarios añadidos

- [x] El objeto de mobile y el de desktop tienen el mismo hue (violeta saturado ≤0.5%).
- [x] El bloque above-the-fold viaja VISIBLE en el HTML servido en mobile.
- [x] El ciclo del fondo no salta al volver de otra pestaña ni al re-entrar al viewport.
- [x] Desktop conserva la entrada escalonada (verificado cuadro a cuadro).
