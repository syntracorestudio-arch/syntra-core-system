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

---

## Actualización 2026-07-22 — grilla, tablet y mobile (PR #151, #153)

El criterio *"cierre alineado al ancho del grid"* de este lock se cumplía contra
el grid, pero **no contra el heading de la propia sección**: el cierre vivía en un
`mx-auto max-w-5xl` re-centrado dentro del Container, así que su `border-t` —una
línea nítida— nacía 32px a la derecha del h2. Ese casi-acierto era lo que más se
veía a 1920. Se eliminó el `max-w-5xl` del cierre; ahora la regla arranca exacto
donde arranca el título. Ver **[grilla.md](grilla.md)**.

**El `max-w-5xl` del CARRUSEL se mantiene** (queda +32px respecto del rail): tiene
máscara de fundido en los bordes, así que no se percibe, y sacarlo llevaría las
cards del modo reduced-motion a ~584px rompiendo el balance imagen/texto de la v5.
Es la excepción única y aprobada del sistema de grilla.

**Dos columnas solo desde lg.** Con `sm:grid-cols-2` la columna de texto de la
card (el 64% del panel, el resto es el render) caía a **177px a 640 y 218px a
768** — más angosta que en un teléfono de 390px (348px), con un numeral de 60px y
un h3 de 30px adentro. Encogía para entrar en vez de reorganizarse. Ahora: 367 y 449.

**El render pisaba el texto en mobile.** El scrim de legibilidad está calibrado
para el layout de escritorio, donde el texto vive en el 64% izquierdo: al 70% del
ancho ya es casi transparente. En un teléfono la card mide 342px, no hay lugar
para un lado a lado y el texto ocupa el ancho COMPLETO, así que los bullets caían
sobre la parte brillante del render. Capa de refuerzo solo abajo de sm.

**CTA del cierre:** de "Quiero que me recomienden el mejor módulo" (40 caracteres,
dos líneas al 85% del ancho) a **"Quiero una recomendación"** (24) — decisión del
owner. Regla vigente de CTAs: ancho completo solo para la acción primaria de la
pantalla; los cierres de sección se ajustan al contenido.

### Criterios binarios añadidos

- [x] El cierre nace en el mismo x que el h2 de la sección.
- [x] El texto de la card nunca es más angosto que en un teléfono de 390px.
- [x] En mobile el texto se lee sin que el render compita (revisado con visión a 390).
- [x] Ningún CTA de la sección envuelve a dos líneas a 320px.
