# Biblioteca de gusto del owner (taste board)

> **Para qué existe:** calibrar CON IMÁGENES a agentes y sesiones nuevas. El
> gusto del owner documentado en palabras ("premium", "vivo", "Raycast") causó
> ~20 iteraciones de retrabajo; estas capturas son la referencia concreta.
> **Cómo se usa:** todo agente de diseño (design-director, VQD) y toda sesión
> que arranque trabajo visual LEE estas imágenes con visión antes de proponer.
> **Cómo se mantiene:** cada nuevo APROBADO de sección → captura fresca a
> `aprobado/` (1600px, jpeg q72); cada nuevo RECHAZO con lección → captura a
> `rechazado/` + entrada acá + ítem en `pre-show-checklist.md` si es un patrón.

## `aprobado/` — el estado real del sitio que el owner firmó (2026-07-15)

| Captura | Qué amó (la lección transferible) |
|---|---|
| `hero-1920.jpeg` | Asset cinematográfico de vidrio full-bleed + texto sobre espacio negativo. La "placa de vidrio" del capability rail: UN objeto monolítico ligado al asset por materialidad (no 3 cajitas). |
| `servicios-1920.jpeg` | Paneles imagery-led con renders 3D espectaculares + numerales dorados gigantes. El desbloqueo fue SU referencia (mockups Gemini/ChatGPT). Artefacto grande con marco > objetos chicos flotando. |
| `ejemplos-1920.jpeg` | Demos VIVAS de apps reales (interiores de UI que funcionan, chat que fluye) — mostrar el producto haciendo, no describirlo. |
| `proceso-1920.jpeg` | Fotos REALES (Unsplash) en escenario sticky con crossfade + pasos editoriales SIN cajas + hito dorado. Real > generado para fotografía. |
| `nosotros-1920.jpeg` | Carrusel cilíndrico 3D con cards de espesor físico real y artefactos internos que ACTÚAN (la recomendación se decide, la respuesta llega). Su referencia externa adaptada al lenguaje propio. |
| `contacto-1920.jpeg` | Split image-led: SU foto (dev de noche, lámpara cálida) vertical nativa como fondo del rail + contenido "qué recibís". La arquitectura de luz FIJA (imagen), la vida puntual (brasas). |
| `faq-1920.jpeg` | Atmósfera unificada (base #05070c + auroras térmicas + stardust) — la película continua de fondos que cose todo el sitio. |

**Constantes del gusto:** vidrio + luz + profundidad · electric #2563eb/#60a5fa
+ warm dorado #e7c8a0 sobre navy profundo · motion visible pero calmo ·
materialidad real (render/foto) > simulación CSS · riqueza tipo
Raycast/Aceternity, NUNCA minimalismo editorial ni SaaS genérico.

## `rechazado/` — cómo se ve el error (sobrevivientes; la lista completa de
patrones vive en `pre-show-checklist.md`)

| Captura | Por qué murió |
|---|---|
| `contacto-columnas-3d-ilegible.jpeg` | Fondo 3D additive de alta frecuencia bajo texto: TODO es figura, el peor caso de luminancia muta en el tiempo → ilegible por construcción. La escena "linda" que mata al contenido. |
| `contacto-imagen-recortada.jpeg` | Imagen apaisada forzada en marco vertical: el sujeto mutilado por el crop + zoom borroso por upscaling. El ratio del asset debe nacer para el contenedor. |

**Rechazos sin captura (perdidos, pero el patrón quedó en la checklist):**
orbes con speculars CSS falsos (×2) · mini-card dentro de card · timeline
"qué pasa después" (relleno defensivo) · íconos 3D flotantes en Servicios
(maqueta) · assets IA obvios en Proceso (×3 rondas) · cards 2×2 genéricas ·
composiciones outpaint con "corte al medio" (×3).
