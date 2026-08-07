---
name: syntra-reference-lock
description: Use in TWO moments of section work. (1) BEFORE redesigning or touching a section that already has a lock — hero, servicios, casos, proceso, contacto, nosotros, faq, footer — read docs/reference-locks/<section>.md to know what was approved and why. (2) AFTER the owner approves a live prototype, write the lock: decisions, iterations rejected, verified criteria, files touched.
---

# SYNTRA Reference Lock

**Cargar esta skill es obligatorio; el lock NO es un permiso.** Son dos cosas
distintas y conviene no confundirlas (regla vigente desde la reforma V2):

- **DISPARO (obligatorio).** Si vas a tocar una sección que ya tiene lock, leelo
  ANTES de escribir código. No es burocracia: es enterarte de qué se aprobó, qué
  se rechazó y por qué, para no volver a proponer lo que el owner ya descartó.
- **APROBACIÓN (solo el owner).** El gate de commit es su OK sobre el prototipo
  VIVO en su navegador (variantes vivas, design-freedom-v2 §4). El lock se
  escribe DESPUÉS, como documentación de lo aprobado — nunca como permiso previo.

Ignorá toda regla de este archivo que condicione el código a un lock aprobado.

## When this applies
- **Antes** de rediseñar o tocar una sección CON lock: hero, servicios, casos,
  proceso, contacto, nosotros, faq, footer — leer `docs/reference-locks/<section>.md`.
- **Después** del OK del owner sobre el prototipo vivo: escribir/actualizar el lock.
- **Skip it** for Categoría A (fast-track: spacing, hover, typo, responsive polish, bugfix, perf) and for pure code-first sections with no protagonist visual.
- When in doubt whether the task needs a lock, treat it as needing one.

Pairs with `syntra-premium-section-design` (concept, runs before this) and `syntra-visual-gate` (commit gate, runs after; it requires an approved lock as precondition and validates result-vs-lock).

## What problem it solves
Claude must NOT jump from "premium / moderno / con glow / tipo Spline" to implementation. That path produced 3 throwaway Hero versions. The fix: a binding visual reference + binary criteria must exist and be owner-approved first. Casos worked because it was asset-first with concrete references; the Hero looped because it was code-first improvised from adjectives.

## What a reference-lock IS
A short markdown artifact at `docs/reference-locks/<section>.md` (from `_template.md`) that contains **at least one concrete visual reference** plus the decisions below. Valid references:
- a screenshot of a real reference (e.g. a Linear/Stripe/Vercel section),
- a short moodboard (2–4 images),
- a generated asset (image/render/`.webp`/`.glb` preview),
- an approved visual wire/mock,
- a link to a live scene,
- an image explicitly approved by the owner.

## What does NOT count as a reference-lock
- Adjectives: "premium", "moderno", "elegante", "con glow", "tipo Spline", "wow".
- A prose description with no image/link.
- A list of constraints without a visual target.
- A green `tsc`/`lint`/`build`.
If there is no concrete visual reference, the lock stays `draft` and **does not authorize code**.

## Asset-first vs code-first (decide and record)
**Default to asset-first** when the section's *protagonist visual* is an image, mockup, 3D scene, premium object, illustration, hero visual, visual use-case, or protagonist background.
- **asset-first:** the protagonist is created/chosen as an **asset** (optimized image, `.webp`, `.glb`, render) and approved BEFORE code; code only composes/animates the approved asset.
- **code-first:** allowed when the section is layout/form/FAQ/cards/editorial/minor adjustment/QA/responsive polish — no protagonist asset needed.

**Hard rule:** Claude does NOT invent the main premium protagonist visual from code alone without explicit owner approval. If asset-first applies, the asset (or its approved reference) must exist before implementation.

## Hard rules
1. Cat B/C visual tasks: **no code without an `approved` reference-lock.**
2. "Premium / moderno / con glow / tipo Spline" is NOT a reference-lock.
3. There must be **≥1 concrete visual reference** (screenshot / moodboard / asset / wire / scene link / owner-approved image).
4. The lock states **what is taken** and **what is NOT taken** from each reference.
5. The lock records **asset-first or code-first** with justification.
6. The lock includes **binary approval criteria** (checkboxes the result must satisfy).
7. If the main protagonist is image/mockup/object/3D/protagonist background → **default asset-first**.
8. Claude does not invent premium protagonist visuals from code alone without explicit owner approval.
9. Anti-loop: **max 2 code iterations** of a signature piece; on the 3rd, return to the lock (the reference was wrong) instead of patching code.
10. The lock **records** the palette actually used, including anything unusual, and why. It does not request permission for it — see below.

## Paleta: qué registra el lock (REFORMA V2, 2026-07-07)
La regla **90/10 azul**, el **cyan = solo HECHO** y el **trámite de excepción de
paleta** quedaron **DEROGADOS** por `docs/creative-library/design-freedom-v2.md`.
No hay que declarar una excepción por adelantado ni pedir permiso para salirse de
una proporción: la familia de marca (slate + electric + cyan + violeta + warm) es
de **uso libre con criterio**, y en los componentes de sistema el cyan conserva su
semántica de resultado.

Lo que el lock sí hace, **después** de la aprobación, es dejar registro para que
la próxima sección no tenga que re-deducirlo:
- qué colores/materiales terminó usando la pieza y por qué;
- hasta dónde llega (el límite que el owner aceptó en vivo);
- cómo se mantiene la marca (no genérico/template);
- cómo queda protegida la legibilidad (contraste de texto/CTA, AA en el peor caso).

Los únicos límites duros siguen siendo los técnicos y los de marca: nada
gamer/crypto/template-IA, ni degradados arcoíris, ni pérdida de legibilidad.

## Output Claude must deliver
When this skill runs:
1. Create `docs/reference-locks/<section>.md` from `_template.md`, filled in (objective, role, references, take/drop, chosen direction, decision, binary criteria, visual + technical/perf risks), `status: draft`.
2. Place referenced images under `docs/reference-locks/assets/` (or link external scenes) — never adjectives-only.
3. Present it to the owner and **ask for approval**. Only the owner flips `status: draft → approved` (record `approved_by` + `date`).
4. State explicitly: **implementation is blocked until the lock is `approved`.**

## What it blocks
- Editing/implementing a Cat B/C visual section whose lock is missing or `draft`.
- Asset-first sections where the protagonist asset/reference does not yet exist.
- Skipping straight to `frontend-engineer` from a concept.

## Integration with the SYNTRA flow
```
syntra-premium-section-design   (concept: diagnosis · objective · 3 directions · criteria)
        ↓ invokes
syntra-reference-lock           (THIS: artifact docs/reference-locks/<section>.md + asset/code decision)
        ↓ owner approves lock (Gate humano #1)
   [asset-first → create/approve asset first]
        ↓
frontend-engineer               (implements AGAINST the lock, max 2 iterations)
        ↓
syntra-visual-gate              (prototipo→QA→screenshots→VQD: validates RESULT vs LOCK → owner approves commit)
        ↓
syntra-safe-commit-gate         (commit)
```
- `syntra-premium-section-design` ends by invoking this skill.
- `syntra-visual-gate` requires an `approved` lock as precondition and the Visual Quality Director validates the result against the lock's binary criteria (objective), not by taste.
- This skill does NOT replace the VQD: it gives the VQD an objective reference to validate against.
