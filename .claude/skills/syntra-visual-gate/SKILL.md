---
name: syntra-visual-gate
description: Use before committing ANY visual or perceptual change to the SYNTRA web (Hero, Servicios, Casos, Proceso, Contacto, layout, composition, hierarchy, visible motion, responsive, use of space). Enforces the mandatory flow prototipo → QA técnico → screenshots → visual-quality-director → owner approval → commit. A green build is NOT design approval.
---

# SYNTRA Visual Quality Gate

**Normative skill.** Governs how every visual/perceptual change to the SYNTRA web reaches a commit. Build verde ≠ diseño aprobado.

## When this applies
Any task that affects: Hero, Servicios, Casos, Proceso, Contacto, Footer, layout visual, composición, jerarquía, motion visible, escenas premium, responsive visual, uso del espacio, jerarquía de CTA, percepción de marca. **When in doubt, treat the task as visual.**

Technical/bugfix tasks that don't change perception may commit on technical QA alone. Visual/perceptual tasks MUST pass this gate.

## Mandatory flow (do not skip steps)
```
prototipo local → QA técnico → screenshots → visual-quality-director (Visual Review) → aprobación explícita del owner → commit
```
1. **Prototipo local** — implement in the working tree. **Do NOT commit.**
2. **QA técnico** — `npx tsc --noEmit`, `npm run lint`, `npm run build`. Must be green. (Necessary, not sufficient.)
3. **Screenshots** — with `npm run dev` running, `npm run visual:shots`. Captures the 5 mandatory breakpoints to `.visual-review/<timestamp>/` (gitignored).
4. **Visual Review** — invoke the real `visual-quality-director` subagent on the screenshots + code. It can VETO even if technical QA is green.
5. **Owner approval** — the owner approves visually in browser/screenshots. **No commit without explicit owner approval.**
6. **Commit** — only after owner approval, via `syntra-safe-commit-gate`.

## Mandatory breakpoints
```
360x640   390x844   768x1024   1024x768   1440x900
```

## Visual Review format (visual-quality-director output)
```
# Visual Review — <TASK>
## Veredicto: APROBADO / NO APROBADO / APROBADO CON AJUSTES
## Qué funciona
## Qué falla
## Riesgos visuales
## ¿Parece dashboard/checklist/maqueta/tabla/feature card?
## ¿El cyan está reservado solo para HECHO?
## ¿Se diferencia de Proceso / Servicios?
## ¿Hay CLS?
## ¿Reduced-motion muestra estado final?
## Qué debe cambiar antes de commit
## Decisión: Commitear / Ajustar sin commitear / Revertir / Abrir rediseño
```

## Veto criteria (the visual-quality-director blocks the commit if)
- Empeora visualmente respecto a la versión anterior.
- Parece dashboard, tabla, checklist, maqueta, PowerPoint o feature card genérica.
- Jerarquía pobre / CTA sin peso / aire muerto o saturado.
- No se entiende en pocos segundos / no se reconoce el contexto.
- Rompe la percepción premium (ancla: Linear / Vercel / Stripe / Raycast / Framer).
- Cyan usado fuera del estado HECHO.
- No fue revisado en los 5 breakpoints.

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
