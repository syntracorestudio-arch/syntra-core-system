---
section: nosotros
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-01
decision: code-first + gate de render de prototipo (anti-rework)
---

# Reference Lock — Nosotros ("El Núcleo de Principios")

> Bajo `docs/creative-library/living-web-doctrine.md` (web viva). Concepto aprobado por el
> owner vía `syntra-premium-section-design` (2026-07-01): Dirección A. Análisis read-only por
> `creative-director` + `website-experience-auditor` + `design-system-guardian`.
> **Este lock NO autoriza código hasta `status: approved`.**

## Objetivo comercial / rol en la landing

Nosotros es el beat de **confianza/identidad** entre Proceso (método) y Contacto (cierre):
responde *"¿quiénes son estos y puedo confiarles mi negocio?"*. **Emoción objetivo:** "a esta
gente la entiendo y me da confianza" (cercanía + criterio), no admiración fría. **KPI:**
confianza en <3s + **cero caída de energía** vs las secciones vivas vecinas + llegar a
Contacto con la guardia baja.

**Diagnóstico raíz (por qué se rediseña):** el problema es de CONCEPTO, no de layout. Los 4
principios actuales resuelven el job de **método/capacidad** (ya cubierto por Servicios/
Proceso) en vez del de **identidad/carácter**; la gramática (número + ícono cyan + hairline)
**clona a Proceso**; es el único bache plano del recorrido; la frase-firma está enterrada; y
hay **drift de cyan** decorativo.

## Dirección visual elegida — A: "El Núcleo de Principios"

**Campo radial/convergente.** Un **núcleo vivo central** del que **emanan** los 4 principios
(líneas finas que se dibujan hacia afuera con el scroll). La forma dice literal el copy:
*"La forma SYNTRA de construir"* = el centro; los 4 principios = sus emanaciones. Gramática
**radial/simultánea** — deliberadamente distinta de la **vertical/secuencial** de Proceso.
El statement pasa a ser **ancla/manifiesto** (no pie de párrafo).

## Referencias concretas (≥1, no adjetivos)

**Ref-1 — Wireframe radial (target de composición, a firmar por el owner):**
```
NOSOTROS · El Núcleo de Principios

                 [ 01 · principio ]
                        \
   [ 04 · principio ] — ( NÚCLEO SC ) — [ 02 · principio ]
                        /       \
                 [ 03 · principio ]

  arriba: statement/manifiesto centrado ("La forma SYNTRA de construir" = ancla)
  las 4 líneas se DIBUJAN del centro hacia cada principio al scroll (GSAP)
  mobile: núcleo arriba → 4 principios en columna, línea baja del núcleo a c/u
```

**Ref-2 — Núcleo SC live (material/tratamiento):** `contacto-core.tsx` (el núcleo de Contacto)
como referencia de **lenguaje de materia** — MISMO lenguaje de marca, **lectura DIFERENCIADA**:
en Nosotros = **identidad estable/sólida** (el centro del que todo emana); en Contacto =
energía/invitación reactiva. Capturable con el loop visual on-demand.

**Ref-3 — Anti-referencia (qué NO ser):** `workflow-section.tsx` (Proceso "La Línea Viva",
vertical/secuencial) y el estado ACTUAL de Nosotros (feature-list). Nosotros NO puede leerse
como ninguno de los dos.

## Qué se toma / qué se transforma / qué se reemplaza

- **Sobrevive (sustancia):** el statement (eyebrow + título + subtítulo + "La forma SYNTRA de
  construir") — es la tesis; el copy no se toca acá.
- **Sobrevive pero se transforma:** los 4 conceptos de principios — dejan de ser feature-list;
  pasan a ser las emanaciones radiales del núcleo.
- **Se reemplaza:** el layout 2-columnas sticky + divisor vertical + hairline-por-ítem; el
  **cyan decorativo** (íconos/números); los **íconos cliché** (Sparkles/Gem/ShieldCheck/LifeBuoy);
  la frase-firma como pie → pasa a ancla.

## Contenido (marcado, autoridad de otro rol)

Eje de los 4 principios a **girar** de *"qué entregamos"* (IA/premium/seguridad/soporte, que
pisan Servicios/Proceso) → *"quiénes somos / qué defendemos"* (postura · criterio · cercanía ·
honestidad). Es cambio de **copy** → autoridad **Product Strategist / copy-system**, NO se
decide en este lock. Además: condensar cada descripción a ~1 línea afilada para el tratamiento
radial. **Marcado como dependencia**: el lock puede aprobarse visualmente, pero el copy final
de los principios se define con el Product Strategist antes del prototipo.

## Núcleo SC — diferenciación de Contacto (decisión del owner)

Mismo lenguaje de marca, **tratamiento distinto**: Nosotros = **identidad estable** (núcleo
sólido, centro de gravedad, deriva mínima); Contacto = energía/invitación (reacción al mouse).
NUNCA idénticos 1:1. La reacción al mouse fuerte queda para Contacto; acá el núcleo es reposo.

## Signature Palette Exception

**¿Aplica?** NO. Nosotros es sección común → paleta estándar **90/10**. Guardrails (DSG):
- Base neutra (`bg-depth-raised` + `surface-*` + hairlines `border-*`); jerarquía por
  tipografía + `smoke-2`/`muted-foreground`, no por color.
- **Cero cyan decorativo** (quitar el drift actual). Cyan solo si un elemento representa
  HECHO/resultado real (por default, no se usa acá).
- Acento diferenciador (si hace falta): **`accent-warm`** (humano/confianza) como **halo/filo a
  baja opacidad**, nunca fill ni texto de alto contraste. **Electric** solo en interactivos
  reales (CTA/link).
- Referencia: `docs/creative-library/signature-palette-exception.md`.

## Decisión asset-first / code-first

**code-first + GATE DE RENDER DE PROTOTIPO.** No hay herramienta de mockup (Figma descartado),
pero el protagonista (núcleo + composición radial) es **generativo** (SVG/Canvas-lite/CSS), no
un asset estático → como Casos/Proceso, se construye en código. **Anti-rework:** antes de
invertir en motion, se arma un **prototipo ESTÁTICO** de la composición radial, se **captura con
el loop visual** (Playwright/section shots, 1440 + 390) y **el owner aprueba ese render** como
target visual firmado. Recién con el render aprobado se agrega el motion (GSAP) y se pasa al
visual gate. **Máx. 2 iteraciones** de código; en la 3ª se vuelve a este lock.

**¿Protagonista visual principal?** sí (núcleo + composición radial).

## Norte técnico (perf, no negociable)

- Disciplina de perf de B: resolver núcleo + líneas con **SVG animado / Canvas-lite** antes que
  R3F pesado; **3D real solo si el núcleo lo justifica** + fallback mobile.
- **CLS 0** (composición en capa detrás/absoluta donde aplique; no animar dimensiones del grid).
- **Lighthouse ~90+ mobile**; sin errores de consola.
- **reduced-motion → frame final estático** (núcleo quieto, líneas ya dibujadas).
- **Scrim/máscara de luminancia** si entra fondo vivo → AA sobre TODO el texto (peor caso).
- Motion pausado fuera de viewport. GSAP/Lenis permitidos (Fase 2), con propósito.

## Criterios binarios de aprobación

- [ ] Gramática **radial/convergente** (el centro irradia), **distinta** de la vertical de Proceso.
- [ ] El **statement es ancla/manifiesto** (no pie de párrafo).
- [ ] Los 4 principios **NO** se leen como feature-list (4 ítems iguales con ícono).
- [ ] **Cero cyan decorativo**; acentos neutros/`accent-warm` halo; electric solo interactivo.
- [ ] **Motion con propósito** (emana del centro / refuerza el copy), no wow vacío ni clon de
      Proceso; reduced-motion → frame final.
- [ ] **CLS 0** · **Lighthouse ~90+ mobile** · sin errores de consola · scrim si hay fondo vivo (AA).
- [ ] Comunica **identidad/carácter** (diferenciada de Servicios/Proceso).
- [ ] **Honestidad intacta:** sin clientes/métricas/testimonios inventados.
- [ ] Mobile: colapso claro (núcleo arriba + principios en columna), sin aire muerto.
- [ ] Núcleo **diferenciado** del de Contacto (identidad estable ≠ energía/invitación).

## Riesgos

- **Nodos abstractos universales** (§5): se blinda con centro único + exactamente 4 emanaciones
  con texto real; jamás grafo de puntos random.
- **Clon de Proceso:** prohibido motion vertical-secuencial + números-íconos; gramática radial.
- **Feature-list maquillada:** el rediseño debe cambiar el patrón cognitivo, no solo el estilo.
- **3D sin concepto / perf mobile:** priorizar SVG/Canvas-lite; 3D solo justificado + fallback.
- **Dependencia de copy:** el eje de los principios (Product Strategist) impacta la composición
  → resolver antes del prototipo.

## Owner approval

Estado: **approved** — Matias / SYNTRA CORE (owner), 2026-07-01. Pipeline: definir copy de los
4 principios (Product Strategist) → **prototipo estático** → captura con loop visual → **OK del
owner al render** → motion (GSAP) → `syntra-visual-gate` → commit.
