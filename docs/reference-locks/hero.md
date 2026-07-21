---
section: hero
status: approved
approved_by: owner (Matias / SYNTRA CORE)
date: 2026-07-17
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

## Pendiente (no bloquea)

- **Fondo del Hero:** hoy usa `SectionAtmosphere accent="dual"` (el sistema común
  de la Home). El owner pidió (2026-07-18) un fondo **propio y distinto** del
  resto de las secciones, que haga del hero el acto de apertura sin repetir
  stardust/auroras. Dirección en definición → se documenta acá al aprobarse.
