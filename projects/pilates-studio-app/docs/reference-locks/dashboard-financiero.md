---
section: "dashboard-financiero"
status: draft-for-owner-review
approved_by: ""
date: ""
decision: code-first
---

# Reference Lock — Dashboard financiero (admin)

## Objetivo de pantalla

Que el dueño entienda **el estado de su negocio en 5 segundos** al abrir la app: cuánto
entró, quién debe, qué tan llenas están las clases y qué vencimientos se vienen. Es la
pantalla-ancla de la venta (el "wow" del pitch) y el home del admin.

## Información principal (en orden de prioridad)

1. **Ingresos del mes** (número grande) + ingresos totales (secundario).
2. **Alumnos con deuda** (cantidad + acceso a la lista).
3. **Ocupación** (de hoy / de la semana).
4. **Membresías vencidas / próximas a vencer.**
5. **Packs vendidos / clases sueltas vendidas** (mes).
6. **Próximas clases de hoy** (acceso rápido a anotados).
7. (Fase 2+) cancelaciones y no-shows.

## Jerarquía visual

- Fila superior: **KPIs financieros** (ingresos del mes destacado).
- Banda de **alertas accionables**: deuda, membresías vencidas/por vencer (lo que requiere
  acción del dueño).
- Bloque de **operación de hoy**: próximas clases + ocupación.
- Mobile-first: KPIs apilados, lo financiero primero; en desktop, grilla de tarjetas.

## Componentes esperados

- Tarjetas KPI (valor + etiqueta + variación opcional).
- Lista compacta de "alumnos con deuda" (nombre + monto/estado + CTA "ver ficha").
- Indicador de ocupación (barra o ratio reservado/cupo).
- Lista de "clases de hoy" (hora + nombre + anotados/cupo).
- Filtro de período (mes actual por defecto).

## Riesgos UX

- **Sobrecargar de números** → priorizar 4-5 KPIs; el resto, secundario o en su sección.
- Mezclar lo informativo con lo accionable → separar alertas (requieren acción) de métricas.
- Que parezca un **dashboard genérico de SaaS** → usar la marca del estudio, lenguaje del
  rubro ("clases", "alumnos", "packs"), no "items/usuarios/transacciones".
- Datos vacíos (estudio nuevo) feos → diseñar estados vacíos con onboarding.

## Criterios binarios de aprobación

- [ ] Los ingresos del mes se leen como dato dominante sin scroll.
- [ ] La deuda y los vencimientos son visibles y accionables (llevan a la ficha/lista).
- [ ] La ocupación del día es comprensible de un vistazo.
- [ ] Funciona y se entiende en mobile (360–390 px) sin perder los KPIs clave.
- [ ] Usa la marca del estudio (color primario configurable), no la de SYNTRA.
- [ ] No parece template SaaS genérico (lenguaje y composición del rubro).

## Riesgos técnicos / performance

- Las métricas salen de agregaciones (`payments`, vista `member_financial_status`,
  ocurrencias) → cuidar consultas; considerar materialización/caché si crece.
- Cálculo de ingresos/deuda **server-side** y consistente con `credit_ledger`/`payments`.
- Sin errores de consola; carga rápida en mobile.

## Owner approval

Estado: draft-for-owner-review

<!-- Solo el owner pasa a 'approved'. Mientras esté en draft, no se toca código (Cat B/C). -->
