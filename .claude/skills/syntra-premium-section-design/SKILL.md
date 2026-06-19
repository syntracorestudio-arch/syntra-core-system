---
name: syntra-premium-section-design
description: Use BEFORE implementing or redesigning any premium web section for SYNTRA (Hero, Servicios, Casos, Proceso, Contacto, etc.). Forces a read-only design concept first — root visual diagnosis, commercial objective, 3 visual directions, constraints to drop, dashboard/template/maqueta risks, a recommendation, and binary approval criteria — so implementation never starts without a written, approvable concept.
---

# SYNTRA Premium Section Design

**Normative skill.** Run this BEFORE touching code on a visual section. Its purpose is to prevent the micro-iteration loop (changing classes "a ojo") by fixing concept + written criteria first. **For Categoría B/C visual tasks, approving this concept does NOT authorize implementation — it authorizes creating a `reference-lock`.** Code stays blocked until an owner-approved lock exists.

## When this applies
Before designing, redesigning, or elevating any visual section of the SYNTRA web. Pairs with `syntra-reference-lock` (the binding artifact this skill hands off to), `syntra-visual-gate` (which governs the commit) and `syntra-premium-motion-system` (for the motion).

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
- Premium-accesible (Linear/Vercel/Stripe quality, clear for non-technical PyMEs).
- No dashboard, tabla, checklist, maqueta ni feature card genérica.
- Differentiated from Proceso (cómo trabajamos) and Servicios (capacidad/producto).
- Honestidad intacta: sin clientes, logos, métricas ni testimonios inventados; tono condicional cuando corresponda.
- Mobile-first, CLS 0, reduced-motion, accesibilidad, Lighthouse +95.
- Cyan reservado para HECHO (ver `syntra-premium-motion-system`).

## Anti-patterns to block before code
Dashboard widgets, status badges semánticos, timestamps/contadores falsos, grilla tabular, dots sin masa, feature-table de checks, aire muerto sin intención, duplicar Servicios o Proceso, "optimizar líneas del H1" como sustituto de diseño.

## Handoff: concept → reference-lock (Cat B/C)
Approving this concept does NOT start code. The mandatory next step is to turn the chosen direction into a binding, owner-approved artifact via `syntra-reference-lock`.

Hard rules:
1. For Cat B/C visual tasks, the output of THIS skill does NOT authorize implementation.
2. The output of this skill authorizes creating a `reference-lock`.
3. Implementation stays blocked until `docs/reference-locks/<section>.md` exists with `status: approved`.
4. The visual direction must include a preliminary asset-first / code-first decision (deliverable 8).
5. If the section has a main protagonist visual, the recommended default is **asset-first**.
6. Claude must not go from concept to code without an owner-approved reference-lock.
7. The final output must end with the line: **`NEXT REQUIRED STEP: syntra-reference-lock`**.

**Anti-rework rule:** if a visual section enters 2 failed implementation iterations, stop patching code — return to `syntra-reference-lock` and revise the approved reference (the reference was wrong, not the CSS).

### Required output block (append to the deliverable)
```md
## Decisión preliminar asset-first / code-first

**Decisión:** asset-first | code-first

**Justificación:**

**¿Hay protagonista visual principal?** sí | no

**Siguiente paso obligatorio:**
Invocar `syntra-reference-lock` para crear `docs/reference-locks/<section>.md`.

**Estado:**
Concepto aprobado para lock, NO aprobado para implementación.
```

## Process
`website-experience-auditor` / `creative-director` / `product-experience-designer` / `ui-ux-designer` / `design-system-guardian` produce the concept (read-only) → owner approves concept → **`syntra-reference-lock` (create + owner approves the lock)** → `frontend-engineer` implements against the lock under `syntra-premium-motion-system` + `syntra-visual-gate` (which validates result vs lock).

## Precedence
Normative for SYNTRA. External skills (e.g. `ui-ux-pro-max`) are consultive and may NOT contradict this skill, the Design System Guardian, Visual Quality Director, ROLE-AUTHORITY-MAP, CLAUDE.md, or the SYNTRA palette/tone/positioning.

## References
- `agents/design/creative-director.md`, `agents/design/ui-ux-designer.md`, `agents/design/design-system-guardian.md`
- `agents/design/product-experience-designer.md`, `agents/design/website-experience-auditor.md`
- `projects/syntra-core-website/docs/specs/live-system-motion-spec.md`
- `CLAUDE.md` (Prioridades, UI Rules, UX Rules, routing)
