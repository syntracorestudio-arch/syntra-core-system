---
name: syntra-visual-gate
description: Use before committing visual work to the SYNTRA web. V2 (2026-07-07): the gate IS the owner's approval of the LIVE prototype in their browser (variantes vivas). Minimum before showing: tsc/lint clean, console clean, render reviewed with vision at 1920+390. visual-quality-director = diagnostic tool on demand, not a mandatory step. A green build is NOT design approval; neither is prose.
---

# SYNTRA Visual Quality Gate

**Normative skill.** Governs how every visual/perceptual change to the SYNTRA web reaches a commit. Build verde ≠ diseño aprobado.

## Copyable checklist (V2 — copy this into your response and tick each item)

> Refleja la reforma V2 (variantes vivas, design-freedom-v2 §4). Ante conflicto
> con el cuerpo de esta skill, mandan CLAUDE.md y design-freedom-v2.

```
- [ ] Cat B/C: reference-lock approved en docs/reference-locks/<section>.md (si falta/draft → STOP → syntra-reference-lock)
- [ ] Prototipo VIVO en working tree (motion desde el minuto uno) — SIN commitear
- [ ] npx tsc --noEmit · npm run lint · npm run build → verdes (repetir hasta PASS, no avanzar en rojo)
- [ ] Consola limpia + render revisado con VISIÓN a 1920 y 390 (capturas descartables)
- [ ] Composition Self-Review escrita (sección de abajo)
- [ ] visual-quality-director si ayuda al diagnóstico (V2: herramienta, no trámite obligatorio; en Cat B/C compara vs lock)
- [ ] OK EXPLÍCITO del owner sobre el prototipo vivo en SU navegador  ← este es el gate de commit
- [ ] Recién ahí: commit vía syntra-safe-commit-gate → reference-lock DESPUÉS como documentación
```

**STOP gates (hard):**
- 2º rechazo del owner sobre el mismo prototipo → **STOP anti-loop**: pedir SU referencia (imagen/link/spec); no iterar una 3ª a ciegas.
- 3ª iteración sin convergencia → cambiar de MEDIO (asset/render/spec formal/valores exactos), nunca "otro intento del mismo tipo".
- 2 iteraciones fallidas contra el mismo lock → volver al reference-lock (la referencia estaba mal, no el CSS).
- Sin OK explícito del owner → los cambios visuales QUEDAN sin commitear. Sin excepción.

## When this applies
Any task that affects: Hero, Servicios, Casos, Proceso, Contacto, Footer, layout visual, composición, jerarquía, motion visible, escenas premium, responsive visual, uso del espacio, jerarquía de CTA, percepción de marca. **When in doubt, treat the task as visual.**

Technical/bugfix tasks that don't change perception may commit on technical QA alone. Visual/perceptual tasks MUST pass this gate.

## Precondition: approved reference-lock for Cat B/C

For visual Cat B/C work, check before prototyping or implementation:

- `docs/reference-locks/<section>.md` exists.
- `status: approved`.
- The lock contains at least one concrete visual reference.
- The lock contains binary approval criteria.

If missing or draft:
STOP.
Do not implement.
Run `syntra-reference-lock`.

Reference-lock rules (Cat B/C):
1. No prototype/visual implementation starts without an approved reference-lock.
2. The expected lock lives at `docs/reference-locks/<section>.md`.
3. The lock must have `status: approved`.
4. If the lock is missing or `draft`, this gate BLOCKS implementation and returns to `syntra-reference-lock`.
5. The VQD compares screenshots/results against the lock's binary criteria.
6. The VQD validates "result vs approved reference", not only "premium opinion".
7. After 2 failed iterations against the lock, stop patching code — return to the reference-lock.

(Code-first / Categoría A tasks do not require a lock; this precondition applies to Cat B/C visual work.)

## Mandatory flow (do not skip steps)
```
reference-lock approved (Cat B/C) → prototipo local → QA técnico → screenshots → visual-quality-director (Visual Review vs lock) → aprobación explícita del owner → commit
```
0. **Reference-lock check (Cat B/C)** — verify `docs/reference-locks/<section>.md` is `approved`. If missing/draft → STOP and run `syntra-reference-lock`.
1. **Prototipo local** — implement in the working tree. **Do NOT commit.**
2. **QA técnico** — `npx tsc --noEmit`, `npm run lint`, `npm run build`. Must be green. (Necessary, not sufficient.)
3. **Screenshots** — with `npm run dev` running, `npm run visual:shots`. Captures the 6 mandatory breakpoints (incl. 1920×1080 large desktop) to `.visual-review/<timestamp>/` (gitignored).
4. **Visual Review** — invoke the real `visual-quality-director` subagent on the screenshots + code. It can VETO even if technical QA is green.
5. **Owner approval** — the owner approves visually in browser/screenshots. **No commit without explicit owner approval.**
6. **Commit** — only after owner approval, via `syntra-safe-commit-gate`.

## Mandatory breakpoints
```
360x640   390x844   768x1024   1024x768   1440x900   1920x1080
```
Validate mobile-first, but with desktop-premium validation. On large desktop
(1920) the design must NOT just stretch — it must keep visual density, hierarchy,
reading limits, column balance, scene intent and control of negative space. If a
section reads as content floating on a too-large surface, the design fails even if
it is technically responsive.

## Composition Balance Gate (mandatory before owner approval)
Technical green + "usa asset / no es dashboard azul / no tapa la imagen /
reduced-motion ok" is NOT enough. The gate also evaluates **proportion, hierarchy
and balance**. Before requesting owner approval, every visual task answers in
writing:
```
## Composition Self-Review
### Qué se ve primero
### Qué debería verse primero
### Qué elemento compite con el protagonista
### Qué está demasiado chico
### Qué está demasiado grande
### Qué texto se corta demasiado (sin intención editorial)
### Cómo se comporta en 1440
### Cómo se comporta en 1920
### Cómo se comporta en mobile (390 y 360)
### Qué ajustaría antes de pedir aprobación del owner
```

## Visual Review format (visual-quality-director output)
```
# Visual Review — <TASK>
## Veredicto: APROBADO / NO APROBADO / APROBADO CON AJUSTES
## Qué funciona
## Qué falla
## Riesgos visuales
## ¿Parece dashboard/checklist/maqueta/tabla/feature card?
## ¿Los colores son de la familia de marca? (paleta libre — design-freedom-v2 §1)
## ¿Se diferencia de Proceso / Servicios?
## ¿Hay CLS?
## ¿Reduced-motion muestra estado final?
## Qué debe cambiar antes de commit
## Decisión: Commitear / Ajustar sin commitear / Revertir / Abrir rediseño
```

## VQD review: result vs reference-lock

For Cat B/C work, the Visual Quality Director must compare the implementation against the approved `docs/reference-locks/<section>.md`:

- approved references;
- what we take from each reference;
- what we explicitly do not take;
- selected visual direction;
- asset-first/code-first decision;
- binary approval criteria;
- visual risks.

The review must state:

- pass/fail per criterion;
- deviations from the lock;
- whether deviations are acceptable;
- whether to approve, adjust, or return to reference-lock.

This makes the veto objective (result vs approved reference), not only a subjective "premium opinion".

**Anti-loop rule:** after 2 failed implementation iterations against the same lock, stop patching code. Return to the reference-lock and revise the visual reference/direction (the reference was wrong, not the CSS).

## Veto criteria (the visual-quality-director blocks the commit if)
- **Cat B/C: no approved `docs/reference-locks/<section>.md`, or the result does not meet the lock's binary criteria.**
- Empeora visualmente respecto a la versión anterior.
- Parece dashboard, tabla, checklist, maqueta, PowerPoint o feature card genérica.
- Jerarquía pobre / CTA sin peso / aire muerto o saturado.
- No se entiende en pocos segundos / no se reconoce el contexto.
- Rompe la percepción premium (ancla: Linear / Vercel / Stripe / Raycast / Framer).
- Color fuera de la familia de marca sin decisión del owner.
- **Balance:** texto principal comprimido o heading roto en demasiadas líneas sin intención; asset/escena protagonista demasiado chico, o un secundario domina al protagonista; columnas mal proporcionadas; 1920 desaprovechado (contenido flotando); mobile con stack excesivo o ilegible.
- No fue revisado en los 6 breakpoints (incl. 1920×1080) ni pasó la Composition Self-Review.

Its veto is over approvable visual quality, NOT technical correctness; it complements `qa-performance-guard`, it does not replace it (CLAUDE.md rules 11–13).

## Owner approval required
Until the owner approves explicitly, changes stay in the working tree, uncommitted. The `visual-quality-director` APROBADO lifts the visual veto but does NOT authorize the commit — only the owner does.

## Precedence
This skill is normative for SYNTRA. External skills (e.g. `ui-ux-pro-max`) are consultive and may NOT contradict it, the Visual Quality Gate, Design System Guardian, Visual Quality Director, ROLE-AUTHORITY-MAP, CLAUDE.md, or the SYNTRA palette/tone/positioning.

## References
- `agents/governance/visual-quality-gate.md` (full protocol)
- `agents/design/visual-quality-director.md` (role + veto)
- `CLAUDE.md` rules 8, 11, 12, 13
- `projects/syntra-core-website/scripts/visual-screenshots.mjs` (`npm run visual:shots`)
