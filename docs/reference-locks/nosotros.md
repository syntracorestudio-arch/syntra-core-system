---
section: nosotros
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-13
decision: code-first con workflow de VARIANTES VIVAS (prototipo juzgado y calibrado EN VIVO por el owner en su navegador)
supersedes: "v1 'Núcleo de Principios' (radial, rechazada) · v2 'Manifiesto' (tipográfica, rechazada) · v3 'Brasa' (grid 2×2 de cards premium, aprobada 2026-07-06 — su GRID sobrevive como fallback mobile/reduced-motion; sus tokens violeta/cyan murieron en el sweep 2026-07-09)"
---

# Reference Lock — Nosotros v4 ("Carrusel cilíndrico 3D") — APROBADA E IMPLEMENTADA

> El owner trajo la REFERENCIA él mismo (prompt externo de carrusel 3D de
> tarjetas bancarias) y pidió adaptarlo a los 4 principios. Se construyó como
> prototipo vivo y se calibró EN VIVO con ~10 iteraciones de su feedback
> (tamaño, ritmo, legibilidad, drag). Merged en PR #99 (2026-07-13).
> Lección que gobernó el cierre: el ritmo se calibra con MEDICIÓN REAL, no a
> ojo — ver "Timing" abajo.

## Dirección final — deck cilíndrico vertical (CSS 3D, sin WebGL)

- **Mecánica:** 4 cards (una por principio) en carrusel cilíndrico VERTICAL
  con `perspective: 1350px` + `preserve-3d`. Una card al frente por vez; las
  demás se disuelven (opacity) al salir del arco visible — nunca se ve el
  "viaje" de recirculación (feedback owner). Espesor físico real: 5 slices
  apiladas en Z (dorso con ghost-word + firma, NO texto espejado).
- **Timing (time-based, NO frame-based):** el avance usa `dt` real →
  **ciclo = 5.5s exactos en cualquier monitor**. Bug raíz que costó 4
  iteraciones: el avance por frame corría 2.4× más rápido en monitores de
  144Hz y pisaba las animaciones internas (que van en segundos). La secuencia
  interna dispara al completarse el fade-in de la card (umbral |diff| < 0.46).
- **Interacción:** tilt 3D por mouse con inercia (damping normalizado por dt)
  · **hover = freno con RAMPA** (~400ms, nunca hard-stop; si agarra la card en
  vuelo, un imán completa hasta el reposo) · **drag vertical con click** —
  mapeo LINEAL 1:1 con blend suave hacia el easing magnético (sin latigazos por
  la zona rápida del pow 4.2) + imán a la card más cercana al soltar ·
  `setPointerCapture` blindado.
- **Card (440×372, compacta):** icon-tile tintado + ghost label + contador
  `0X / 04` · título · descripción · **stance** (pull-quote sobria con
  borde-l del tema) · artefacto vivo (PillarVisual) · firma `SYNTRA CORE` ·
  hairline de progreso del dwell al pie (se congela en hover).
- **Artefactos v2 — ACTÚAN al llegar al frente (isFront, re-actúan por
  ciclo):** POSTURA → los módulos se conectan (SVG pathLength) y un dato viaja
  entre ellos · CRITERIO → la recomendación SE DECIDE en vivo (opciones
  neutras → highlight recorre → check dorado + las otras se atenúan a 0.8,
  legibles) · CERCANÍA → la respuesta LLEGA (typing → palabras en stagger,
  burbuja de tamaño fijo) · COMPROMISO → la ruta se dibuja hasta "lanzamiento",
  FRENA, y SIGUE (el stop-and-continue es el mensaje).
- **Copy (tono profesional, sin sonar a IA):** títulos/descripciones/stances
  en `site.ts#aboutPillars` — p. ej. CRITERIO "Te decimos también lo que no
  conviene" / stance "Preferimos recomendar menos y que sea lo correcto".
- **Fallback:** mobile (<lg) y reduced-motion conservan el **grid 2×2 de v3**
  (cards premium con spotlight) — el carrusel es progressive enhancement.

## Paleta (post-sweep no-violeta/cyan 2026-07-09)

`PILLAR_THEME`: POSTURA electric #3b82f6 · CRITERIO warm #e7c8a0 · CERCANÍA
electric claro #60a5fa · COMPROMISO warm #e7c8a0 (resultado = dorado). Cero
violeta/cyan. Atmósfera cálida de fondo (v3) intacta detrás del carrusel.

## Archivos

- `src/components/marketing/aplicaciones/nosotros/nosotros-carousel-3d.tsx`
  (mecánica completa: CYCLE_S, step(), drag, snap, rampa de hover)
- `.../nosotros/pillar-visual.tsx` (artefactos v2 con isFront + secuencias)
- `.../nosotros/nosotros-section.tsx` (decider carrusel/grid)
- `src/config/site.ts` → `aboutPillars` (+stance) · `aboutPillarVisuals`
  (+answer/answeredLabel de cercanía, tags de criterio diferenciados)
- `src/types/index.ts` → `AboutPillar.stance` · visuales de cercanía

## Criterios binarios (verificados en vivo por el owner + QA)

- [x] Una card protagonista por vez; el resto se disuelve (no hay "viaje"
      visible de recirculación ni card de fondo asomando).
- [x] El pase NUNCA interrumpe la historia interna: secuencia completa
      (~4.5s) + beat de lectura antes de que arranque la salida — en
      cualquier refresh rate (time-based).
- [x] Hover frena con rampa suave; drag arrastra sin brusquedad; al soltar
      asienta en una card.
- [x] Textos AA legibles incluso en opciones "apagadas" (Criterio a 0.8).
- [x] Copy profesional sobrio (sin aforismos IA); stance por principio.
- [x] Mobile/reduced-motion = grid v3 completo; CLS 0; solo transform/opacity;
      loop pausado fuera de viewport (IntersectionObserver).
- [x] Sin violeta/cyan; warm = resultado; consola 0 errores; tsc/lint/build ✓.

## Owner approval

**Aprobada por el owner en navegador tras calibración en vivo (tamaño → ritmo
→ medición time-based → legibilidad → drag), 2026-07-13. Merged PR #99.**
