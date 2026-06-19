---
section: hero
status: draft
approved_by: ""
date: ""
decision: asset-first
---

# Reference Lock — hero

> **DRAFT.** No habilita implementación. Faltan referencias visuales concretas
> aprobadas por el owner (ver "Referencias aprobadas" y "Riesgos / faltantes").

## Objetivo comercial / rol en la landing
Primera impresión y `<h1>` único. Debe vender en ~2s: **SYNTRA crea sistemas
digitales premium para negocios reales**. Es la **pieza-firma** de la marca: la
sección más impactante de la landing (más que Casos). Emoción: premium, viva,
memorable, tecnológica, confiable, sofisticada. KPI: reflejo del valor <2s +
deseo de seguir + clic en CTA primario.

## Referencias aprobadas
**Board de referencia (moodboard, owner elige A1):**
![board](assets/hero-premium-digital-architecture-board.png)
`docs/reference-locks/assets/hero-premium-digital-architecture-board.png`

- **Referencia principal: A1 — Estructura Estratificada** (cuadrante sup-izq del
  board): planos translúcidos de vidrio/plata estratificados, estructura digital
  elegante, luz blanca/plata dominante, masa a la derecha, espacio negativo limpio
  a la izquierda.
- **Inspiración secundaria: A4 — Ensamble Modular** (cuadrante inf-der): solo como
  inspiración de ensamble/precisión/capas ordenadas y profundidad.
- **Descartadas:** A2 — Núcleo Luminoso · A3 — Flujo Arquitectónico (no usar).

> El board es un **moodboard de dirección**, no el asset de producción. El lock
> queda en `draft`: falta generar el **asset final individual** de A1 y que el owner
> lo apruebe (ver "Próximos assets necesarios").

Anti-referencias (en `stash@{0}` y memoria de la sesión, NO aplicar):
- SVG arc (plano, sin wow).
- R3F tube (palo/tubo negro).
- R3F wave field (cintas gruesas/oscuras + cápsulas básicas).
- R3F glass core (objeto oscuro poco visible, fondo apagado).

## Qué se toma de cada referencia
**De A1 (principal):**
- planos translúcidos de vidrio/plata;
- estructura digital elegante;
- sensación de sistema diseñado;
- masa visual a la derecha;
- espacio negativo limpio a la izquierda;
- luz blanca/plata dominante;
- reflejos electric/cyan mínimos como filo;
- estética premium editorial;
- materialidad de alta fidelidad.

**De A4 (solo inspiración):**
- sensación de ensamble modular;
- precisión;
- capas ordenadas;
- lectura de "sistema";
- profundidad arquitectónica.

## Qué NO se toma
- edificio literal · torres verticales tipo skyline · ventanas;
- dashboard · UI · browser mockup · nodos · circuitos;
- tubos negros · waves/cintas protagonistas · cápsulas flotantes;
- orbes/cubos AI;
- estética gamer/crypto;
- exceso de cyan;
- fondo todo azul oscuro.

## Dirección visual elegida
**Premium Digital Architecture — Estructura Estratificada (A1).** Protagonista =
asset visual premium (planos de vidrio/plata estratificados) aprobado antes del
código y compuesto/animado en capas (motion sutil); A4 como inspiración de
ensamble/profundidad. Texto limpio a la izquierda, masa a la derecha, luz
blanca/plata dominante. Code-first descartado como camino del protagonista.

## Decisión asset-first / code-first
**asset-first (image-first), híbrido-capaz.** El protagonista NO se inventa desde
código. Se aprueba el asset/referencia ANTES de codear; el código solo compone y
anima (capas, parallax sutil, reveal, motion premium). Upgrade opcional a 3D
asset-first (`.glb` modelado en herramienta externa) si el owner lo autoriza.

## Signature Palette Exception

**¿Aplica excepción de paleta?** sí

**Justificación:** el Hero es pieza-firma; forzar el 90/10 azul + near-black fue
causa directa de objetos oscuros/apagados. Necesita poder brillar.

**Colores/materiales habilitados:** blanco/luz dominante, plata, vidrio /
translúcidos, reflejos eléctricos, gradientes más ricos, un acento no-azul
controlado (a definir en la referencia aprobada).

**Límites de uso:** electric + blanco dominantes; cyan solo como filo/acento
(no masa, no neón múltiple); un solo acento no-azul máximo; sin arcoíris, sin
glow excesivo, sin partículas/starfield.

**Cómo se mantiene la marca SYNTRA:** base navy/slate del sitio, electric como
estructura, sobriedad y mucho espacio negativo (ancla Linear/Vercel/Stripe).

**Cómo se protege la legibilidad:** scrim/zona de calma para el texto; contraste
AA del H1, subcopy y CTAs garantizado sobre el asset.

Referencia: `docs/creative-library/signature-palette-exception.md`

## Criterios binarios de aprobación
- [ ] El protagonista se lee **premium y luminoso**, NO oscuro/pesado, en screenshot estático.
- [ ] Hay **un** protagonista con foco, borde y masa que balancea el H1 (no textura difusa).
- [ ] Vende el valor en <2s; H1 legible inmediato (LCP rápido).
- [ ] No parece dashboard/chat/browser/nodos/cápsulas/tubos.
- [ ] No parece gamer/crypto/AI-template; no es "todo azul".
- [ ] Excepción de paleta respetada (electric+blanco dominantes, cyan filo, 1 acento máx).
- [ ] Legibilidad AA de H1/subcopy/CTAs sobre el asset.
- [ ] 1920 no desaprovechado; 1024–1279 resuelto; 390/360 con presencia real.
- [ ] reduced-motion = estado final estático; CLS 0.
- [ ] Lighthouse mobile +95 (o explicación clara).
- [ ] El asset protagonista está aprobado por el owner ANTES de implementar.

## Riesgos visuales
Asset stocky/AI-genérico si no se cura; perder "SYNTRA" por sobre-libertad de
paleta; protagonista que compite con el H1 en vez de balancearlo.

## Riesgos técnicos / performance
Above-the-fold: peso del asset (optimizar `.webp`/`.avif`), LCP, motion en capas
sin CLS; si se va a 3D `.glb`: WebGL desktop-only + fallback mobile + DPR cap +
dynamic ssr:false.

## Próximos assets necesarios
El board es moodboard, NO el asset de producción. Falta generar el **asset final
individual** de A1:
```
Premium Digital Architecture — Estructura Estratificada
16:9
masa visual a la derecha
espacio negativo a la izquierda
sin texto · sin logo · sin UI · sin dashboard · sin personas · sin edificio literal
luz blanca/plata dominante · electric/cyan solo como filo · base navy
```
Entregar 3–4 variantes, optimizar a `.webp/.avif`, y que el owner apruebe una
antes de cualquier código. (También: variante 1:1/9:16 para fallback mobile.)

## Owner approval

Estado: draft

<!-- Solo el owner pasa a 'approved'. Pendiente: generar y aprobar el asset final de A1. -->
