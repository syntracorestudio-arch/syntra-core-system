# SYNTRA Creative Library — Motion Patterns

> Patrones de motion permitidos y sus límites. Subordinado a la skill
> `syntra-premium-motion-system` y a la spec live-system (§7 FROZEN). Consultivo
> para la forma; normativo para los límites.

## Límites globales (no negociables)

```text
sin scroll-jacking
sin parallax agresivo
sin loops pesados
reduced-motion obligatorio → estado final, sin animación
performance primero (CLS 0, opacity/transform only)
1 motion-firma por viewport
pausar/no animar fuera del viewport
```

Tokens: usar `EASE_PREMIUM` y `DURATION` (de `@/lib/motion`); nunca easings/durations sueltos.
Color en motion: cyan solo para resultado/HECHO; electric para marca/acción.

## Patrones permitidos

| Patrón | Qué es | Cuándo usar | Límite |
| --- | --- | --- | --- |
| **One-shot reveal** | Aparición por capas al entrar en viewport | Hero, secciones, escenas | `once: true`; opacity/translate/scale leve; sin repetir. |
| **Floating scene** | Float continuo muy sutil de la escena-firma | 1 sola escena (Hero) | ~±6px, lento; se apaga en reduced-motion. |
| **Hover lift** | Elevación leve en hover de card | Puertas de Servicios, cards | `-translate-y-1` + sombra; transición suave; sin glow agresivo. |
| **Ambient light** | Halo/foco que respira muy lento | 1 por viewport | Opacidad baja; no compite con el contenido. |
| **Background drift** | Deriva lentísima de un gradiente | Excepcional, 1 zona | Imperceptible; jamás a pantalla completa con canvas. |
| **Card fan** | Despliegue escalonado de cards | Reveal de un set (Servicios/Casos) | Stagger corto; no más de ~3-4 items perceptibles. |
| **Product layer parallax** | Capas de la escena a distinta profundidad | Pieza-firma | Sutil, ligado a la escena, **no** al scroll de página. |
| **Active-to-done** | Transición PENDIENTE→ACTIVO→HECHO | Flujos/escenas de sistema | Cyan solo en HECHO; un ciclo por viewport, no loop perpetuo. |

## Criterio de aceptación de motion

Antes de sumar cualquier animación, debe responder sí a:

```text
¿Comunica algo del producto o solo decora?
¿Respeta reduced-motion con un estado final claro?
¿Mantiene CLS 0 y usa solo opacity/transform?
¿Es la única motion-firma del viewport?
¿Se puede sacar sin perder mensaje? (si sí → sacar)
```

Si una animación no pasa este filtro, no va.
