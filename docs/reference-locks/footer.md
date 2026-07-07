---
section: footer
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-07
decision: code-first · workflow variantes-vivas (3 iteraciones de feedback en vivo)
supersedes: "Dirección 'Última palabra' con wordmark monumental (construida y descartada por el owner en la iteración 1: sin wordmark gigante, sin ubicación)"
---

# Reference Lock — Footer "Cierre de marca" — APROBADO E IMPLEMENTADO

> Análisis por convergencia de `creative-director` + `product-experience-designer`
> + `ui-ux-designer`; dirección final moldeada por el owner en vivo (v1 wordmark
> → rechazado · v2 columnas → ajustes · v3 aprobada "ahora sí me gustó").

## Concepto final

El cierre de la web viva: el near-black del campo de Contacto **continúa sin
borde duro** (la línea dura era la costura — mismo principio que FAQ→Contacto)
y se apaga en gradiente `#06070d → #04050a`. Footer LLENO con contenido real
(pedido del owner: sin espacios vacíos), sin CTA propio que compita con el
formulario de arriba.

## Qué es (implementado)

- **Grid de 4 columnas** (`footer.tsx`):
  1. **Marca**: logo GRANDE (h-14/h-16, pedido del owner) + frase de cierre de
     IDENTIDAD + redes.
  2. **Secciones**: las 5 anclas del sitio.
  3. **Servicios**: los 3 módulos reales desde `services` (data-driven).
  4. **Contacto**: "Contanos tu proyecto" → form + email (cyan: dato accionable,
     AAA; electric fallaría AA sobre near-black).
- **Redes sociales** (`footer-social.tsx`): Instagram/LinkedIn/WhatsApp/X en
  **colores de marca originales** (gradiente oficial IG vía SVG; X en blanco —
  inversión estándar sobre oscuro). SVG inline con paths de simple-icons (esta
  versión de lucide eliminó los brand icons). **href vacío = ícono visible SIN
  link** con "(próximamente)" accesible — se linkean desde `site.ts` cuando
  existan los perfiles reales. Nunca un link muerto.
- **Barra final**: © + Política de privacidad (movida acá desde la columna
  Contacto, decisión owner).
- **Motion**: cascada de entrada por columna (BlurReveal con delays 0→0.34s) ·
  links de columna con slide sutil + subrayado electric en hover · íconos de
  redes con lift+sombra en hover (activo al linkear) · glow electric
  respirando al pie (`animate-breathe`). reduced-motion cubierto por el sistema.

## Contenido (auditoría PED + decisiones owner)

- **Frase de cierre** (opción A elegida): *"Un estudio, no una agencia.
  Sistemas que tu negocio usa todos los días."* — identidad, eco de la tesis
  de Nosotros; ya no repite el tagline del Hero.
- **Email como puerta humana** en la columna Contacto.
- **Descartado por el owner**: wordmark monumental · línea de ubicación/GMT ·
  crédito dogfooding ("Hecho con nuestro propio sistema").
- **Sin CTA nuevo** (principio PED: el footer cierra, no insiste) — "Contanos
  tu proyecto" es wayfinding de columna, no un botón.

## Criterios verificados

- [x] Costura Contacto→Footer invisible (near-black continuo, sin border-t).
- [x] Footer lleno con contenido 100% real (cero social proof inventado; las
      redes sin perfil se muestran sin link, no simulan existir).
- [x] Logo legible (2x el tamaño anterior).
- [x] Colores de marca de las redes fieles (gradiente IG real).
- [x] Vida: cascada + hovers + glow respirando; sin competir con Contacto.
- [x] A11y: aria-labels/sr-only en redes, AA en links (smoke-2/cyan sobre
      near-black), orden de tabs = DOM.
- [x] `tsc`/`lint`/`build` verdes · 0 errores de consola · CLS 0 (todo en flujo).

## Owner approval

**Aprobado en navegador, 2026-07-07** ("perfecto, ahora sí me gustó").
Al crear los perfiles reales: completar `href` en `siteConfig.socialLinks`.
