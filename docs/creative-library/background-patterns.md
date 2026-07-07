# SYNTRA Creative Library — Background Patterns

> ⚠️ **Nota V2 (2026-07-07):** las advertencias de "cliché a evitar" de este catálogo
> quedaron superseded por `design-freedom-v2.md` — auroras/beams/grids son material
> legítimo (shippeamos auroras aprobadas). El catálogo sigue útil como recetario.


> Tipos de fondo admitidos y su uso. Consultivo + normativo de coherencia.
>
> **Regla de oro:** No usar el mismo tipo de background en todas las secciones.
> Cada sección merece su propio campo visual; la repetición es lo que hace que la
> landing se lea "IA genérica". Máximo 1 foco de luz por viewport.

| Patrón | Cuándo sirve | Cuándo NO | Riesgos | Sección donde podría aplicar |
| --- | --- | --- | --- | --- |
| **Ambient gradient** | Base sobria para dar profundidad sin ruido | Si tapa el contenido o satura de azul | Monotonía si se repite igual | Hero, Contacto |
| **Soft beams** | Un haz sutil que guía el ojo a la pieza-firma | Beams que explotan/colisionan/decorativos | Cliché si son protagonistas | Hero (1, muy tenue) |
| **Spotlight** | Enfocar una escena/objeto concreto | Como efecto de hover en todo | Teatral si es fuerte | Hero, Casos destacados |
| **Animated grid** | Casi nunca | En cualquier fondo amplio | "Grilla azul en toda la landing" = anti-patrón | (evitar; a lo sumo micro-zona técnica) |
| **Noise texture** | Romper banding en gradientes oscuros | Si agrega grano visible | Sucia a baja densidad mal hecha | Cualquiera, muy sutil |
| **Floating glow** | Halo detrás de una escena de producto | Múltiples glows compitiendo | "Glow por glow" genérico | Hero, Sistema (1) |
| **Gradient mesh** | Campo de color suave y diferenciado por sección | Si se vuelve aurora cliché | Recargado en mobile | Servicios, Sistema (distinto al Hero) |
| **Background paths** | Líneas que conectan piezas **con significado** | Líneas decorativas sin función | Vuelve a "nodos" si abstrae de más | Sistema (conexión) |
| **Aurora** | Rara vez; solo si la marca lo pide | En SYNTRA, casi siempre | Es el cliché #1 a evitar | (evitar) |
| **3D object background** | Pieza-firma única que ES el mensaje | Como decoración o en varias secciones | Performance + "3D sin función" | Hero (diferido, con aprobación) |
| **Section-specific visual field** | **Preferido**: cada sección con su identidad de fondo | — | Requiere intención de diseño | Todas (uno distinto por sección) |

## Mapa anti-repetición (ejemplo de diferenciación)

```text
Hero      → ambient gradient + 1 floating glow tenue detrás de la escena
Servicios → superficie elevada (depth-raised), sin glow; profundidad por las cards
Sistema   → background paths con significado (conexión) + glow mínimo
Casos     → spotlight puntual sobre la escena del rubro
Contacto  → ambient gradient sobrio, distinto al del Hero
```

El objetivo: que al scrollear se **sienta el cambio de sección**, no un mismo campo
azul continuo. Si dos secciones contiguas comparten fondo, cambiar una.
