# StudioFlow — Reference Locks

> Locks visuales del proyecto StudioFlow. Siguen la convención SYNTRA
> (`docs/reference-locks/` del repo raíz): antes de tocar código de una pantalla visual
> Cat B/C, debe existir un lock **aprobado por el owner**.

## Estado de los locks

| Pantalla | Archivo | Estado |
| --- | --- | --- |
| Dashboard financiero (admin) | [dashboard-financiero.md](dashboard-financiero.md) | `approved` (owner · 2026-06-25) |
| Calendario del alumno | [calendario-alumno.md](calendario-alumno.md) | `approved` (owner · 2026-06-25) |
| Ficha de alumno (admin) | [ficha-alumno.md](ficha-alumno.md) | `approved` (owner · 2026-06-25) |
| Crear / gestionar clases (admin) | [crear-gestionar-clases.md](crear-gestionar-clases.md) | `approved` (owner · 2026-06-26) |

## Flujo

```text
draft-for-owner-review  →  candidate-for-owner-review  →  (owner aprueba)  →  approved  →  recién ahí se implementa
```

> Estado actual: **`approved`** (owner · 2026-06-25). Los 3 locks tienen
> `## Visual Reference Direction` (fundamentada con `ui-ux-pro-max` como apoyo) **y un
> wireframe SVG propio low-fi** en `assets/`, revisados y aprobados por el owner. Quedan
> **habilitados para implementar en Fase 1** bajo el visual gate (qa-performance-guard +
> visual-quality-director + OK del owner sobre el resultado en navegador).
>
> 📋 **Propuesta visual consolidada por pantalla:** [concept-boards.md](concept-boards.md)
> (boards textuales para revisión del owner).
>
> 🖼️ **Wireframes de referencia (propios, low-fi, sin imágenes externas):**
> [dashboard](assets/dashboard-financiero-wireframe.svg) ·
> [calendario](assets/calendario-alumno-wireframe.svg) ·
> [ficha](assets/ficha-alumno-wireframe.svg).

- **No se diseña el visual final en Fase 0.** Estos locks definen objetivo, información
  principal, jerarquía, componentes esperados, riesgos UX y criterios de aprobación.
- Una referencia visual concreta (screenshot/moodboard/wire) se adjunta antes de pasar a
  `approved` (van en `assets/` de esta carpeta).
- Mientras un lock esté en draft, **no se toca el código** de esa pantalla (Cat B/C).
- Validación final: `visual-quality-director` (visual gate) + aprobación del owner antes de
  commitear la UI.

## Estética de referencia (dirección general, no final)

- **Premium pero simple**, mobile-first. Inspiración de claridad tipo Linear / Stripe
  dashboard, sin ser genérico SaaS ni "glass" excesivo.
- Legible, espacioso, jerarquía clara. La marca visible es la del **estudio** (color
  primario configurable por tenant), no la de SYNTRA.
- App **utilitaria**: nada de 3D/"web viva" (eso es doctrina de la web de SYNTRA, no de esta
  app). Motion sutil y funcional.

## Sistema visual StudioFlow (baseline compartida)

> Fundamentada con `ui-ux-pro-max` (apoyo consultivo) y traducida a decisiones propias.
> Las 3 pantallas comparten esta baseline; cada lock detalla su aplicación.

**Estilo:** **"Soft UI Evolution"** — superficies claras, **sombras suaves** (más suaves
que flat, más claras que neumorphism), bordes sutiles, profundidad ligera. Light mode.
WCAG AA+. Es lo opuesto al panel fintech denso y al glass excesivo.

**Color (clave white-label):** la app **no fija un color de marca** — cada estudio aporta el
suyo. Se define:
- **Lienzo neutro cálido**: off-white / arena / piedra (no blanco clínico ni gris azulado
  frío). Texto en gris cálido oscuro (no negro puro).
- **Acento configurable por estudio** (`studios.branding`): un color cálido por defecto
  (terracota suave / salvia / arena tostada) que cada estudio reemplaza. Se usa con mesura
  (CTAs, énfasis), no inundando la pantalla.
- **Colores semánticos de estado** (consistentes entre estudios, independientes del acento):
  verde sobrio = al día / con cupo · ámbar = por vencer / pocos lugares · rojo suave (no
  alarmante) = deuda / lleno · neutro = inactivo. El color **nunca** es el único indicador
  (siempre + texto/ícono → accesibilidad).

**Tipografía:** humanista, amable pero profesional. Recomendado: **Plus Jakarta Sans**
(títulos y UI; alternativa moderna a Inter, cálida y clara) + cuerpo en la misma familia o
**Nunito Sans**. Evitar fuentes condensadas atléticas (demasiado "gym") y display
infantiles/redondas en exceso. Body ≥ 16px en mobile.

**Iconografía:** set único (Lucide), trazo medio, tamaño consistente; **nunca emojis** como
íconos.

**Motion:** micro-interacciones 150–300ms (color/opacity/transform), `prefers-reduced-motion`
respetado, sin layout shift. Skeletons en cargas.

**Principios transversales:** mucho aire/espaciado, jerarquía por tamaño y peso (no por
saturación), tarjetas antes que tablas densas, lenguaje del rubro (alumnos/clases/packs/
pagos — no "usuarios/items/transacciones"), tono cálido y humano.
