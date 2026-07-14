---
section: contacto
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-14
decision: asset-first
supersedes: "Contacto v2 'campo vivo + núcleo SC' (2026-06-26) y pase intermedio panel 3D columnas (PR #90)"
---

# Reference Lock — Contacto v3 ("Estudio de noche" — panel image-led del owner)

> Documentación POST-aprobación (design-freedom-v2 §4: el OK del owner al prototipo
> vivo fue el gate; este lock registra lo aprobado). Aprobado en navegador el
> 2026-07-14 tras ~10 iteraciones vivas.

## Qué es

La card de Contacto es un split `lg:grid-cols-[minmax(0,33rem)_minmax(0,1fr)]`:

- **Mitad izquierda = panel image-led**: fotografía VERTICAL nativa generada por el
  owner (Gemini/ChatGPT, brief del design-director): desarrollador trabajando de
  noche, laptop con dashboard azul en el tercio inferior, lámpara dorada al medio,
  **mitad superior = pared en penumbra** (zona de calma para el texto). Asset:
  `public/visual-assets/syntra/contacto/panel-vidrio.webp` (687×1024, watermark
  Gemini parcheada con textura propia).
- **Mitad derecha = formulario** (sin cambios de lógica; fix de pérdida de datos e
  iconografía viva de PR #90 vigentes).

## Contenido del rail (PED 2026-07-14 — "qué recibo si escribo")

eyebrow EMPECEMOS → H2 → subtítulo (la promesa; "sin compromiso" vive solo en el
reaseguro del botón) → **micro-heading dorado "QUÉ RECIBÍS"** + 3 entregables
(lectura honesta / recomendación concreta / primer paso sin letra chica) → mailto
con encuadre ("¿Preferís escribir directo?") → privacidad. Todo content-driven en
`site.ts` (`finalCta.deliverables*`, `mailtoLead`).

**Muertes documentadas** (no reintroducir): orbe CSS y orbe 3D con logo · mini-UI
card-en-card · timeline/espina "qué pasa después" · línea "no un bot" · fondo 3D de
columnas de vidrio (GlassSlabs) · capacidades del rail (duplicaban los chips de tipo
de proyecto del propio form).

## Vida (motion) — "la imagen manda, la vida es puntual"

- `panel-vida.tsx` (decider desktop + !reduced-motion) monta `panel-vidrio-3d.tsx`:
  **brasas** R3F ascendiendo (2 capas, determinista, twinkle shader, additive,
  frameloop gateado por useInView, dpr [1,1.5]) + **respiración dorada** CSS/motion
  sobre la luz de la lámpara (solo opacity, 8s).
- Mobile / reduced-motion: la foto sola (poster digno). CLS 0. Nada más brillante
  que el botón Enviar.

## Lecciones técnicas (anti-loop)

1. **El "corte al medio" era geométrico**: una escena APAISADA no puede verse
   completa y llenar un marco VERTICAL; todo relleno no-fotográfico (blur, smear)
   lee como "dos imágenes pegadas". Fix definitivo = asset vertical nativo. No
   volver a intentar composiciones híbridas.
2. **Asset-first del owner**: el desbloqueo volvió a ser su propia referencia
   (lección Servicios v5); el rol del estudio fue el brief técnico del prompt
   (composición para overlay: mitad superior oscura).
3. Caché de imágenes de Next 16 dev vive en **`.next/dev/cache/images`** (variantes
   por Accept: avif/webp/jpeg, TTL 4h). Ante "no se actualiza la imagen": borrar esa
   carpeta + reiniciar server + sesión CLI nueva (`-s=<nombre>`).

## Criterios binarios (verificados en la aprobación)

1. A zoom completo del panel se ven laptop + manos + lámpara ENTERAS; ninguna zona
   del marco parece "rellena" — todo es fotografía. ✓
2. AA sobre el peor caso de luminancia bajo cada bloque de texto (la foto es fija →
   un solo cálculo). ✓
3. Sin cyan/violeta; dorado = lámpara/acentos; electric = interactivo. ✓
4. Vida visible en 5s (brasas/respiración) sin superar el botón Enviar. ✓
5. Mobile/reduced = foto estática, CLS 0, canvas pausado fuera de viewport. ✓
