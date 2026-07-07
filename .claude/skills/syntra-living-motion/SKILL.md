---
name: syntra-living-motion
description: Use when IMPLEMENTING living-web motion on the SYNTRA site — three.js/React Three Fiber 3D backgrounds and signature scenes, the shared <LivingBackground> system, scroll-linked animation, per-section living backgrounds, lazy/perf-safe 3D, mobile fallback, reduced-motion. The how-to companion to docs/creative-library/living-web-doctrine.md. Pairs with syntra-visual-gate (commit) and syntra-reference-lock (concept).
---

# SYNTRA Living Motion (implementación)

**Skill de implementación** de la web viva. Es el "cómo" práctico de
`docs/creative-library/living-web-doctrine.md` (el "qué/por qué"). No afloja el gate:
el trabajo visual sigue siendo Cat B/C → reference-lock con **objetivo visual concreto**
+ visual gate + OK del owner antes del commit. Convive con `syntra-premium-motion-system`
(base purpose-first + tokens + reduced-motion + CLS 0).

## 1. Norte técnico (no negociable)

```text
R3F LAZY        → dynamic(() => import(...), { ssr:false }); el 3D nunca bloquea LCP/SSR
DEMAND/PAUSE    → frameloop="demand" o pausa por IntersectionObserver fuera de viewport
UN SISTEMA      → <LivingBackground> reutilizable, parametrizado por sección (no N escenas)
LIVIANO         → geometría low-poly / shaders (maath); sin texturas pesadas; instancing
MOBILE          → calidad reducida o fallback estático (matchMedia / capability)
REDUCED-MOTION  → frame final estático, sin animación ni loop
CLS 0           → alto reservado; el 3D es fondo/acento; jamás empuja layout
TOKENS          → colores/curvas desde globals.css + lib/motion.ts (paleta libre, design-freedom-v2)
```

## 2. Patrón de fondo 3D lazy (canónico)

```tsx
// el host es Server Component; el 3D entra solo en cliente y solo cuando se necesita.
const LivingBackground = dynamic(
  () => import("@/components/marketing/living/living-background").then(m => m.LivingBackground),
  { ssr: false, loading: () => null } // sin spinner; el contenido vive sin el 3D
);
```

- El contenedor padre **reserva el alto** (CSS), nunca el `<Canvas>`.
- El fondo es **decorado de soporte**: la sección debe leerse y convertir **sin** el 3D
  (progressive enhancement). Si el WebGL falla o no carga, no se pierde mensaje.

## 3. Pausar fuera de viewport (perf + batería)

```tsx
// dentro del componente del Canvas
const inView = useInView(ref, { margin: "200px" });   // framer-motion
<Canvas frameloop={inView ? "always" : "demand"} dpr={[1, 2]} gl={{ antialias: true, powerPreference: "high-performance" }}>
```

- `dpr={[1, 2]}` capa el devicePixelRatio (no rendereá a 3x en mobile retina).
- Nunca un `useFrame` que corra con la pestaña/canvas fuera de vista.

## 4. reduced-motion + fallback mobile

```tsx
const reduce = useReducedMotion();
const isMobile = useMediaQuery("(max-width: 768px)"); // o capability check
if (reduce) return <StaticPoster />;                  // frame final, cero animación
// en mobile: menos partículas/segmentos, dpr=[1,1.5], o también <StaticPoster />
```

- `StaticPoster` = imagen/gradiente que representa el estado final de la escena.
- Toda escena 3D debe tener su poster estático equivalente.

## 5. Animación ligada al scroll

```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
const y = useTransform(scrollYProgress, [0, 1], [0, -80]);   // parallax CONTROLADO
// aplicar a transform/opacity (GPU-friendly). Nunca animar width/height/top/left.
```

- **Scroll-LINKED sí; scroll-HIJACK no.** El usuario nunca pierde el control del scroll.
- Parallax sutil y con jerarquía; no mareante. Reveals con `whileInView` + `once: true`
  o `IntersectionObserver`.
- Tokens de timing desde `lib/motion.ts` (`EASE_PREMIUM`, `DURATION`).

## 6. Contrato de `<LivingBackground>`

```tsx
type LivingBackgroundProps = {
  variant: "servicios" | "casos" | "proceso" | "sistema" | "nosotros" | "faq" | "cta";
  intensity?: "ambient" | "signature";   // fondo sutil vs pieza protagonista
  className?: string;
};
```

- **Un componente, variantes por sección** (color de rol + densidad + movimiento).
- Cada sección tiene un campo **distinto** (se acabó el azul uniforme), pero del **mismo
  sistema** (coherencia). Variante = parámetros, no un archivo nuevo por sección.

## 7. Color y rol (coherencia)

- Acentos de rol desde tokens: Web = electric · Automatización = `accent-ai` (violeta) ·
  IA = `accent-secondary` (cyan) + `accent-warm` (ámbar). Base slate; **paleta libre con criterio de marca** (design-freedom-v2 §1).
- En los componentes de sistema (PENDIENTE→ACTIVO→HECHO), cyan conserva su semántica de resultado.

## 8. Checklist de cierre (antes del visual gate)

```text
[ ] tsc --noEmit · lint · build verdes
[ ] visual:shots en 6 breakpoints (360/390/768/1024/1440/1920)
[ ] Lighthouse mobile ~90+ · CLS 0 · LCP no degradado (3D lazy)
[ ] reduced-motion → poster estático correcto
[ ] mobile → calidad reducida/fallback, sin jank ni sobrecalentar
[ ] sin errores de consola (WebGL context, R3F)
[ ] familia de colores de marca respetada (design-freedom-v2 §1)
[ ] la sección funciona y convierte SIN el 3D (progressive enhancement)
```

## Precedencia

Normativa para la implementación de la web viva en SYNTRA. Subordinada a
`living-web-doctrine.md`, `ROLE-AUTHORITY-MAP.md`, `CLAUDE.md`, el Design System Guardian
y el Visual Quality Director. Las skills externas (p. ej. `ui-ux-pro-max`) son
consultivas y no pueden contradecirla.

## Referencias

- `docs/creative-library/living-web-doctrine.md` (qué/por qué — fuente de verdad)
- `docs/creative-library/motion-patterns.md` (patrones permitidos + límites)
- `projects/syntra-core-website/src/lib/motion.ts` (tokens de motion)
- three.js · @react-three/fiber (v9, React 19) · @react-three/drei (v10) · maath
