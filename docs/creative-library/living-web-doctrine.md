# SYNTRA Living Web Doctrine

> **Pivot de dirección aprobado por el owner — 2026-06-23.** Documento-norte de la
> nueva metodología visual de la web SYNTRA. **Supersede** las líneas que lo
> contradigan en `motion-patterns.md`, `do-not-use.md`, la skill
> `syntra-premium-motion-system`, y las secciones *Motion Rules* / *Calidad* de
> `CLAUDE.md`. Ante conflicto sobre motion/3D/fondos/scroll, **manda este documento.**

---

## 1. Por qué este pivot

La doctrina anterior ("premium con restricción": sin 3D, motion mínimo, solo
`opacity/transform`, fondos sobrios) cumplió su objetivo —matar lo genérico— pero dejó
la web **plana**: fondos casi iguales (campo azul) en todas las secciones, poco
movimiento, sin escena protagonista viva. El owner decide pivotear, de forma consciente
y documentada (no override silencioso), a una **web viva**: con vida visual, profundidad,
3D real y narrativa de scroll, **manteniendo el estándar premium y un techo de
performance**.

Este pivot **no** reabre los anti-patrones genéricos (SaaS template, crypto/gamer,
glass excesivo, nodos abstractos universales). Cambia **qué es aprobable** en motion, 3D
y fondos; **no** afloja la exigencia de calidad ni el gate visual.

## 2. Decisiones bloqueadas (owner, 2026-06-23)

| Eje | Decisión |
| --- | --- |
| **Dirección** | **Pivot oficial de doctrina** a "web viva". Esta doctrina es la norma. |
| **Performance** | **Riqueza con techo de perf.** Máxima vida visual con técnicas GPU-baratas + lazy; objetivo **Lighthouse ~90+ mobile** (antes +95 duro), **CLS 0 sigue duro**. |
| **Técnica** | **3D real**: `three` + `@react-three/fiber` + `@react-three/drei` (deps gated — instalar solo con OK del owner). |
| **Rollout** | **Piloto en 1 sección primero** = **Servicios**. Se fija como sistema de referencia y recién después se replica. |

## 3. Norte técnico — cómo conviven "3D real" y "techo de perf"

No negociable. Todo trabajo de 3D/fondo vivo cumple:

```text
- R3F LAZY: dynamic(() => …, { ssr: false }). El 3D NUNCA bloquea LCP/SSR.
- frameloop="demand" o pausa por IntersectionObserver → no renderiza fuera del viewport.
- Un SISTEMA 3D-firma reutilizable, parametrizado por sección. No N escenas pesadas distintas.
- Geometría liviana / shaders; sin texturas pesadas; instancing donde aplique.
- Mobile = calidad reducida o fallback estático (detección de capacidad / matchMedia).
- prefers-reduced-motion → frame final estático, sin animación ni loop.
- CLS 0 SIEMPRE: el 3D es fondo/acento, alto reservado, jamás empuja layout.
- Presupuesto de bundle: cada dep/efecto se justifica; medir antes/después con visual:shots + Lighthouse.
```

Si una pieza 3D no puede cumplir esto, se reemplaza por la variante liviana
(CSS/Canvas2D/SVG/shader-lite), no se baja la vara de perf.

## 4. Qué AHORA está permitido (antes vetado)

- **Fondos a pantalla completa con Canvas/WebGL** (lazy, pausados fuera de viewport).
- **Fondo distinto y vivo por sección** — de hecho **obligatorio**: dos secciones
  contiguas con el mismo fondo sigue siendo anti-patrón, pero ahora la solución es un
  *campo vivo* por sección, no solo un cambio de color.
- **Animación ligada al scroll** (scroll-linked / scroll-driven): reveals por progreso,
  parallax **controlado**, capas a profundidad. Permitido `transform`/`opacity` y
  propiedades GPU-friendly; preferir `IntersectionObserver` / `useScroll` de Framer /
  `ScrollTimeline` donde el soporte lo permita.
- **3D real** como escena-firma o fondo de profundidad (bajo el norte técnico §3).
- **Más de un acento de motion por viewport** si componen una sola escena coherente
  (se levanta el "1 motion-firma por viewport" estricto; el criterio pasa a ser
  *coherencia* y *jerarquía*, no *cantidad*).
- **Glow/aurora/derivas** con intención de profundidad (no "efecto por efecto").
- **Animar propiedades GPU-friendly** más allá de `opacity/transform` cuando no rompan
  CLS ni perf (`filter` puntual, gradientes animados vía shader/transform). Evitar
  animar `width/height/top/left` (layout) — eso sí sigue prohibido.

## 5. Qué SIGUE prohibido (el pivot no es barra libre)

```text
- 3D/partículas/efecto SIN concepto ni función ("wow vacío", decorar por decorar).
- Texturas/modelos pesados que rompan el techo de perf o el LCP.
- Scroll-jacking que secuestre el control del usuario (scroll-LINKED sí; HIJACK no).
- Clichés genéricos: SaaS template, crypto/gamer, dashboard de relleno, glass excesivo,
  nodos abstractos como solución universal, browser-mockup repetido, stock genérico.
- Animar layout (width/height/top/left) o cualquier cosa que rompa CLS 0.
- Loops perpetuos que no pausan fuera de viewport.
- Romper reduced-motion (siempre frame final estático).
- Sumar una dep pesada por un solo efecto trivial que se resuelve liviano.
```

## 6. Gobernanza — el gate NO se afloja

El pivot cambia **el estándar de lo aprobable**, no el proceso de aprobación:

- El trabajo visual sigue siendo **Cat B/C → modo Checkpoint**: **reference-lock
  aprobado** antes del código + **visual gate + OK del owner** antes del commit.
- **Nuevo requisito anti-rework:** el reference-lock de cada sección debe incluir un
  **objetivo visual concreto** (imagen/video/prototipo de referencia que el owner firma)
  **antes** de escribir código. No se aprueban "direcciones" en prosa: se aprueba un
  target visible. Esto ataca la causa raíz del retrabajo (Servicios se rehízo 4 veces por
  aprobar texto en vez de un target).
- `visual-quality-director`, `creative-director`, `design-system-guardian` y
  `website-experience-auditor` **evalúan contra esta doctrina**: aprueban la vida visual
  premium y bloquean lo genérico/roto/pesado — ya **no** bloquean 3D/scroll-motion por
  el solo hecho de serlo.
- **Tokens y sistema mandan:** la vida visual usa los tokens de marca (`globals.css`,
  `lib/motion.ts`); el 3D no es excusa para salirse del design system.

## 7. Freeze: levantamientos puntuales

Para habilitar el rollout de la web viva, se **levantan** (solo para trabajo bajo esta
doctrina + gate visual):

- **Sistema** (`solution-architecture-section.tsx`) — FROZEN → **descongelado** para
  rediseño vivo.
- **Nosotros** (`about-section.tsx`) — FROZEN → **descongelado** para rediseño vivo.

Sigue **fuera de scope** por decisión del owner: **Header/Navbar y Hero** (no se tocan
en este pivot). El Hero permanece FROZEN como composición.

## 8. Pipeline de la web viva (orden operativo)

```text
Fase 1 · Doctrina (este doc + flips en motion-patterns/do-not-use/skill/CLAUDE.md)   ← governance, Autopilot
Fase 2 · Capacidad: deps three/R3F (gated) + agente motion-3d-engineer + skill living-motion
Fase 3 · Motor de fondo vivo compartido (<LivingBackground>) + primitiva scroll-motion
Fase 4 · PILOTO: Servicios end-to-end (reference-lock con target visual → código → QA → visual gate → OK → commit)
Fase 5 · Rollout al resto (Casos, Proceso, Sistema, Nosotros, FAQ, CTA, Footer, transiciones) reusando el sistema aprobado
```

## 9. Criterios de éxito de la doctrina

- La web se siente **viva, con profundidad y movimiento con intención**, no plana.
- **Cada sección tiene su propio campo visual** (se acabó el azul uniforme).
- Sigue **premium y no genérica** (cero SaaS template / glass excesivo / crypto-gamer).
- **Lighthouse ~90+ mobile, CLS 0, reduced-motion safe** — sin excepciones.
- Sin loop de rework: cada sección parte de un **target visual aprobado** antes del código.
