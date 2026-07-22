---
section: proceso
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-09
decision: asset-first (fotos REALES curadas) + code-first en la mecánica
supersedes: "v1 'La Línea Viva' (cable/tubo 3D emisivo vertical, 2026-06-26) — el cable murió con los fondos cromados en la unificación de atmósferas (PR #79); el eje editorial vertical y el entregable-protagonista sobreviven"
---

# Reference Lock — Proceso v2 ("Escenario evolutivo") — APROBADA E IMPLEMENTADA

> Arquitectura del product-experience-designer (2026-07-09), construida como
> prototipo vivo e iterada con el owner (el crossfade prematuro se corrigió
> con su feedback). Merged en PR #79. Este lock documenta lo aprobado.

## Objetivo comercial (heredado de v1, intacto)

Que un dueño de PyME no técnico sienta en <3s: **"así de claro y ordenado va
a ser trabajar con ellos — y no me dejan solo al final"**. La dimensión
temporal/relacional del método. KPI: confianza → clic a contacto.

## Dirección final — un escenario que evoluciona (murió la dual-card)

- **Desktop (lg+): split sticky.** Izquierda = panel de FOTO enmarcado
  (`aspect-[16/10]`, frame compartido con los paneles de Servicios v5) que
  hace **crossfade entre 4 fotos según el paso activo** + indicador de
  progreso 01-04 (activo en warm, barra llena hasta el activo). Derecha =
  los 4 pasos como **texto editorial SIN cajas**: label `PASO 0X` (electric;
  el activo enciende en warm) · título · body · "Tu parte:" · **RESULTADO
  como hito dorado** (border-l warm + check, no caja).
- **Fotos REALES (asset-first, lección clave):** 4 fotos Unsplash curadas con
  visión — reunión con laptop+libreta / herramienta de diseño UI / código en
  laptop / dashboard de analytics (`public/proceso/proceso-paso-1..4.jpg`).
  3 rondas de assets IA fueron rechazadas antes ("no quiero que suene a IA"):
  para FOTOS, real > generado. Dirección "estudio de desarrollo digital".
- **Detección del paso activo:** IntersectionObserver por bloque con
  `rootMargin: "-30% 0px -68% 0px"` — línea de activación en el TERCIO
  SUPERIOR del viewport. Con la banda centrada, la foto cambiaba antes de
  llegar al paso (feedback owner). Nadie se atenúa: todos los pasos 100%
  legibles siempre; scroll libre, sin hijack.
- **Mobile (<lg):** franjas apiladas — cada paso su foto enmarcada
  (`aspect-video`) + texto, reveal `whileInView` once.
- **Fondo:** `SectionAtmosphere accent="dual"` (atmósfera unificada del
  sitio). El Section SIN `overflow-hidden` (rompería el sticky).
- **Cierre:** CTA relacional editorial (border-t, sin mega-card) — lead +
  body + botón a contacto.

## Paleta (post-sweep): electric #2563eb (labels) · warm #e7c8a0 (activo,
hito RESULTADO, indicador) — el "HECHO cyan" de v1 quedó derogado por la
regla no-violeta/cyan (2026-07-08). Sin excepción de paleta.

## Archivos

- `src/components/sections/workflow-section.tsx` (todo: split sticky, IO,
  crossfade, StepEditorial, indicador, CTA)
- `src/config/site.ts` → `workflow` (steps con needFromYou/result) ·
  `workflowCta` · subtitle "Cuatro pasos…"
- `public/proceso/proceso-paso-{1..4}.jpg` (Unsplash, licencia libre)

## Criterios binarios (verificados en vivo 1920/390 + QA)

- [x] La foto cambia EXACTAMENTE al llegar el lector a cada paso (línea en
      tercio superior), nunca antes.
- [x] Pasos editoriales sin cajas; el RESULTADO lee como hito dorado.
- [x] Fotos reales coherentes con "estudio de desarrollo" (no stock genérico
      ni estética IA).
- [x] Sticky funciona (sin overflow-hidden en ancestros del Section).
- [x] Todos los pasos legibles siempre (sin atenuación por opacity).
- [x] CLS 0 (aspect reservado) · reduced-motion: swap instantáneo sin reveals
      · solo transform/opacity · consola 0 errores · tsc/lint/build ✓.
- [x] Sin cyan/violeta; checks y hitos en warm.

## Owner approval

**Aprobada por el owner en navegador (iteración en vivo del timing del
crossfade), 2026-07-09. Merged PR #79.**

---

## Actualización 2026-07-22 — grilla y CTA (PR #151, #153)

**El cierre perdió su `max-w-5xl`.** Igual que en Servicios: el bloque abre con un
`border-t` —una línea nítida— y centrado a 1024px dentro del Container nacía 32px
corrido respecto del rail de la sección. Ahora arranca donde arranca el contenido.
Ver **[grilla.md](grilla.md)**, la fuente de verdad de anchos, que no existía
cuando se escribió este lock.

**CTA del cierre:** de "Empecemos por entender tu negocio" (33 caracteres, dos
líneas al 85-87% del ancho en 320/360) a **"Quiero empezar"** (14) — decisión del
owner. El anterior además repetía el lead que tiene justo arriba ("El primer paso
es entender tu negocio"), y "Empecemos" a secas quedó descartado porque ya es el
eyebrow de Contacto. El elegido queda en primera persona igual que el cierre de
Servicios, así que los dos cierres de sección hablan con la misma construcción.

El ancho completo del botón **no era una decisión**: lo estiraba el
`align-items: stretch` del `flex-col`. Va con `self-start sm:self-auto` y
`min-h-11`, que fija los 44px de toque sin depender del line-height.

La banda 768-1023 sigue con el layout apilado (foto + texto por paso); el split
sticky arranca en lg como estaba.

### Criterios binarios añadidos

- [x] El cierre nace en el mismo x que el contenido de la sección.
- [x] El CTA entra en una línea a 320px y mide ≥44px de alto.
- [x] El CTA no repite el lead que tiene encima.
