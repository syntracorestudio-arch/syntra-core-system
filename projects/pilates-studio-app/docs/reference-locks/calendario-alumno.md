---
section: "calendario-alumno"
status: draft-for-owner-review
approved_by: ""
date: ""
decision: code-first
---

# Reference Lock — Calendario del alumno

## Objetivo de pantalla

Que el alumno **encuentre y reserve su clase en 2 toques** desde el celular, viendo de un
vistazo qué horarios tienen lugar y cuáles están llenos. Es la pantalla más usada del
producto y la cara del flujo de reserva.

## Información principal (en orden de prioridad)

1. **Clases de la semana** organizadas por día.
2. **Cupo en vivo** por clase (ej. "6/8" o "Lleno").
3. **Hora + nombre de la clase** (+ instructor si aplica).
4. **Estado de mi saldo** (acceso visible: "te quedan N clases").
5. Acción primaria: **Reservar** / **Lista de espera** (si está llena).

## Jerarquía visual

- Mobile-first: navegación por **día** (tabs/scroll horizontal de días), lista vertical de
  clases del día seleccionado.
- Cada clase = fila/tarjeta con hora destacada, nombre, cupo y CTA.
- El **cupo** debe leerse al instante (color/indicador para "lleno" vs "con lugar").
- Saldo accesible sin tapar la agenda (header o acceso a "Mi saldo").

## Componentes esperados

- Selector de día / semana.
- Tarjeta de clase (hora · nombre · instructor · cupo · CTA).
- Badge de estado de cupo (con lugar / pocos lugares / lleno).
- Botón Reservar y botón "Unirme a lista de espera".
- Indicador de saldo / membresía.

## Riesgos UX

- **Demasiada densidad** en mobile → mostrar un día a la vez, no toda la semana apretada.
- Cupo poco claro → estado visual inequívoco para "lleno".
- Reservar por error → confirmación ligera; mostrar el costo en créditos ("usa 1 clase").
- No comunicar **por qué no puede reservar** (sin saldo / deuda) → mensaje claro + CTA.
- Que parezca un **calendario genérico** → diseño cálido del rubro boutique, marca del estudio.

## Criterios binarios de aprobación

- [ ] Reservar una clase con lugar toma ≤ 2 toques desde la agenda.
- [ ] El cupo (con lugar / lleno) se entiende sin leer texto fino.
- [ ] Si está llena, el camino a lista de espera es obvio.
- [ ] El alumno ve su saldo/estado sin salir del flujo.
- [ ] Si no puede reservar (deuda/sin crédito), el motivo y el siguiente paso son claros.
- [ ] Fluye bien en mobile (360–390 px); marca del estudio, no genérico.

## Riesgos técnicos / performance

- Cupo "en vivo": refrescar al entrar y tras reservar; evitar mostrar dato desactualizado
  que lleve a intento de sobrecupo (la validación dura es server-side igual).
- Carga rápida de la semana; paginar/limitar a ventana visible.
- Reduced-motion safe; sin errores de consola.

## Owner approval

Estado: draft-for-owner-review

<!-- Solo el owner pasa a 'approved'. Mientras esté en draft, no se toca código (Cat B/C). -->
