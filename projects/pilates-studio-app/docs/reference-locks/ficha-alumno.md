---
section: "ficha-alumno"
status: draft-for-owner-review
approved_by: ""
date: ""
decision: code-first
---

# Reference Lock — Ficha de alumno (admin)

## Objetivo de pantalla

Que el admin vea **todo lo relevante de un alumno en una pantalla** y pueda actuar:
su estado financiero, su saldo de clases, sus packs/membresías, su historial de pagos y sus
reservas. Es donde el dueño "resuelve" a un alumno (cobra, asigna pack, revisa deuda).

## Información principal (en orden de prioridad)

1. **Estado financiero** (al día / debe / membresía vencida / próximo a vencer).
2. **Saldo de clases** (créditos disponibles) y **membresía activa** (si tiene, con
   vencimiento).
3. **Acción: registrar pago** / **asignar pack o membresía**.
4. **Historial de pagos** (concepto, monto, método, fecha).
5. **Packs/membresías** (vigentes y vencidos).
6. **Reservas** (próximas + historial; no-shows).
7. Datos de contacto.

## Jerarquía visual

- Encabezado: nombre + **badge de estado financiero** (color claro al día / alerta deuda).
- Bloque destacado: **saldo + membresía** y **CTA "Registrar pago"**.
- Pestañas o secciones: Pagos · Packs/Membresías · Reservas.
- Mobile-first (el admin también opera desde el celular en mostrador): lo accionable arriba.

## Componentes esperados

- Badge de estado financiero (derivado de `member_financial_status`).
- Tarjeta de saldo (créditos) + tarjeta de membresía (con vencimiento).
- Botón/modal "Registrar pago" (concepto + monto + método).
- Botón/modal "Asignar pack / membresía" (con vencimiento).
- Tabla/lista de pagos.
- Lista de packs/membresías con estado (vigente/vencido).
- Lista de reservas (estado: booked/attended/cancelled/no_show).

## Riesgos UX

- **Demasiada info junta** → priorizar estado + saldo + acción; el resto en secciones.
- Confundir crédito (pack) con membresía → distinguirlos visualmente (son reglas distintas).
- Registrar un pago incorrecto sin confirmación → modal claro con resumen antes de guardar.
- No reflejar el efecto del pago → tras registrar, saldo/estado se actualizan a la vista.
- Mostrar deuda de forma punitiva → tono informativo, orientado a la acción (cobrar/avisar).

## Criterios binarios de aprobación

- [ ] El estado financiero del alumno se entiende al abrir la ficha.
- [ ] Saldo de créditos y membresía (con vencimiento) son claros y diferenciados.
- [ ] Registrar un pago y asignar un pack se hacen sin salir de la ficha, con confirmación.
- [ ] Tras registrar un pago, el saldo/estado se actualiza visiblemente.
- [ ] Historial de pagos y reservas legible; estados de reserva claros.
- [ ] Funciona en mobile; marca del estudio, no template genérico.

## Riesgos técnicos / performance

- Estado financiero derivado de `member_financial_status` + `credit_ledger` → consistente
  con lo que ve el alumno.
- Registrar pago = escritura sensible (server action/RPC) que aplica pack/membresía y crea
  asientos de ledger en una transacción; nunca insert directo del cliente.
- Sin errores de consola; carga rápida.

## Owner approval

Estado: draft-for-owner-review

<!-- Solo el owner pasa a 'approved'. Mientras esté en draft, no se toca código (Cat B/C). -->
