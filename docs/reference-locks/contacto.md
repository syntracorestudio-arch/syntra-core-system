---
section: contacto
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-06-26
decision: code-first
supersedes: "WEB-013C on-system materiality (SceneAtmosphere), approved 2026-06-22"
---

# Reference Lock — Contacto ("El campo se inclina hacia vos")

> Bajo `docs/creative-library/living-web-doctrine.md` (web viva). Versiona el lock
> anterior (WEB-013C, materiality `SceneAtmosphere`): el **fondo** de Contacto pasa a
> ser un **campo vivo interactivo**. El **formulario, su layout, copy, estados y lógica
> server-side NO cambian** (siguen como el WEB-013C live). Análisis read-only por
> `motion-3d-engineer` (factibilidad) + `creative-director` (dirección) +
> `design-system-guardian` (tokens), 2026-06-26; dirección elegida por el owner (A).
> **Este lock NO autoriza código hasta `status: approved`.**

## Origen del pedido

El owner pidió, a partir de una **imagen de referencia** (fondo navy tipo constelación:
grilla en perspectiva + líneas curvas de luz azul + nodos que brillan + mallas de puntos
en esquinas + bokeh), un fondo para Contacto con **interacción al mouse**: que al pasar el
cursor sobre los puntos, las líneas y puntos se muevan/reaccionen.

**Veredicto de los agentes:** la imagen *literal* es el cliché "fondo tecnológico de
stock" que la doctrina §5 veta (y que se acaba de eliminar de la sección Sistema). Pero la
**intención** (profundidad azul + red viva + "el sistema reacciona cuando me acerco") es
legítima y muy on-brand para el cierre. Se aprueba la intención, se descarta la copia
literal. La imagen queda como **brief de sensación**, no como target visual.

## Objetivo comercial / rol en la landing

Cierre de la landing y captación de leads (`#contacto`). Último beat del recorrido: tras
ver cómo SYNTRA procesa una consulta, el usuario **entra la suya**. KPI: envío sin
fricción + percepción de confianza/seriedad. Esta intervención **no cambia ese rol**: pone
el fondo al nivel de la web viva y convierte la interacción en **metáfora de conversión**
("el sistema te registra y responde cuando te acercás").

## Ampliación v2 (2026-06-26) — Rail enriquecido + núcleo SC + depuración del form

> El fondo vivo (abajo) **se mantiene**. Esta v2 amplía el lock al **contenido del rail y
> al formulario**, a partir de un **mockup del owner** evaluado por `creative-director` +
> `motion-3d-engineer`. El mockup se aprueba **depurado** (gana por sustracción): se toma lo
> on-brand, se descarta lo genérico. Decisiones del owner: **núcleo SC sutil sin WebGL** +
> **reaseguro sin promesa de tiempo**. Supersede la cláusula previa de "el formulario no
> cambia": ahora el form recibe mejoras acotadas (no se toca su lógica server-side).

**Se TOMA del mockup (on-brand):**
- **Rail: lista de 3 capacidades** ("Webs modernas y escalables" · "Automatización de
  procesos" · "IA e integraciones inteligentes") con **íconos line tenues** (no cuadrados
  rellenos). Content-driven (`site.ts`). Llena el espacio muerto con contenido útil.
- **Núcleo SC** como pieza-firma del rail, **sutil, CSS/SVG (sin WebGL)**: esfera con
  profundidad por `radial-gradient` + **borde de luz electric (fresnel-fake)** + el **logo
  SC** (`/logo.png`) nítido al centro + halo de profundidad detrás. Opcional: **un** arco
  fino incompleto en rotación lentísima. Reduced-motion → estático. Reemplaza el "espacio
  muerto" por un ancla de marca.
- **Chip de tipo de proyecto seleccionado con fill electric + check** (mejora el actual).
- **Contador de caracteres del textarea CONDICIONAL** (aparece sólo cerca del límite,
  `maxLength 1000`; no "0/1000" permanente).
- **Bloque de reaseguro** cerca del botón (con ícono escudo tenue), **SIN número de tiempo**:
  copy honesto tipo "Sin compromiso. Te respondemos personalmente."

**Se DESCARTA (genérico / choca §5 / honestidad):**
- ❌ Anillos orbitales + base/plataforma glowing del orbe (cliché sci-fi/crypto).
- ❌ Crystal-ball con `transmission` real (genérico + caro); el vidrio es fresnel-fake.
- ❌ Íconos en cada label del form ("form-builder", resta premium).
- ❌ Borde azul glowing perimetral de la card (se mantiene el hairline + acento puntual).
- ❌ **"Te respondemos en menos de 24hs"** — promesa de tiempo que el form evita a propósito;
  el reaseguro va **sin número** (decisión del owner).

**Norte del núcleo SC (no negociable):** subordinado al form (el form es el protagonista) y
al CTA (el azul de acción es el botón, 90/10). Costo ~nulo (CSS/SVG), **CLS 0** (alto
reservado en el rail), reduced-motion → sin rotación, mobile sin jank. Nunca más brillante
que el botón "Enviar consulta". No usa cyan (reservado al éxito del envío).

**Criterios binarios v2:**
- [ ] Rail con lista de capacidades (íconos line tenues) + núcleo SC sutil → el espacio
      muerto desaparece como contenido/marca, no como relleno.
- [ ] Núcleo SC **CSS/SVG**, sin anillos/base, logo nítido, borde electric, halo; reduced-
      motion → estático; CLS 0.
- [ ] Form depurado: chip con fill+check, contador condicional, reaseguro **sin tiempo**;
      **sin** íconos por label; **sin** borde glow perimetral.
- [ ] Lógica server-side, validación, honeypot, success state: **intactos**.
- [ ] El núcleo y el rail **no compiten** con el form ni con el fondo vivo; el botón sigue
      siendo el único azul de acción (90/10).

## Dirección visual elegida — A: "El campo se inclina hacia vos"

**Campo de profundidad reactivo, NO una constelación de nodos.** Capas de partículas /
trazos finos muy tenues a distintas profundidades (parallax/bokeh real). En **reposo**, el
campo deriva lento (misma gramática que Casos: la consulta entrando). El **mouse genera un
pozo de gravedad**: las capas/puntos cercanos se **inclinan y se aclaran levemente hacia el
cursor**, como si el sistema te registrara. Sin grilla en perspectiva, sin aristas
nodo-a-nodo, sin puntos-estrella, sin "malla tipo ola" en esquinas. La reacción **ES** la
razón de ser del campo (no un adorno): es la promesa "te respondemos" hecha gesto.

## Interacción (núcleo de la dirección)

- **Modelo gravitacional / de orientación**, no "encendido de nodos". El campo se inclina,
  se aclara y se ordena hacia el cursor. **Nunca** puntos que titilan al hover (eso es el
  cliché de CodePen "interactive particle network").
- **Implementación (motion-3d-engineer):** canvas `pointer-events:none` (el form sigue 100%
  clickeable); listener `pointermove` a nivel **window** que escribe la posición a un store
  mutable module-level (NO setState); `useFrame` lerpea esa posición a un **uniform `uMouse`**.
  El desplazamiento de puntos/líneas se calcula en el **vertex shader por proximidad a
  `uMouse`** (campo de fuerza GPU) → **sin raycast**, costo CPU ~nulo, miles de puntos
  reaccionando. El form **no se toca** y conserva focus/click.
- **Sutileza obligatoria:** la reacción es casi subliminal (nivel Stripe/Linear). El
  protagonista es el formulario; el fondo acompaña, nunca le roba foco.
- **Dirección con sentido:** la reacción apunta al cursor / al formulario; nunca un efecto
  omnidireccional de fuegos artificiales.

## Color y tokens (design-system-guardian — guardrails duros)

- **Base = navy del sistema**, no azul saturado: `--bg-sunken (#0b1120)` sobre
  `--bg-core (#0f172a)`. Ese es el "navy muy oscuro" de la referencia, pero del sistema.
- **Red/partículas en reposo = NEUTRO** (plata/humo, baja opacidad): `border-strong`
  (`rgba(248,250,252,0.16)`) o gris de grilla (`rgba(148,163,184,0.05)`). En reposo la
  malla **no es azul**.
- **Azul = solo pulso / luz viajera / inclinación activa**, aditivo y **localizado**:
  `--brand-electric (#2563eb)`. Respeta el **90/10** (el azul es el ~10%, no el campo).
- **Glow disciplinado:** wash ambiental ≤ **6–8%**; halo intenso **solo** en la cresta/zona
  reactiva; si hay Bloom, parámetros del motor existente (`intensity 0.4 / threshold 0.45`).
  **Prohibido** cualquier capa azul a opacidad fija >0.12 cubriendo el viewport.
- **CYAN reservado al éxito del envío** (HECHO). **No** aparece distribuido en la red. El
  submit del form "enciende" el cyan por primera vez → refuerza el lenguaje en vez de
  gastarlo. (Cyan puntual como único nodo-destino es opcional; ante la duda, no usarlo.)
- **Violeta `--accent-ai`** opcional como halo de profundidad a baja opacidad (riqueza),
  nunca como fill.

## Legibilidad del formulario (crítico, WCAG AA)

- **El form va sobre una superficie OPACA del sistema** (`surface-1 #111c33` / `surface-2`
  + `surface-glass`), **aislado** del campo vivo. El fondo vivo respira **alrededor y
  detrás del contenedor**, nunca debajo del texto/inputs.
- **El glow nunca pasa por la columna del formulario** (igual que Casos converge fuera del
  texto). El centro/zona del form = zona calma.
- **Inputs con cuerpo** (no translúcidos lavables por el glow); labels en `foreground` /
  `smoke-2`; **foco visible** garantizado (el ring electric debe verse contra la superficie
  opaca, no contra el azul del fondo).
- **AA medido contra el peor caso** (zona reactiva a máxima intensidad), no solo contra el
  navy en reposo. Verificar también sobre el `<Poster>` (reduced-motion).

## Qué se conserva (del WEB-013C, intacto)

- Layout: card a ancho de sección, grid asimétrico `lg:grid-cols-[28rem_1fr]` (rail
  izquierdo + form protagonista), stack en mobile.
- Copy/microcopy: `finalCta.title/subtitle`, email del rail, privacidad en el rail.
- Estados del form, success state cyan (= HECHO), y **toda la lógica server-side** (server
  action + Zod + Supabase + `project_type`). **El cambio es 100% del fondo.**

## Qué se reemplaza / qué NO se toma

- **Reemplaza** `<SceneAtmosphere />` por el nuevo campo vivo interactivo.
- **NO** grilla en perspectiva · **NO** aristas nodo-a-nodo · **NO** puntos-estrella
  brillantes · **NO** "malla tipo ola" en esquinas · **NO** azul saturado como campo · **NO**
  cyan decorativo en la red · **NO** raycast de nodos · **NO** tocar el formulario ni su
  lógica · **NO** nuevos tokens fuera de `globals.css`.

## Decisión asset-first / code-first

**code-first.** Campo generativo (no asset estático). Implementación: **componente hermano**
del `<LivingBackground>` (no un nuevo `variant` dentro de la máquina de la luz continua
Casos→Proceso, para no ensuciar el `journeyStore`), reutilizando el motor (`CanvasBoundary`,
`useMediaQuery`, patrón `frameloop`+`useInView`, `Poster`, dpr capado, gate de fallback
mobile estilo `arcFallbackOnly`). Anti-loop: **máx. 2 iteraciones** de código; en la 3ª se
vuelve a este lock.

## Simplificaciones técnicas fijadas (motion-3d-engineer)

- Nodos glow = **subset del mismo campo de puntos** (no un sistema aparte).
- Grilla (si se conserva un dejo) → **CSS/SVG** (`sys-canvas-grid`), no canvas.
- 3 sistemas GPU máximo (Points + trazos + ¿una sola ola muy sutil?), no 5 capas literales.

## Mobile / reduced-motion

- **Mobile (sin hover):** deriva autónoma suave (Lissajous lento) — el campo respira solo;
  conteo de puntos reducido, sin Bloom. Si no entra en presupuesto en gama baja → **Poster**.
- **reduced-motion → Poster** estático (gradiente navy + puntos tenues), sin Canvas ni loop;
  el form debe leerse perfecto sobre el Poster.

## Criterios binarios de aprobación

- [ ] Contacto tiene **campo vivo propio interactivo** (componente hermano de
      `LivingBackground`, lazy `ssr:false`, pausa fuera de viewport, reduced-motion → Poster),
      **distinto** del arco/conducto/campo-de-señales.
- [ ] La interacción es **gravitacional/orientadora** (el campo se inclina/aclara hacia el
      cursor), **sutil**, vía **uniform GPU sin raycast**; el **formulario sigue 100%
      clickeable** (canvas `pointer-events:none`, listener en window).
- [ ] **Reposo neutro** (plata/humo); **azul solo como pulso localizado**; **90/10** respetado;
      **cyan solo en el success del envío**, no en la red.
- [ ] **Legibilidad AA del form** garantizada: superficie opaca aislada, glow fuera de la
      columna del form, foco visible, inputs con cuerpo. Medido en el peor caso y en Poster.
- [ ] **CLS 0** · **Lighthouse ~90+ mobile** · sin errores de consola WebGL/R3F · LCP no
      bloqueado (el form es el contenido, vive sin el 3D).
- [ ] **Cose** con Nosotros (arriba) y el Footer (abajo); se siente cierre del sistema, no una
      sección genérica pegada; **no pesa más que el Hero**.
- [ ] Mobile: deriva autónoma o Poster; sin jank ni sobrecalentar.
- [ ] No se tocó el formulario, su copy, sus estados ni su lógica server-side.

## Riesgos

- **Caer en el cliché** (constelación/plexus/partículas-stock): se evita con reposo neutro,
  densidad baja, modelo gravitacional (no nodos que titilan) y concepto ("el sistema te
  registra"), no decoración.
- **Quemar el cyan:** cyan fuera de la red, reservado al HECHO del submit.
- **Legibilidad del form:** superficie opaca + glow fuera de la columna (no negociable).
- **Perf por overdraw additive** (puntos + trazos + glow): bloom desktop-only, conteo
  moderado, mobile reducido/Poster. Medir en gama media.
- **Dos+ campos 3D en scroll** (Proceso arriba, Contacto): cada uno lazy + pausado fuera de
  viewport.

## Owner approval

Estado: **approved** — Matias / SYNTRA CORE (owner), 2026-06-26. Pipeline:
implementación (`motion-3d-engineer`) → QA → visual gate (`visual-quality-director`) →
OK del owner en navegador → commit del código.
