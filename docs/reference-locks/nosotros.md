---
section: nosotros
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-06
decision: code-first con workflow de VARIANTES VIVAS (aprobación en navegador, en movimiento)
supersedes: "v1 'Núcleo de Principios' (radial+orbe, rechazada 2026-07-02) · v2 'Manifiesto en Voz Alta' (tipográfica, rechazada 2026-07-06 en render real: espacio muerto, escala, apagado, colisiones de ghost words)"
---

# Reference Lock — Nosotros v3 ("Brasa") — APROBADA E IMPLEMENTADA

> Dirección elegida por el owner en el navegador (variantes vivas A/B en
> `/dev/nosotros`, 2026-07-06) e iterada EN VIVO con su feedback hasta el
> "ahora sí me gustó". Este lock documenta la dirección final construida.

## Lecciones que gobiernan este lock (de 2 rechazos previos)

1. **El gusto del owner = riqueza visible** (animaciones, 3D, imágenes, cards
   premium — registro Raycast/Aceternity), NO minimalismo editorial. Memoria:
   `owner-taste-vida-rich-visuals`.
2. **Los gates visuales juzgan prototipos VIVOS en navegador**, nunca solo PNG.
3. **Workflow variantes-vivas:** construir 2+ variantes reales con motion desde
   el minuto uno → el owner elige viendo → se itera en vivo → el lock se firma
   DESPUÉS documentando lo aprobado. (Reemplaza a "lock desde prosa".)
4. Verificar SIEMPRE a 1920 además de 1440/390 (el owner ve 1920).

## Dirección final — "Brasa" (vida por capas)

- **Capa 1 — Atmósfera generada:** imagen AI (Pollinations/Flux) de nebulosa
  cálida sobre navy (`public/backgrounds/nosotros-atmosphere.jpg`, 25KB),
  opacity 0.75 + máscara radial. La sección es **la cálida** de la Home.
- **Capa 2 — Brasas:** canvas de partículas ámbar en deriva ascendente lenta
  (NO interactivas — diferenciadas del campo azul gravitacional de Contacto).
  Pausa por IntersectionObserver; reduced-motion → sin canvas.
- **Capa 3 — Cards premium** (anatomía Raycast/Resend, refs en
  `assets/nosotros-v2/ref-raycast-features.jpeg` y `ref-resend-cards2.jpeg`):
  borde gradiente cenital (p-px) · cuerpo gradiente TRASLÚCIDO + backdrop-blur
  (la atmósfera se filtra) · campo de color propio al pie · icon-tile tintado ·
  spotlight de hover que sigue el cursor EN EL COLOR de la card · lift+sombra.
- **Artefactos visuales por principio** (contenido REAL, no skeletons —
  microcopy content-driven en `site.ts#aboutPillarVisuals`):
  · POSTURA → módulos con ícono+nombre (web·sistema·datos), central flotando
  · CRITERIO → recomendación legible: "Web con turnos online — te sirve hoy" ✓
    vs "App a medida — de más, por ahora" / "E-commerce — todavía no"
  · CERCANÍA → chat real: pregunta del cliente + avatar SC + typing latiendo
  · COMPROMISO → ruta neón: se dibuja → nodo "lanzamiento" → pulso que SIGUE
    viajando → chip "seguimos con vos"
- **Layout:** header editorial izquierda · cards 2×2 con **columnas
  escalonadas** (derecha baja medio paso → costuras diagonales muestran la
  atmósfera) · statement clímax con "SYNTRA" en gradiente warm + subrayado que
  se dibuja.
- **Motion:** reveals escalonados (blur+y, `EASE_PREMIUM`, once) + loops suaves
  gated por `useInView` (flotación, shimmer, typing, pulso). NO scroll-scrub.

## Paleta — excepción declarada (per-card, con semántica de tokens)

Cada card usa SU token de marca con significado literal:
- POSTURA = **electric** #3b82f6 (construcción/web) · CRITERIO = **warm**
  #e7c8a0 (criterio humano) · CERCANÍA = **accent-ai** #6d5dfb (conversación
  viva) · COMPROMISO = **cyan** #38bdf8 (**HECHO/resultado** — "que siga dando
  resultados" es semántica de resultado, uso justificado del token reservado).
Límites: color solo en glows/bordes/artefactos de su card; texto de cuerpo
muted; base slate intacta. Aprobado por el owner en render vivo.

## Archivos

- `src/components/sections/about-section.tsx` (wrapper del contrato de la Home)
- `src/components/marketing/aplicaciones/nosotros/nosotros-section.tsx`
- `.../nosotros/{spotlight-card,pillar-visual,ember-particles,statement-text}.tsx`
- `src/config/site.ts` → `aboutPillars` (+ ghost) · `aboutPillarVisuals`
- `public/backgrounds/nosotros-atmosphere.jpg`

## Criterios binarios (verificados en render vivo 1920 + QA)

- [x] Vida visible: imagen + partículas + loops + hover interactivo (sin 3D
      pesado; WebGL no necesario acá).
- [x] Cards con artefacto de contenido REAL (texto/íconos), cero skeletons.
- [x] Color e identidad propia por card (anatomía Raycast) dentro de tokens.
- [x] Atmósfera visible alrededor/entre/a través de las cards (stagger+blur).
- [x] Diferenciación: brasas ≠ partículas de Contacto; sin orbe; sin clon de
      Proceso; statement clímax se mantiene.
- [x] Honestidad: la recomendación de CRITERIO es ilustrativa (declarada en
      site.ts), sin clientes/métricas inventadas.
- [x] reduced-motion safe (canvas off; framer via MotionConfig user) · loops
      pausan fuera de viewport · solo transform/opacity/pathLength → CLS 0.
- [x] `tsc`/`lint`/`build` verdes · 0 errores de consola · imagen 25KB.

## Owner approval

**Aprobada por el owner en navegador (variantes vivas + 3 iteraciones de
feedback en vivo), 2026-07-06.** Pipeline restante: capturas finales → commit
atómico → PR → merge manual del owner.
