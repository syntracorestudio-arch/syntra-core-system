# SYNTRA Creative Library — Inspiration Sources

> Catálogo **consultivo** de fuentes visuales externas para alimentar a Claude
> Code en SYNTRA y futuros proyectos. No es autoridad: es un banco de ideas
> curado para romper la repetición de fórmula visual.

## Reglas de autoridad (leer primero)

```text
Las fuentes externas son consultivas.
No pueden contradecir el design system de SYNTRA.
No pueden contradecir al Visual Quality Director.
No pueden contradecir al Design System Guardian.
No pueden contradecir las skills SYNTRA (syntra-premium-section-design,
  syntra-premium-motion-system, syntra-visual-gate, syntra-safe-commit-gate).
No autorizan instalación automática de dependencias.
No autorizan copiar componentes sin adaptación.
```

Ante cualquier conflicto entre una fuente y lo normativo SYNTRA, **manda SYNTRA**.
Toda pieza tomada de acá se **reconstruye con tokens propios** (cyan = resultado/HECHO,
electric = marca/acción; Sora/Inter; spacing del sistema), nunca se pega tal cual.

**Stack base (define qué es "sin deps nuevas"):** Next.js 16 · React 19 · Tailwind v4 ·
**framer-motion ya instalado** · shadcn/Radix presente. Three.js / WebGL / GSAP / Spline
= **deps nuevas** → aprobación explícita por pieza.

Relacionado: la auditoría específica del reset vive en
`docs/visual-reset/notes/inspiration-sources.md` (este catálogo la generaliza).

---

## Aceternity UI

### Link
https://ui.aceternity.com/components

### Qué aporta
Componentes React/Tailwind/Framer Motion con foco en profundidad y scroll: 3D Card
Effect, Container Scroll, Macbook Scroll, Hero Parallax. También mucho fondo
decorativo (auroras, beams, vortex, meteoros, globos 3D).

### Patrones útiles para SYNTRA
3D Card (tilt sobrio en perspectiva para escenas flotantes), Container/Macbook Scroll
(revelar el producto "emergiendo" al entrar en viewport, con función).

### Patrones útiles para futuros clientes
Hero Parallax para portfolios/landings de producto; sticky scroll reveals para
páginas de feature largas.

### Riesgos visuales
La mitad del catálogo es fondo cliché (aurora/beams/sparkles) — exactamente lo que
SYNTRA evita. Fácil caer en "efecto-por-efecto".

### Riesgos técnicos/performance
Lo recomendado = framer-motion (ya). Globe/3D = Three.js (pesado). Scroll mal
calibrado roza el scroll-jacking.

### Requiere dependencia
No para lo recomendado (framer-motion ya presente). Sí para globos 3D.

### Cuándo usar
Para sumar profundidad/escala de producto y reveals con propósito.

### Cuándo evitar
Para fondos: auroras, beams, vortex, meteoros, globos.

### Nivel de recomendación
**Media** (selectiva: sí profundidad/scroll, no fondos).

---

## Magic UI

### Link
https://magicui.design/

### Qué aporta
Device Mockups (Safari/iPhone/Android), Animated List, Animated Beam, Marquee, Bento
Grid, Terminal, Border Beam, Magic Card. Mayormente SVG/CSS + framer-motion.

### Patrones útiles para SYNTRA
**Device Mockups** (frame real para "la web que entregás" / "cómo le llega la consulta"),
**Animated List** (consultas/leads entrando en vivo), **Animated Beam** (conexión *con
significado* entre piezas → "cuando todo se conecta"), **Bento** (ordenar escenas sin
cards iguales).

### Patrones útiles para futuros clientes
Marquee de logos/clientes, Bento de features, Terminal para productos dev-tool,
device mockups para apps.

### Riesgos visuales
Sus grid patterns (animated/retro/flickering/dot/hexagon) y particles/aurora son el
cliché a evitar. Border/Shine al borde de lo decorativo.

### Riesgos técnicos/performance
Device mockups y listas = livianos. Particles/canvas = costo de pintura.

### Requiere dependencia
No (framer-motion + cn ya presentes) para lo recomendado.

### Cuándo usar
Escenas de producto reales, listas vivas, conexión con significado.

### Cuándo evitar
Para fondos de grid/partículas/aurora.

### Nivel de recomendación
**Alta** (mejor fuente para Floating Product Scenes; fuente núcleo).

---

## Animate UI

### Link
https://animate-ui.com/docs/components

### Qué aporta
Microinteracciones y primitivas de motion sobre Radix/Base/Headless: Notification List,
Flip Card, Motion Carousel, Pin List, Cursor, Copy Button, Tabs animados. Más fondos de
partículas (Bubble, Fireworks, Stars, Hole).

### Patrones útiles para SYNTRA
**Notification List** ("Nueva consulta · WhatsApp" / "Seguimiento enviado" como stack
vivo), microinteracciones sobrias (Copy, hover), Flip Card para antes/después.

### Patrones útiles para futuros clientes
Toasts/notificaciones de producto, microinteracciones de detalle, carouseles de
testimonios.

### Riesgos visuales
Sus backgrounds de partículas son tentación de "vida fácil" pero genérica.

### Riesgos técnicos/performance
Componibles sobre Radix (ya en shadcn) + motion (ya). Livianos.

### Requiere dependencia
No (framer-motion/motion + Radix ya presentes) para lo recomendado.

### Cuándo usar
Para microinteracciones premium y feeds de notificación con significado.

### Cuándo evitar
Para los backgrounds de partículas.

### Nivel de recomendación
**Alta** (fuente núcleo de microinteracciones).

---

## 21st.dev

### Link
https://21st.dev/ · https://21st.dev/community/components/s/background

### Qué aporta
Registro **comunitario** estilo shadcn, catálogo grande (Heroes 73, Features 36,
Backgrounds 33, Buttons 130, Cards 79, AI Chat, CTA, Pricing…).

### Patrones útiles para SYNTRA
Banco de **ideas de composición** (AI Chat scenes, Hero/Feature blocks) para inspirar
layouts más variados — no para pegar.

### Patrones útiles para futuros clientes
Arranque rápido de secciones de marketing variadas cuando el cliente no exige
identidad propia.

### Riesgos visuales
**Calidad inconsistente** (comunitario) → alto riesgo Frankenstein si se mezcla.

### Riesgos técnicos/performance
Dependencias variables e impredecibles por componente; sin garantía de coherencia.

### Requiere dependencia
Variable por bloque (impredecible).

### Cuándo usar
Como inspiración de layout, reconstruyendo con tokens SYNTRA.

### Cuándo evitar
Para copiar bloques enteros a producción sin vetar.

### Nivel de recomendación
**Baja / Solo consultiva** (ideas, no código directo).

---

## Spline

### Link
https://spline.design/

### Qué aporta
Escenas 3D interactivas con integración React (`@splinetool/react-spline`).

### Patrones útiles para SYNTRA
Una **única pieza-firma 3D** del Hero (objeto de producto flotando real) — alto
potencial de asombro y diferenciación.

### Patrones útiles para futuros clientes
Productos físicos, configuradores, marcas que justifican 3D como protagonista.

### Riesgos visuales
Sin servir al mensaje, es "3D pesado sin función".

### Riesgos técnicos/performance
Deps nuevas + runtime ~MB + assets → riesgo real a **Lighthouse +95**, LCP/CLS, mobile.
Requiere construir la escena en el editor Spline.

### Requiere dependencia
**Sí** (`@splinetool/react-spline`, `@splinetool/runtime`) — pesadas.

### Cuándo usar
Solo si una pieza-firma concreta lo justifica; lazy-load fuera del fold, con aprobación.

### Cuándo evitar
Como fondo general, decorativo o múltiple.

### Nivel de recomendación
**Baja / diferida** (evaluar caso a caso).

---

## lightswind

### Link
https://lightswind.com/versions/backgrounds

### Qué aporta
Fondos animados con WebGL/GSAP/Three.js, gradientes animados, 3D, scroll/parallax.

### Patrones útiles para SYNTRA
Casi nada directo: a lo sumo **un** concepto de gradiente sutil como referencia
estética, reconstruido con CSS propio.

### Patrones útiles para futuros clientes
Landings muy "wow visual" donde el fondo ES el producto (casos puntuales).

### Riesgos visuales
Casi todo es fondo decorativo (efecto-por-efecto), el opuesto del criterio SYNTRA.

### Riesgos técnicos/performance
**Deps pesadas nuevas** (WebGL/GSAP/Three) + costo de performance; premium tras paywall.

### Requiere dependencia
**Sí** (WebGL/GSAP/Three).

### Cuándo usar
Prácticamente nunca en SYNTRA; referencia estética puntual a lo sumo.

### Cuándo evitar
Como librería de fondos en producción.

### Nivel de recomendación
**Baja / evitar** como librería.

---

## UI UX Pro Max (skill)

### Link
https://ui-ux-pro-max-skill.nextlevelbuilder.io/

### Qué aporta
"Design Intelligence for Claude Code": recurso **consultivo** de guía UI/UX
(heurísticas, patrones, criterios), no una librería de componentes con código.

### Patrones útiles para SYNTRA
Checklists de jerarquía, espaciado, accesibilidad y heurísticas de conversión para
contrastar decisiones — siempre por debajo de lo normativo SYNTRA.

### Patrones útiles para futuros clientes
Guía rápida de buenas prácticas UX en proyectos sin design system propio.

### Riesgos visuales
Genérico si se sigue al pie de la letra; puede empujar hacia lo "template".

### Riesgos técnicos/performance
Ninguno (no entrega código ni deps).

### Requiere dependencia
No.

### Cuándo usar
Como segunda opinión de UX/heurística, nunca como autoridad.

### Cuándo evitar
Cuando contradiga al design system, al VQD, al DSG o a las skills SYNTRA.

### Nivel de recomendación
**Solo consultiva** (subordinada a SYNTRA; ver SKILLS-002).
