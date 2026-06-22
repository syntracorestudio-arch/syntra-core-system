# SYNTRA QA GOVERNANCE LAYER (v2 — consolidado)

> Gobernanza unificada de calidad de SYNTRA CORE. Esta versión **consolida en una
> sola fuente** las dos redacciones previas (prosa + markdown) sin perder reglas.
> Coherente con `CLAUDE.md`, `agents/governance/SYNTRA-CONTEXT-ROUTER.md`,
> `agents/ROLE-AUTHORITY-MAP.md` y `agents/governance/visual-quality-gate.md`.

## 1. Propósito del documento

Define la gobernanza unificada de calidad dentro de SYNTRA CORE. Su objetivo es
eliminar conflictos entre dominios de QA y establecer reglas claras de **validación,
bloqueo y escalamiento**.

## 2. Principio fundamental

La calidad no es un rol aislado. Es un **sistema de validación distribuido por dominio**
con reglas de conflicto jerárquicas.

## 3. Dominios de QA

### 🧪 3.1 Automation QA & Reliability Guard

**Dominio:** automatizaciones (workflows n8n).

**Autoridad:** validación de workflows · integración entre sistemas · seguridad
operativa de automatizaciones · estabilidad de procesos automatizados.

**Pregunta principal:** ¿la automatización es confiable y segura para producción?

**Puede bloquear:** deployment de automatizaciones · paso a producción en el Syntra
Execution Protocol.

### 🧪 3.2 Web QA & Performance Guard

**Dominio:** productos web funcionando correctamente a nivel técnico, funcional, visual
y operativo. Incluye: frontend · backend · performance · responsive · accesibilidad
básica · integración frontend/backend · UX funcional según especificación aprobada.

**Autoridad:** performance web · errores funcionales en UI · errores visuales de
implementación · correcto funcionamiento de la UX definida · estabilidad de apps web ·
validación de integración frontend/backend · detección de diferencias entre
implementación y especificación aprobada · validación responsive · accesibilidad básica.

**Pregunta principal:** ¿la web funciona como fue especificada?

**Puede bloquear:** deployment web · release en Web Delivery Pipeline · entregables con
fallas técnicas, funcionales, visuales, responsive o de performance.

**No evalúa** (eso es del Website Experience Auditor): memorabilidad · diferenciación
percibida · percepción premium · narrativa emocional · señales de template · impacto
experiencial subjetivo.

### 🎭 3.3 Website Experience Auditor

**Dominio:** experiencia percibida del producto web. Evalúa si una web que funciona
correctamente además se siente: premium · clara · memorable · diferencial · coherente ·
confiable · no genérica.

**Autoridad:** percepción premium · diferenciación · memorabilidad · narrativa visual ·
coherencia de experiencia · detección de señales de template · claridad del mensaje ·
impacto del contenido · fuerza de la propuesta percibida · calidad narrativa entre
secciones.

**Pregunta principal:** ¿la web funciona, pero se siente débil, genérica, confusa o
poco memorable?

**Puede:** aprobar experiencia · recomendar mejoras · devolver entregables a revisión
por calidad experiencial percibida · generar rollback de experiencia · marcar deuda
experiencial.

**NO puede:** bloquear deploy por fallas técnicas · bloquear producción por bugs
funcionales · reemplazar decisiones de QA técnico · reemplazar al Web QA & Performance
Guard / Creative Director / Product Experience Designer · redefinir estrategia, producto
o arquitectura.

Su bloqueo/devolución aplica **solo** sobre: experiencia percibida · diferenciación ·
memorabilidad · narrativa · percepción premium · claridad del mensaje.

👉 Opera **después** de Web QA y **antes** del cierre definitivo del proyecto.

## 4. Regla principal de separación (🚫 NO OVERLAP)

Cada dominio de QA valida una dimensión distinta de calidad y **solo opera dentro de su
dominio**; ningún QA reemplaza la autoridad de otro.

- **Automation QA** evalúa: confiable / no confiable.
- **Web QA** evalúa: funciona / no funciona.
- **Website Experience Auditor** evalúa: impacta / no impacta.

Restricción explícita: Automation QA **no** evalúa productos web; Web QA **no** evalúa
workflows de automatización.

### 4.1 Frontera entre Web QA y Website Experience Auditor

- **Web QA & Performance Guard** — foco técnico/funcional/operativo. Evalúa: errores de
  frontend/backend · bugs visuales · responsive roto · performance · accesibilidad
  básica · enlaces rotos · formularios que fallan · inconsistencias funcionales ·
  estabilidad · diferencias entre implementación y especificación aprobada. Si la web
  no funciona como fue especificada → **puede bloquear deploy**.
- **Website Experience Auditor** — foco experiencial/narrativo/perceptivo. Evalúa:
  experiencia genérica · pérdida de diferenciación · monotonía visual · señales de
  template · narrativa débil · falta de memorabilidad · percepción poco premium · copy
  genérico · secciones que no aportan valor · recorrido que funciona pero no convence.
  Si funciona pero se siente débil/genérico → **devuelve a revisión** por calidad
  experiencial percibida.

### 4.2 Ejemplos (Caso 1–6)

| # | Situación | Responsable | Motivo |
|---|---|---|---|
| 1 | El formulario no envía correctamente. | Web QA & Performance Guard | fallo funcional |
| 2 | El formulario funciona, pero el texto no genera confianza y la sección se siente genérica. | Website Experience Auditor | experiencia y conversión percibida |
| 3 | Una sección se ve rota en mobile. | Web QA & Performance Guard | fallo responsive |
| 4 | Una sección funciona en mobile, pero no comunica valor, se siente repetitiva y no aporta al recorrido. | Website Experience Auditor | fallo narrativo/experiencial |
| 5 | La implementación no respeta el diseño aprobado. | Web QA & Performance Guard | implementación vs. especificación |
| 6 | La implementación respeta el diseño aprobado, pero el diseño se siente commodity o poco memorable. | Website Experience Auditor | percepción premium |

### 4.3 Regla de conflicto técnico/experiencial

Si un problema puede ser técnico y experiencial a la vez:

1. Web QA valida primero si existe falla funcional, visual, responsive o técnica.
2. Si la implementación funciona, el Website Experience Auditor evalúa la calidad percibida.
3. Si ambos detectan problemas, cada uno reporta dentro de su dominio.
4. Ninguno reemplaza la autoridad del otro.

## 5. Regla de conflicto entre QAs

Cuando hay discrepancia entre dominios:

- **CASO 1 — Sin impacto cruzado:** cada QA decide en su dominio; no hay bloqueo global.
- **CASO 2 — Impacto cruzado (CRÍTICO):** p. ej. la web depende de una API que falla, o
  un workflow de automatización impacta el sistema web → se activa **ESCALAMIENTO** (§6).

## 6. Escalamiento obligatorio

Si hay conflicto entre QA, se deriva a:

- 🟣 **Technical Product Owner** → define si el problema es lógico o funcional.
- 🏗 **Automation Architect** → si es problema estructural de integración.
- 📋 **Project Manager** → si es problema de coordinación o timing.

Para conflictos que afectan experiencia/marca, también intervienen, según corresponda:
Product Experience Designer (experiencia end-to-end), Creative Director (dirección
creativa / percepción de marca), Product Strategist (posicionamiento / propuesta de
valor / mensaje). La jerarquía final de conflicto es la de `ROLE-AUTHORITY-MAP.md`.

## 7. Jerarquía de bloqueo y autoridad

La jerarquía de autoridad en conflictos es la definida en **`ROLE-AUTHORITY-MAP.md`
§4.1 (fuente única)**. Este documento NO define un orden propio; solo precisa cómo se
ubica QA en esa jerarquía.

Orden vigente (ROLE-AUTHORITY-MAP §4.1):
`Sales Agent → Automation Intake Analyst → Technical Product Owner → Automation Business
Analyst → Product Strategist → Project Manager → Automation Architect → QA (Web /
Automation) → Engineers`.

**Autoridad final por dominio:**
- Automation QA & Reliability Guard → confiabilidad de automatizaciones.
- Web QA & Performance Guard → calidad técnica, funcional, visual y operativa de la web.
- Website Experience Auditor → calidad experiencial percibida.

**Límites de bloqueo:**
- **Automation QA** bloquea: deployment de automatizaciones · paso a producción en el
  Execution Protocol.
- **Web QA** bloquea: deployment web · release en Web Delivery Pipeline · entregables
  con fallas técnicas/funcionales/visuales/responsive/performance.
- **Website Experience Auditor** bloquea o devuelve a revisión: cierre definitivo de
  experiencia · entregables que no alcancen estándar premium · experiencias genéricas o
  poco memorables · resultados con deuda experiencial grave. **No** bloquea deploy por
  fallas técnicas; Web QA **no** bloquea por percepción subjetiva si la implementación
  cumple especificación.

Precisión: dentro de su dominio, cada QA es autoridad final y puede bloquear el paso a
producción (§8); ante conflicto entre dominios o capas, aplica el orden de
ROLE-AUTHORITY-MAP §4.1 y el escalamiento de §6.

## 8. Regla de producción

Ningún sistema pasa a producción si:

- **Web QA & Performance Guard** no aprobó los estados correspondientes del Web Delivery
  Pipeline (STATE 7 / STATE 9 web).
- **Automation QA & Reliability Guard** no aprobó los estados correspondientes del
  Syntra Execution Protocol (STATE 5 / STATE 7 automation).
- Existen bloqueos técnicos, funcionales, visuales, responsive, performance o de
  confiabilidad sin resolver.

El Website Experience Auditor **no reemplaza** la aprobación técnica de producción, pero
el **cierre definitivo** del proyecto requiere validación experiencial cuando el cambio
afecte percepción premium, narrativa, diferenciación, memorabilidad, claridad del
mensaje o experiencia global.

> Regla principal: **producción técnica requiere QA técnico; cierre premium requiere
> validación experiencial.**

## 9. Integración con pipelines

### 🌐 Web Delivery Pipeline

**Web QA & Performance Guard** = gatekeeper técnico/funcional/visual/operativo (activo
en **STATE 7** y **STATE 9**). Valida: funcionamiento · performance · responsive ·
accesibilidad básica · integración frontend/backend · cumplimiento de especificación ·
errores visuales/funcionales. Puede bloquear: release · deployment web · cierre técnico.

**Website Experience Auditor** = auditor final de experiencia (activo en **STATE 9.5**)
cuando el cambio afecta percepción, narrativa, diferenciación o memorabilidad. Valida:
percepción premium · diferenciación · memorabilidad · narrativa · claridad del mensaje ·
ausencia de patrones commodity · calidad del recorrido. Puede generar: `APPROVED` ·
`REQUIRES IMPROVEMENT` · `EXPERIENCE BLOCKED`. No bloquea un deploy ya realizado ni por
fallas técnicas; puede bloquear/devolver el **cierre experiencial** del proyecto.

> Nota: el **gate de commit visual** (Cat B/C) lo opera el **Visual Quality Director**
> (`agents/governance/visual-quality-gate.md`, STATE 7.5) y es distinto de este QA
> técnico/experiencial: build verde NO alcanza para cerrar una tarea visual.

### ⚙️ Syntra Execution Protocol

**Automation QA & Reliability Guard** = gatekeeper de confiabilidad para automatizaciones
según los estados del Execution Protocol. Valida: workflows n8n · manejo de errores ·
confiabilidad · estabilidad · seguridad operativa · integraciones. Puede bloquear:
deployment de automatizaciones · paso a producción en procesos de automation.

## 10. Principio de consistencia global

Todos los dominios protegen la calidad del sistema desde su especialidad: Automation QA
→ confiabilidad operativa; Web QA → funcionamiento técnico/visual/funcional; Website
Experience Auditor → percepción premium/diferenciación/memorabilidad. En conjunto deben
garantizar: estabilidad del sistema completo · no ruptura de integraciones · no
degradación funcional · no degradación experiencial · no pérdida de percepción premium.

## 11. Principio final

Un sistema puede tener múltiples dominios de QA, pero **una sola verdad por dominio**:

- **Web QA** responde: ¿funciona correctamente?
- **Automation QA** responde: ¿es confiable?
- **Website Experience Auditor** responde: ¿se siente premium, claro, diferencial y memorable?

La calidad se valida por dominios separados; la producción se protege con QA técnico.

## 12. Relación con el resto del sistema

- `agents/ROLE-AUTHORITY-MAP.md` — fuente única de autoridad y jerarquía de conflicto
  (§4.1). Incluye la **autoridad de ejecución de Claude** (Autonomy Mode).
- `agents/governance/SYNTRA-CONTEXT-ROUTER.md` — modos de operación. En **Autopilot**,
  el QA técnico (`tsc`/`lint`/`build` + responsive/a11y) corre **antes** del commit/PR;
  en **Checkpoint** (visual Cat B/C) se suma el gate visual. Este layer define **qué**
  valida cada QA; el router define **cuándo/cómo** se ejecuta.
- `agents/governance/visual-quality-gate.md` — gate de commit visual del Visual Quality
  Director (Cat B/C); complementa, no reemplaza, al QA técnico de este documento.
- `agents/development/web-delivery-pipeline.md` — define los STATE; este layer dice
  quién es gatekeeper en cada uno.
- `.claude/skills/syntra-safe-commit-gate` + `.claude/hooks/` — imponen el safe-commit a
  nivel de tool (no `git add .`, no commit de archivos prohibidos).
