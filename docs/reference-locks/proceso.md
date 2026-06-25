---
section: proceso
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-06-26
decision: code-first
---

# Reference Lock — Proceso ("La Línea Viva")

> Bajo `docs/creative-library/living-web-doctrine.md` (web viva, Fase 5 de rollout).
> Concepto aprobado por el owner (Dirección A, 2026-06-26) vía `syntra-premium-section-design`.
> **Este lock NO autoriza código hasta `status: approved`.**

## Objetivo comercial / rol en la landing

Que un dueño de PyME no técnico sienta, en <3s: **"así de claro y ordenado va a ser
trabajar con ellos — y no me dejan solo al final"**. Es la sección que convierte
*"me gusta lo que hacen"* (Servicios) en *"confío en cómo lo hacen"*. Rol único en el
recorrido: la dimensión **temporal/relacional** del trabajo (del primer contacto a vivir
con el sistema). No vende producto (eso es Servicios) ni muestra rubros (eso es Casos):
muestra **el método**. KPI: construir confianza y empujar al primer paso (clic a contacto).

## Referencias aprobadas

> Trabajo **code-first generativo** (campo 3D + motion ligado al scroll): no hay un asset
> estático protagonista. Las referencias concretas que fijan el target son un wire de
> composición aprobado + la escena viva ya aprobada de Servicios (mismo motor) como
> referencia de material/calidad/perf.

**Ref-1 — Wireframe de composición (aprobado por el owner al elegir Dirección A):**

```
PROCESO · vertical, scroll-linked

  ◍ idea entra (arriba)
  │
  ●──[ 01 Entendemos ]  Diagnóstico claro ✓
  │
  ●──[ 02 Diseñamos ]   Propuesta p/ aprobar ✓
  │   (cresta de luz baja con el scroll)
  ○──[ 03 Construimos ] · · ·
  │
  ○──[ 04 Lanzamos ]    · · ·
  ◍ sistema funcionando (cyan, HECHO)

  fondo: tubo/curva 3D emisivo (LivingBackground variant)
```

**Ref-2 — Escena viva de Servicios (live, en el repo):**
`projects/syntra-core-website/src/components/marketing/living/living-background.tsx`
(arco cromado + Environment/Lightformers + Bloom + Poster + scroll parallax + dpr capado).

## Qué se toma de cada referencia

- **De Ref-1 (wire):** eje **vertical** narrativo; estaciones alternadas (zig-zag editorial);
  línea/columna central como columna vertebral; el **entregable** (`result`) promovido a
  protagonista de cada paso (no pill al pie); el número de paso como anclaje de menor peso;
  cierre con nodo final cyan (HECHO) + un CTA relacional.
- **De Ref-2 (Servicios live):** calidad de **material metálico + emisivo**, **Bloom** para el
  glow, **iluminación pareja** (Environment/Lightformers, sin hotspot que "corte"),
  **Poster** estático para reduced-motion/sin-WebGL, **CanvasBoundary** (degradar sin romper),
  **dpr capado / MSAA acotado / antialias off** (perf), patrón de **scrim de legibilidad** y
  **fundidos sup/inf** que cosen con las vecinas. Reusar el **mismo motor** `<LivingBackground>`
  parametrizado por `variant` (no una escena nueva pesada — doctrina §3).

## Qué NO se toma

- **De Ref-2:** NO la geometría del arco/torus (Proceso usa **tubo/curva vertical**,
  `TubeGeometry` sobre `CatmullRomCurve3`); NO el movimiento de tumble/yaw (Proceso usa
  **cresta de luz que viaja por el scroll**); NO la cromática tri-rol electric/violeta/cyan
  (Proceso es **90/10 más estricto**: gris/luz dominante, cyan **solo** como recompensa final).
- **Del patrón actual de Proceso:** NO el timeline horizontal de 4 columnas, NO los chips
  de 56px, NO "1 ícono lucide por paso" como chasis, NO el fondo plano, NO el badge
  PENDIENTE en miniatura, NO el "se dibuja todo de una vez al entrar en viewport".

## Dirección visual elegida

**A — "La Línea Viva".** El proceso *es* un camino: una **corriente de luz 3D vertical**
desciende por la sección y va **encendiendo cada estación** atada al progreso de scroll
(scroll-linked, sin hijack). Foco en el paso activo (PENDIENTE atenuado → ACTIVO en foco →
HECHO con check + entregable que queda). Reduced-motion / sin scroll → frame final con los
4 pasos completos. Traduce literal el título "De tu idea a un sistema funcionando".

**Contenido:** sobrevive el copy de los 4 pasos y el patrón PENDIENTE→ACTIVO→HECHO; se
**reemplaza** el chasis entero. Ajustes de copy a confirmar por el owner (abajo).

## Decisión asset-first / code-first

**code-first.** El protagonista es un campo 3D **generativo** + motion ligado al scroll, no
una imagen/render estático; igual criterio que Servicios. No hay asset que crear/aprobar
antes: el target se fija con Ref-1 (composición) + Ref-2 (material/calidad) + los criterios
binarios. Anti-loop: **máx. 2 iteraciones** de código; en la 3ª se vuelve a este lock.

## Signature Palette Exception

**¿Aplica excepción de paleta?** no

**Justificación:** la sección se mantiene bajo el 90/10 estándar. La "luz" es iluminación
neutra (blanco/electric como acento de marca) sobre base gris/oscura; **cyan reservado a
HECHO/resultado** (regla viva). No usa oro, vidrio excesivo ni acentos fuera de marca.

**Cómo se mantiene la marca SYNTRA:** tokens de `globals.css` + `lib/motion.ts`; base slate
neutra; electric como 10%; cyan solo en el cierre/HECHO.

**Cómo se protege la legibilidad:** paneles de contenido con scrim (patrón Servicios);
texto sobre fondo oscuro con contraste AA; el 3D es fondo/acento, nunca compite con el copy.

Referencia: `docs/creative-library/signature-palette-exception.md`

## Criterios binarios de aprobación

El prototipo aprueba solo si cumple **todos**:

- [ ] Tiene **campo vivo propio** (3D lazy `ssr:false` · pausa fuera de viewport · CLS 0),
      visiblemente **distinto** del de Servicios (tubo vertical vs arco; flujo vs presencia).
- [ ] **No** se lee como "4 process steps de template" (chasis horizontal/chips numerados eliminado).
- [ ] El **entregable** de cada paso tiene peso de protagonista (no pill secundaria al pie).
- [ ] El avance PENDIENTE→ACTIVO→HECHO está **ligado al scroll**, foco en el paso activo,
      **sin scroll-hijack** (el usuario nunca pierde el control).
- [ ] **reduced-motion** → frame final con los 4 pasos completos (sin loop ni animación).
- [ ] **Cose** con Hero/Servicios: capas, tokens, fundidos sup/inf; sin bajón de nivel al scrollear.
- [ ] **Cyan** solo en HECHO/resultado; 90/10 respetado (sin drift de marca).
- [ ] **Honestidad** intacta: sin métricas/clientes/logos/testimonios inventados.
- [ ] **Mobile-first**: una sola metáfora vertical desktop+mobile; calidad reducida/fallback en mobile.
- [ ] **CLS 0** (slots con alto reservado) · **Lighthouse ~90+ mobile** · sin errores de consola.
- [ ] **No duplica** selectores (Servicios/Casos) ni el flujo de conexión de Servicios; el
      CTA de cierre es **relacional** ("demos el primer paso" → `#contacto`), distinto del
      consultivo de Servicios.

## Ajustes de copy (decisión de negocio del owner, a confirmar)

- Paso 1: sumar ángulo **"primer paso sin compromiso"** *solo si es real* comercialmente.
- Paso 2: `result` "Plan a medida" → algo más concreto: **"Plan y presupuesto claro"** o
  **"Propuesta para aprobar"** (hito de decisión que el comprador reconoce).
- Pasos 3 y 4: sin cambios.
- CTA de cierre: relacional (p. ej. **"Empecemos por entender tu negocio"** → `#contacto`).

## Riesgos visuales

- **"Flowchart / nodos abstractos"** (vetado): se evita haciendo la línea **materia con luz
  y profundidad real**, no un SVG de conectores con cajas-nodo ni flechas.
- **Canibalizar Servicios:** se evita por geometría (tubo vertical vs arco), eje (vertical vs
  horizontal), verbo (flujo vs presencia) y cromática (90/10 estricto culminando en cyan).
- **Dashboard/maqueta/glass:** sin fake-charts/KPIs/badges falsos; paneles sobrios con scrim,
  sin glass excesivo.

## Riesgos técnicos / performance

- **LCP:** el 3D entra `dynamic(ssr:false)`, no bloquea LCP; el contenido vive sin el 3D
  (progressive enhancement).
- **Scroll-linked:** usar `useScroll`/`scrollYProgress` (Framer) + damping; nunca pinning que
  secuestre el scroll. Medir jank.
- **WebGL:** reusar `CanvasBoundary` (degrada a Poster) + `frameloop` pausado fuera de viewport.
- **Mobile:** calidad reducida (dpr/MSAA) o fallback estático; medir con `visual:shots` + Lighthouse.
- **CLS 0:** alto reservado para cada estación y su entregable desde el inicio.

## Owner approval

Estado: **approved** — Matias / SYNTRA CORE (owner), 2026-06-26.

Decisiones de copy confirmadas por el owner:
- Paso 1: **es sin compromiso** → reforzar el ángulo "primer paso sin compromiso".
- Paso 2: `result` "Plan a medida" → **"Propuesta para aprobar"**.
- CTA de cierre: relacional → `#contacto`.
