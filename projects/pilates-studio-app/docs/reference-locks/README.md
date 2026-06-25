# StudioFlow — Reference Locks

> Locks visuales del proyecto StudioFlow. Siguen la convención SYNTRA
> (`docs/reference-locks/` del repo raíz): antes de tocar código de una pantalla visual
> Cat B/C, debe existir un lock **aprobado por el owner**.

## Estado de los locks

| Pantalla | Archivo | Estado |
| --- | --- | --- |
| Dashboard financiero (admin) | [dashboard-financiero.md](dashboard-financiero.md) | `draft-for-owner-review` |
| Calendario del alumno | [calendario-alumno.md](calendario-alumno.md) | `draft-for-owner-review` |
| Ficha de alumno (admin) | [ficha-alumno.md](ficha-alumno.md) | `draft-for-owner-review` |

## Flujo

```text
draft-for-owner-review  →  (owner revisa y ajusta)  →  approved  →  recién ahí se implementa
```

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
