---
name: syntra-premium-section-design
description: Use when diagnosing or redesigning a whole section, or when something 'looks generic / doesn't feel premium' — root visual diagnosis, commercial objective, 3 directions with tradeoffs, risks, recommendation. Load it together with design-director for hero, servicios, casos, proceso, contacto, nosotros, FAQ and footer redesigns, section audits, and layout/hierarchy overhauls.
---

# SYNTRA Premium Section Design

**Es una herramienta de DIAGNÓSTICO, no un trámite de aprobación.** La distinción
que ordena todo (reforma V2):

- **DISPARO.** Ante un rediseño de sección o un "esto se ve genérico", cargala
  junto al `design-director` ANTES de escribir código. El diagnóstico y las
  direcciones son el insumo del prototipo, no un papel que alguien firma.
- **APROBACIÓN (solo el owner).** Nada de lo que salga de acá habilita ni bloquea
  un commit: el gate es su OK sobre el prototipo VIVO en su navegador
  (variantes vivas, design-freedom-v2 §4).

Ignorá las reglas de este archivo que condicionen la implementación a locks o a
aprobaciones de concepto.

## When this applies
Before designing, redesigning, or elevating any visual section of the SYNTRA web. Pairs with `syntra-reference-lock` (documentation written after the owner approves), `syntra-visual-gate` (the pre-show checks) and `syntra-premium-motion-system` (for the motion).

## Mandatory deliverable (read-only, no code)
Produce, before any implementation:

1. **Diagnóstico visual raíz** — what is actually wrong, in terms of composición, jerarquía, aire, foco y percepción premium. Not "px" or a single class — the structural cause.
2. **Objetivo comercial** — what the section must achieve for a non-technical owner (qué es / para quién / qué gana) and the emotion it must leave. Its KPI (e.g. reflejo <3s, deseo de seguir, clic en CTA).
3. **3 direcciones visuales** — real alternatives (not timid variations). For each: nombre · concepto · layout · interacción · qué se anima · qué ve el usuario · ventajas · riesgos.
4. **Restricciones que conviene soltar** — what should stop being "intocable" to reach premium (formatos, chasis, visual protagonista, FROZEN si aplica). Name them.
5. **Riesgos de dashboard / template / maqueta / tabla / feature card** — what concretely risks the generic look, and how each direction avoids it.
6. **Recomendación** — one direction, justified. State explicitly whether the current asset survives, transforms, or is replaced.
7. **Criterios binarios de aprobación** — 7–12 verifiable yes/no checks the future prototype must pass (anti-loop). Include the SYNTRA invariants below.
8. **Decisión preliminar asset-first / code-first** — for the recommended direction, decide whether the protagonist visual is created as an asset (default if there is a main protagonist visual) or built in code. This is the seed of the lock's decision; `syntra-reference-lock` confirms it.

## SYNTRA invariants (always in the criteria)
- Premium-accesible (calidad top, claro para cualquier dueño de negocio no técnico).
- No dashboard, tabla, checklist, maqueta ni feature card genérica.
- Differentiated from Proceso (cómo trabajamos) and Servicios (capacidad/producto).
- Honestidad intacta: sin clientes, logos, métricas ni testimonios inventados; tono condicional cuando corresponda.
- Mobile-first, CLS 0, reduced-motion, accesibilidad, Lighthouse +95.
- Paleta libre con criterio de marca (design-freedom-v2 §1).

## Anti-patterns to block before code
Dashboard widgets, status badges semánticos, timestamps/contadores falsos, grilla tabular, dots sin masa, feature-table de checks, aire muerto sin intención, duplicar Servicios o Proceso, "optimizar líneas del H1" como sustituto de diseño.

## Handoff: concept → reference-lock (Cat B/C)
Este diagnóstico **no aprueba ni bloquea nada**: alimenta la construcción de los
prototipos vivos que el owner va a juzgar. La reforma V2 (2026-07-07) derogó el
"concepto aprobado → lock aprobado → recién ahí código". Escribir código es el
camino normal para llegar a algo que el owner pueda mirar.

Reglas duras:
1. La salida de esta skill **no es un permiso**, ni para implementar ni para frenar.
2. No existe "implementación bloqueada hasta que el lock esté `approved`". El lock
   se escribe **después** de la aprobación, como documentación (`syntra-reference-lock`).
3. Si la sección **ya tiene** un lock, leerlo antes de tocarla: dice qué se aprobó y
   por qué. Eso es contexto obligatorio; sigue sin ser un permiso.
4. La dirección visual **sí** debe incluir la decisión **asset-first / code-first**
   (entregable 8): es la que evita la iteración a ciegas.
5. Si la sección tiene un visual protagonista, el default recomendado es **asset-first**.
6. El único gate de commit es el **OK del owner sobre el prototipo VIVO en su navegador**.

**Regla anti-rework (la lección cara de la saga del hero):** a la 2ª iteración
visual rechazada, **STOP anti-loop** — pedirle al owner SU referencia (imagen,
link, spec, valores exactos). A la 3ª, cambiar de **MEDIO** (asset, render, spec
formal), nunca "otro intento del mismo tipo". Los desbloqueos vinieron siempre de
una referencia suya, jamás de la iteración N+1 improvisada.

### Required output block (append to the deliverable)
```md
## Decisión preliminar asset-first / code-first

**Decisión:** asset-first | code-first

**Justificación:**

**¿Hay protagonista visual principal?** sí | no

**Siguiente paso:**
Construir 1-3 prototipos VIVOS de la dirección elegida (motion desde el minuto uno)
y mostrárselos al owner en SU navegador. Si la sección ya tiene lock, leerlo antes.

**Estado:**
Diagnóstico entregado. La aprobación la da el owner sobre el prototipo vivo;
el lock se escribe después.
```

## Process (workflow de variantes vivas — design-freedom-v2 §4)
`design-director` (+ `product-experience-designer` si hay contenido en juego)
diagnostica read-only → **se construyen 1-3 prototipos VIVOS directamente**, con
motion desde el minuto uno → el owner juzga **en SU navegador** e itera en vivo →
**su OK al prototipo vivo ES el gate de commit** → `syntra-reference-lock` se
escribe **DESPUÉS**, como documentación de lo aprobado.

`frontend-engineer` / `motion-3d-engineer` implementan bajo
`syntra-premium-motion-system`; `syntra-visual-gate` corre antes de mostrarle
nada al owner; `visual-quality-director` es diagnóstico disponible en cualquier
iteración, no un trámite previo.

> **Este análisis NO es un permiso.** No existe "concepto aprobado" ni "lock
> aprobado" como precondición para escribir código: la reforma V2 (2026-07-07)
> derogó el lock-antes-de-código. Cargar esta skill dispara el diagnóstico; lo
> único que aprueba es el owner, mirando algo vivo.

## Precedence
Normative for SYNTRA. External skills (e.g. `ui-ux-pro-max`) are consultive and
may NOT contradict this skill, `docs/creative-library/design-freedom-v2.md`,
CLAUDE.md, or the SYNTRA tone/positioning. Where an older SYNTRA document
conflicts with design-freedom-v2, **v2 wins**.

## References
- `docs/creative-library/design-freedom-v2.md` (doctrina vigente)
- `.claude/agents/design-director.md`, `.claude/agents/product-experience-designer.md`,
  `.claude/agents/visual-quality-director.md` (roster V2; las specs históricas en
  `agents/design/**` son archivo de referencia, no autoridad)
- `projects/syntra-core-website/docs/specs/live-system-motion-spec.md`
- `CLAUDE.md` (Prioridades, UI Rules, UX Rules, routing)
