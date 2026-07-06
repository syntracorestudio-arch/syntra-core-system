---
section: faq
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-06
decision: code-first · workflow variantes-vivas (aprobación en navegador, 3 iteraciones de feedback en vivo)
---

# Reference Lock — FAQ "Puente térmico" — APROBADA E IMPLEMENTADA

> Dirección "Termoclina/Puente térmico": convergencia independiente de
> `creative-director` (dirección), `ui-ux-designer` (composición) y
> `product-experience-designer` (contenido). Aprobada por el owner en vivo
> (2026-07-06) tras 3 rondas de ajuste (registro de copy, alineación de fondo,
> escala del título, animaciones, costuras).

## Concepto

FAQ = **la transición térmica del recorrido**: entra en el calor residual de
Nosotros (brasas warm) y entrega al campo eléctrico de Contacto. La sección no
decora esa transición — la ejecuta.

## Qué es (implementado)

- **Fondo vivo:** base `#05070c` (empalme EXACTO con Nosotros) → gradiente
  hacia el tono del backdrop de Contacto + banda de entrega final. Calor warm
  arriba que **se retira con el scroll** (scroll-linked, no scrub) · campo
  electric **respirando** abajo · ambos con deriva lateral desincronizada ·
  rescoldo de partículas térmicas (EmberParticles parametrizado: `thermal` —
  color por altura warm→electric — y `densityDivisor`) sesgado al flanco del
  rail · grano.
- **Costura con Contacto:** fade de entrada en `contacto-backdrop.tsx` (el
  campo de partículas ya no arranca en seco).
- **Layout:** split asimétrico — rail izquierdo sticky (heading grande
  `~44px` + **termómetro vivo** con cabezal luminoso cargándose con el scroll
  + microcopy "Lo que respondemos acá, lo sostenemos en la propuesta." +
  **contador de leídas** en cyan con pop + micro-CTA) · columna derecha de items.
- **Item premium:** número índice que se enciende en el color térmico de su
  posición (01 warm … 07 electric, interpolación por índice) · **barra térmica
  lateral** warm→electric al abrir · indicador **+→×** (tile, electric
  interactivo) · glow del color propio al abrir · respuesta con fade+rise ·
  apertura grid-rows (CSS, user-initiated → CLS 0) · **tick CYAN persistente**
  en las leídas (duda resuelta = HECHO, uso semántico del token reservado).
- **Micro-CTA "Escribinos":** pill electric con gradiente + **shimmer**
  recorriéndola cada ~2.5s + glow respirando + hover scale/flecha. Movido del
  subtítulo (donde se desperdiciaba) al pie del rail / pie del stack mobile.

## Contenido (auditoría PED, aprobado por owner)

7 preguntas ordenadas de la objeción más bloqueante a la menor: precio (ya sin
respuesta evasiva: **precio cerrado antes de empezar**) · tiempo · tecnología ·
fit de negocio · qué necesito tener listo · y si no me gusta · post-lanzamiento.
Se eliminó "¿Puedo automatizar…?" (redundante con Servicios). La pregunta de
pago quedó FUERA por decisión del owner. Registro: profesional-medio (sin
"OK/arrancamos/no desaparecemos", sin jerga), voseo de marca intacto, "sin
compromiso" eliminado de esta sección. Copy en `site.ts` (`faqs` + `faqRail`).

## Paleta

Warm = residuo térmico decorativo · electric = interactivo + campo inferior ·
**cyan SOLO en resueltas/contador** (semántica HECHO) · sin excepción de paleta.

## Criterios verificados

- [x] Gramática propia (campo térmico continuo — ni brasas de Nosotros ni
      partículas azules de Contacto clonadas; EmberParticles REUTILIZADO con
      parámetros, no duplicado).
- [x] Costuras invisibles con ambas vecinas (verificado con capturas de borde).
- [x] Cero chevron/acordeón de template; items con anatomía propia.
- [x] Interactividad con memoria (ticks + contador) · scroll-linked sin hijack.
- [x] CLS 0 (grid-rows user-initiated) · reduced-motion (MotionConfig user +
      canvas off + frontera estática) · pausas fuera de viewport (IO del canvas).
- [x] `tsc`/`lint`/`build` verdes · 0 errores de consola · AA (texto sobre
      surface opacas; campo nunca detrás de respuestas).

## Owner approval

**Aprobada en navegador, 2026-07-06** ("Está OK la sección"). Pipeline:
commits atómicos → PR → merge manual del owner.
