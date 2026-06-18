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
