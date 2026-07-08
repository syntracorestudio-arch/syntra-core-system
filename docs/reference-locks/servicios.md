---
section: servicios
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-08
decision: asset-first (renders 3D generados y aprobados antes de componer) + prototipo vivo
---

# Reference Lock — Servicios v5 ("Showcase imagery-led")

> **Documentación POST-aprobación** (design-freedom-v2 §4): el owner aprobó el
> prototipo VIVO en su navegador el 2026-07-08. **Referencia visual fuente: mockups
> propios del owner** (generados con Gemini/ChatGPT) — paneles liderados por render 3D,
> numerales gigantes dorados, bordes con glow. Este lock registra lo aprobado.

## Qué es la sección

- Heading: eyebrow "Servicios modulares" · título **"Cuatro módulos, un solo sistema"**
  · subtitle "Cada módulo funciona solo y genera valor desde el primer día…".
- **Grid 2×2 de paneles imagery-led** (los 4 módulos en orden pipeline: web → asistentes
  IA → automatizaciones → paneles), sobre el fondo 3D del arco (escena-firma, intacta).
- Cierre: **CTA consultivo** full-width sin card ("¿No sabés por dónde empezar?" +
  botón "Quiero que me recomienden el mejor módulo"), alineado al ancho de las cards.
- **Catálogo 4↔4 con Ejemplos**: Panel de gestión es 4º módulo contratable
  (decisión owner 2026-07-08; también sumado a `projectTypeOptions`/`PROJECT_TYPES`
  del form de contacto — aditivo, sin migración).

## Anatomía del panel (aprobada)

- `min-h-[22rem] lg:min-h-[26rem]`, `rounded-2xl`, fondo navy `#0a0e14`, borde+glow del
  color de rol que intensifica al hover; hover `y:-6`.
- **Render 3D protagonista** en el 62% derecho, `object-contain` (imagen COMPLETA, el
  navy del asset funde con el panel), máscara de fundido a la izquierda + scrim de
  legibilidad; zoom sutil al hover.
- Contenido: **numeral gigante warm dorado** (01-04) · título grande · **blurb** corto
  (campo nuevo, sin truncado) · 3 features con dot del rol · **CTA pill** "Lo quiero
  para mi negocio →" (#contacto).
- SIN conector central (el núcleo/circuito se probó y se descartó: quedaba aislado).
- SIN bloque de síntomas "por dónde empezar" (redundante con los CTA por card).

## Assets (asset-first — `public/servicios/`)

`modulo-web.jpg` (torre de paneles de vidrio) · `modulo-ia.jpg` (robot blanco de ojos
dorados) · `modulo-automatizacion.jpg` (engranaje cromado con núcleo ámbar) ·
`modulo-panel.jpg` (base de vidrio con barras holográficas). Estilo consistente:
vidrio/cromo, electric+warm, fondo navy, sin texto. Generados con Pollinations
(prompts con "no text"; regenerar cualquiera manteniendo el estilo si se itera).

## Reglas vigentes que este lock hereda

- **Sin violeta/cyan** (roles.ts: web #2563eb · ia #e7c8a0 · automation #d97706 ·
  panel #60a5fa · warm dorado para numerales/éxito).
- CLS 0 (alturas reservadas; hover solo transform) · reduced-motion safe · AA con scrim
  · `next/image` con sizes · content-driven (services/blurb/essentials en site.ts).

## Historial de direcciones descartadas (anti-loop: NO volver sin referencia nueva)

Diagrama de nodos (íconos planos → miniaturas reales → orbes 3D "Reactor" → íconos 3D)
· grid de MagicCards de texto · índice tipográfico sin imagen. Diagnóstico registrado:
objetos chicos flotando sobre el arco leen "maqueta"; cards de solo texto = cliché de
estudio; lo que funciona = **artefacto grande con marco + imagen espectacular** (misma
mecánica de percepción que Ejemplos). La conexión entre módulos se DEMUESTRA en
Ejemplos, no se dibuja en Servicios.

## Criterios binarios (verificados en la aprobación)

- [x] Los 4 renders se ven COMPLETOS (object-contain, sin recortes).
- [x] Blurbs sin puntos suspensivos; oferta escaneable sin clicks.
- [x] Cero violeta/cyan; numerales warm dorado.
- [x] Nada flotando entre paneles; cierre alineado al ancho del grid.
- [x] tsc · lint · build verdes · 0 errores de consola · verificado a 1920 y 390.
