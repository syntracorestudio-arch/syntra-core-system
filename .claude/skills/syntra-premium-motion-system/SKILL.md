---
name: syntra-premium-motion-system
description: Use for any motion/animation work on the SYNTRA web (live-system sections, reveals, transitions, the PENDIENTE→ACTIVO→HECHO pattern). Enforces purpose-first motion, the canonical states, the EASE_PREMIUM/DURATION tokens, reduced-motion final state, CLS 0, opacity/transform only, no unnecessary loops, and no decorative motion.
---

# SYNTRA Premium Motion System

**Normative skill.** One movement "seal" for the whole site. Components consume tokens; they do not invent timing. Motion exists to show the system working, never to decorate.

## When this applies
Any task that adds or changes animation/transition on the SYNTRA web. Pairs with `syntra-visual-gate` (commit) and `syntra-premium-section-design` (concept).

## 1. Purpose first
Before animating, state WHAT the motion communicates. If the answer is "it looks nice", do not animate. No motion decorativo, distractivo ni caricaturesco. One live focus per viewport.

## 2. Canonical states (live-system: "el recorrido de una consulta")
```
PENDIENTE = neutro / bajo peso / apagado            (muted; sin cyan)
ACTIVO    = brand-electric / transitorio / uno por vez (destello one-shot, se apaga solo)
HECHO     = brand-cyan + check / persistente / clímax  (queda encendido; ÚNICO uso de cyan)
```
- Un solo paso ACTIVO por vez (delays acumulados por índice, no stagger paralelo).
- HECHO persiste tras el gesto (no parpadea, no loop). **El cyan es señal exclusiva de HECHO** — nunca decora íconos, labels, checks de soporte ni pills.

## 3. Tokens (no inventar)
Consume from `projects/syntra-core-website/src/lib/motion.ts`:
- `EASE_PREMIUM` (`[0.16, 1, 0.3, 1]`) for every transition. **No easing inline.**
- `DURATION` (`micro 0.2 · standard 0.4 · section 0.6 · hero 0.9`). Per-step delay reuses `DURATION.standard` unless a centralized constant is justified — never a loose number in the component.
- `staggerContainer`/`staggerItem`, `VIEWPORT_ONCE` where they fit.
Any new timing constant lives in `lib/motion.ts`, nowhere else.

## 4. Only opacity / transform
Animate ONLY `opacity` and `transform` (scale/translate). **Never** animate `width`, `height`, `box-shadow`, `filter`, `color`, `background` or layout properties. State changes (e.g. HECHO check) conmutan nodos preexistentes por opacity/color — never insert/remove DOM (that causes reflow).

## 5. reduced-motion
With `prefers-reduced-motion: reduce`: render the **complete final state** directly — all steps visible, the last in HECHO (cyan + check), no execution, no stagger, no delays. Use `useReducedMotion()` with an explicit branch.

## 6. CLS = 0
Reserve height in the PERSISTENT parent container (not in a `motion.div` that re-mounts via `key` + `AnimatePresence mode="wait"`). The gesture must not push or insert layout. Validate corto→largo and largo→corto at desktop/tablet/mobile.

## 7. No unnecessary loops
Default is one-shot per viewport (or per click). Max 1 loop-zone per viewport, and loops must pause off-viewport. A perpetual loop reads as a decorative GIF — avoid unless justified and approved.

## 8. Accessibility
HECHO must not depend on color alone — pair with a check icon + text. Preserve `tablist`/`tab`/`tabpanel`, `aria-controls`, `aria-labelledby`. Avoid `aria-live` unless strongly justified.

## Precedence
Normative for SYNTRA. External skills (e.g. `ui-ux-pro-max`) are consultive and may NOT contradict this skill, the Design System Guardian, Visual Quality Director, ROLE-AUTHORITY-MAP, CLAUDE.md, or the SYNTRA palette/tone/positioning.

## References
- `projects/syntra-core-website/src/lib/motion.ts` (tokens — source of truth)
- `projects/syntra-core-website/docs/specs/live-system-motion-spec.md` (§3 léxico, §6 motion rules, §8 una sola familia, §9 CLS/reduced-motion)
- `projects/syntra-core-website/src/components/sections/workflow-section.tsx` (Proceso — patrón de referencia)
