# SYNTRA Creative Library — Motion Patterns

> Patrones de motion permitidos y sus límites. **Bajo la `living-web-doctrine.md`
> (2026-06-23):** se permite 3D real (R3F lazy), fondos vivos por sección y animación
> ligada al scroll. Ante conflicto, manda la doctrina. Consultivo para la forma;
> normativo para los límites.

## Límites globales (no negociables)

```text
sin scroll-jacking (scroll-LINKED sí; secuestrar el control NO)
parallax permitido pero CONTROLADO (sutil, con jerarquía; no mareante)
loops solo si pausan fuera de viewport (sin loops pesados perpetuos)
reduced-motion obligatorio → estado final estático, sin animación
performance primero: CLS 0 (duro) · 3D lazy, no bloquea LCP · pausar fuera de viewport
coherencia por viewport: varios acentos OK si componen UNA escena con jerarquía clara
no animar layout (width/height/top/left); preferir transform/opacity y GPU-friendly
```

Tokens: usar `EASE_PREMIUM` y `DURATION` (de `@/lib/motion`); nunca easings/durations sueltos.
Color en motion: cyan solo para resultado/HECHO; electric para marca/acción.
3D/fondos vivos: cumplir el **norte técnico** de `living-web-doctrine.md` §3 (lazy,
`frameloop="demand"`, fallback mobile, reduced-motion estático).

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
| **Living background** | Campo vivo por sección (Canvas/WebGL/3D) | Fondo de cada sección (1 por sección, distinto) | **Lazy** + pausa fuera de viewport; fallback mobile; reduced-motion estático; CLS 0. |
| **Scroll-linked reveal** | Aparición/transform ligado al progreso de scroll | Entradas de sección, capas, números/títulos | `IntersectionObserver`/`useScroll`; transform/opacity; sin secuestrar el scroll. |
| **Depth parallax (scroll)** | Capas a distinta profundidad según scroll | Escenas-firma, fondos de profundidad | Controlado y sutil; ligado a la escena; nunca mareante; reduced-motion off. |
| **Signature 3D scene** | Objeto/escena 3D real (three/R3F) | Pieza-firma o fondo de profundidad por sección | Norte técnico doctrina §3: lazy, demand, low-poly/shader, fallback, reduced-motion estático. |

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
