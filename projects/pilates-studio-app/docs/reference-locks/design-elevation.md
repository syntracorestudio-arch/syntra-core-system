---
section: "design-elevation"
status: approved
approved_by: owner
approved_date: 2026-06-26
date: 2026-06-26
decision: code-first
---

# Reference Lock — Design Elevation (pulido de app premium)

Pase de **acabado** (no rediseño) sobre el MVP funcional de StudioFlow. Eleva la
percepción de calidad manteniendo estructura, jerarquía y palette aprobadas. Informado por
`creative-director` + `design-system-guardian` (read-only). Dirección elegida por el owner:
**"pulido de app premium"** (nivel Linear/Stripe/Things/Raycast en sus PANELES, no marketing).

## El sentir objetivo
"Un cuaderno de estudio bien hecho: cálido, ordenado, que responde cuando lo tocás — nunca
te hace esperar ni te distrae." Premium silencioso. App utilitaria, **no** la web viva de
marketing.

## Movimientos (priorizados por ROI)
- **M1 · Profundidad real** — escala de 3 sombras **cálidas** (teñidas con `--foreground`,
  nunca negro): `--shadow-card` (reposo) · `--shadow-card-hover` · `--shadow-raised`
  (KPI ingresos, panel registrar pago). Reemplaza el `shadow-sm` plano único.
- **M2 · Motion de entrada** — listas/cards con fade + rise (`translateY` 8px→0), 200ms,
  stagger ~35ms, **cap 8 items**, solo al montar.
- **M3 · KPI de ingresos** — `tabular-nums`, `$` a menor escala/color (estilo Stripe),
  count-up 450ms (reduced-motion → número final directo).
- **M4 · Confirmación de pago** — micro-éxito calmo (checkmark dibujado ~400ms + el badge
  pasa a "Al día"). Sin confetti/sonido. El recuerdo emocional del producto.
- **M5 · Hover/press** — cards interactivas: `-translate-y-px` + `shadow-card-hover`;
  botones: `active:scale-[0.98]`.
- **M6 · Skeletons** — `loading.tsx` por ruta con **geometría idéntica** al contenido
  (CLS 0). Shimmer suave que se desmonta con la data (no loop perpetuo).
- **M7 · Empty states** — ícono en pastilla (`bg-primary/10`) + copy con alma.

## Reglas de motion (duras)
- Duraciones 150–300ms (salvo skeleton-shimmer, que se desmonta con la data).
- Solo `transform` / `opacity` / `box-shadow` / `color`. **Nunca** animar layout
  (width/height/top/left/margin) → CLS 0 duro.
- **Nada de loops perpetuos** en estado ocioso (el dot del badge no pulsa, los KPI no
  respiran). Sin 3D, parallax, scroll-jacking, glass/blur/glow, page-transitions pesadas.
- Easing premium `--ease-out: cubic-bezier(0.22,1,0.36,1)`.
- `prefers-reduced-motion` → todo a frame final estático (guard global en `globals.css`).

## Sistema (tokens + primitivos)
- **Tokens nuevos** (`globals.css`, aditivos): `--shadow-card/-hover/-raised` cálidas,
  `--surface-sunken` (#f6f1ea), `--dur-fast/base/slow`, `--ease-out/-in-out`, utility
  `transition-base`, guard reduced-motion. Radios: card=`rounded-2xl` (convención vigente
  de la app), control=`rounded-md/lg`, chip/badge=`rounded-full`.
- **Primitivos** (`src/components/ui/`): `Card`, `Button`/`ButtonLink`, `Badge`,
  `EmptyState`, `Skeleton`. Frenan el drift (el "card premium" estaba copiado ~20 veces;
  alturas de botón y radios mezclados). `KpiCard` opcional (P3) si no fuerza el layout.

## White-label (guardrail)
- **Cero color de marca hardcodeado fuera de `--primary` y los semánticos existentes.**
- Sombras/elevación neutras-cálidas (derivadas de `--foreground`), nunca teñidas de
  primary → no se rompen al cambiar el color del estudio.
- El motion es idéntico para todos los estudios (acabado del producto, no del white-label).
- Badge semántico preserva texto en `foreground` (contraste AA), no texto de color.

## Fuera de scope
Rediseño de layout/jerarquía (la estructura es buena), 3D/web-viva, ilustraciones custom,
page-transitions, cambios de palette/tono/copy.

## Criterios de aprobación (binarios)
- [ ] CLS 0 verificado en las 6 resoluciones (skeletons reservan el layout exacto).
- [ ] `prefers-reduced-motion` → todo estático (sin rise, sin count-up, sin shimmer).
- [ ] Cero color hardcodeado fuera de `--primary`/semánticos (probado con un acento
      alternativo y coherente).
- [ ] Ninguna animación > 300ms salvo skeleton-shimmer; ningún loop perpetuo ocioso.
- [ ] Sombras teñidas (marrón del foreground), nunca negro puro.
- [ ] El KPI de ingresos sigue siendo el elemento dominante del dashboard (sin regresión
      de jerarquía).
- [ ] Sin errores de consola.

## Implementación (3 slices, cada uno con visual gate salvo fundación)
- **1J-a · Fundación** — tokens + guard + primitivos (sin aplicar a pantallas). Cat A.
- **1J-b · Migración + profundidad** — migrar las 6 pantallas a los primitivos + sombras
  + radios unificados. Visual gate.
- **1J-c · Motion** — reveals/stagger, hover/press, count-up, confirmación de pago,
  skeletons + `loading.tsx`. Visual gate.

## Owner approval
Estado: approved · approved_by: owner · 2026-06-26 (dirección aprobada en sesión).
