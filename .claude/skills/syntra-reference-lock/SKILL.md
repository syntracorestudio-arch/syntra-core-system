---
name: syntra-reference-lock
description: Use AFTER the visual concept and BEFORE touching code on any premium/visual SYNTRA section (Hero, Casos, Servicios, Proceso, Contacto, signature pieces, protagonist backgrounds). Forces the creative direction into a verifiable, owner-approved artifact (docs/reference-locks/<section>.md) with at least one concrete visual reference and binary approval criteria, and records the asset-first vs code-first decision. No code on Cat B/C visual work without an approved lock. Prevents the "premium → straight to implementation" rework loop.
---

# SYNTRA Reference Lock

**Normative skill.** Turns "I want something premium" into a verifiable artifact the owner approves *before* any code. A green build or a nice paragraph is not direction — a locked visual reference is. This skill is what stopped the Hero rework loop: implementation no longer starts from words, it starts from an approved reference.

## When this applies
Run this for any **Categoría B / C** visual task with relevant visual work, AFTER `syntra-premium-section-design` (concept) and BEFORE any implementation:
- Hero, Casos, Servicios, Proceso, Contacto, Footer, signature pieces, protagonist backgrounds, premium scenes, hero visuals, image/3D/illustration-led sections.
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
