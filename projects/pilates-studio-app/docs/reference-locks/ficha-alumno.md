---
section: "ficha-alumno"
status: draft-for-owner-review
approved_by: ""
date: ""
decision: code-first
---

# Reference Lock — Ficha de alumno (admin)

## Objetivo de pantalla
Que el admin vea **todo lo relevante de un alumno en una pantalla** y pueda actuar: estado
financiero, saldo de clases, packs/membresías, historial de pagos y reservas. Es donde el
dueño "resuelve" a un alumno (cobra, asigna pack, revisa deuda).

## Usuario principal
**Dueño / administrador** (no técnico), a menudo en mostrador con el alumno enfrente,
muchas veces desde el celular. Secundario: recepción (Fase 2).

## Problema que resuelve
Hoy el dueño no sabe de un vistazo si el alumno está al día, cuántas clases le quedan o si
debe. Esta ficha centraliza eso y le permite **registrar el cobro en el momento**.

## Información prioritaria (orden)
1. **Estado financiero** (al día / debe / membresía vencida / próximo a vencer).
2. **Saldo de clases** (créditos) y **membresía activa** (con vencimiento).
3. **Acción: registrar pago** / **asignar pack o membresía**.
4. **Historial de pagos** (concepto, monto, método, fecha).
5. **Packs/membresías** (vigentes y vencidos).
6. **Reservas** (próximas + historial; no-shows).
7. Datos de contacto.

## Jerarquía visual
- Encabezado: nombre + **badge de estado financiero** (verde al día / alerta deuda).
- Bloque destacado: **saldo + membresía** y **CTA "Registrar pago"**.
- Secciones/pestañas: Pagos · Packs/Membresías · Reservas.
- Mobile-first (uso en mostrador): lo accionable arriba.

## Componentes esperados
- Badge de estado financiero (derivado de `member_financial_status`).
- Tarjeta de saldo (créditos) + tarjeta de membresía (con vencimiento).
- Botón/modal "Registrar pago" (concepto + monto + método).
- Botón/modal "Asignar pack / membresía" (con vencimiento).
- Tabla/lista de pagos; lista de packs/membresías (vigente/vencido); lista de reservas.

## Estados vacíos
- **Alumno nuevo, sin pagos ni packs:** ficha clara con CTA primario "Registrar primer pago
  / asignar pack"; sin tablas vacías frías.
- **Sin reservas todavía:** "Aún no reservó clases".
- **Sin membresía:** mostrar solo saldo de packs (o "Sin pack activo" + CTA).

## Estados de error
- Falla al registrar pago → no aplicar el beneficio a medias; mensaje claro + reintentar
  (la escritura es transaccional: o se aplica todo o nada).
- Estado financiero no disponible → indicar "no se pudo calcular", no mostrar un estado falso.
- Conflicto de concurrencia (dos cargas a la vez) → resolver server-side; informar resultado.

## Mobile-first
Operable en mostrador desde el celular: estado + saldo + "Registrar pago" arriba, accesibles
sin scroll. Modales de pago simples, con resumen antes de confirmar.

## Versión desktop / admin
Layout de dos columnas (resumen + secciones), historial más extenso visible, búsqueda/
filtros de pagos y reservas. Es la vista de "gestión" completa del alumno.

## Referencias visuales sugeridas
- **CRM liviano** (perfil de cliente claro, no un ERP denso) — claridad tipo
  Pipedrive/Notion-CRM **en simplicidad**.
- Vistas de **estado financiero / saldo de créditos** de apps de membresía/fitness.
  *(Pendiente adjuntar en `assets/`.)*

## Riesgos UX
- **Demasiada info junta** → priorizar estado + saldo + acción; el resto en secciones.
- Confundir crédito (pack) con membresía → distinguirlos visualmente (reglas distintas).
- Registrar pago incorrecto → modal con resumen y confirmación antes de guardar.
- No reflejar el efecto del pago → tras registrar, saldo/estado se actualizan a la vista.
- Mostrar la deuda de forma punitiva → tono informativo, orientado a cobrar/avisar.

## Criterios de aprobación
- [ ] El estado financiero se entiende al abrir la ficha.
- [ ] Saldo de créditos y membresía (con vencimiento) claros y diferenciados.
- [ ] Registrar pago y asignar pack se hacen sin salir de la ficha, con confirmación.
- [ ] Tras registrar un pago, el saldo/estado se actualiza visiblemente.
- [ ] Historial de pagos y reservas legible; estados de reserva claros.
- [ ] Estados vacíos y de error resueltos.
- [ ] Funciona en mobile; marca del estudio, no template genérico.

## Qué NO debe parecer
- ERP/CRM corporativo denso lleno de campos y tablas.
- Panel de fintech frío; glass excesivo; neón IA; look crypto.
- Pantalla saturada donde la acción principal (cobrar) se pierde.

## Qué debe sentirse al usarlo
Resolutivo y humano. "Veo cómo está el alumno y le cobro en 10 segundos." Cálido y
profesional, pensado para un dueño que atiende personas, no para un operador de sistema.

## Riesgos técnicos / performance
- Estado financiero derivado de `member_financial_status` + `credit_ledger`, consistente con
  lo que ve el alumno.
- Registrar pago = escritura sensible (server action/RPC) que aplica pack/membresía y crea
  asientos de ledger en una transacción; nunca insert directo del cliente.
- Carga rápida; sin errores de consola.

## Owner approval
Estado: draft-for-owner-review

<!-- Solo el owner pasa a 'approved'. Mientras esté en draft, no se toca código (Cat B/C). -->
