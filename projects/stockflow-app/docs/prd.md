# StockFlow — PRD (Product Requirements Document)

> **Estado:** Fase 0 · Fuente de verdad del producto. Cambios de scope se documentan acá.

---

## 1. Resumen del producto

StockFlow es una app **white-label de stock y ventas para negocios chicos** —
vertical inicial: **kioscos y almacenes de barrio argentinos**, extensible a
dietéticas y pet shops. Reemplaza el cuaderno y la memoria: POS con escáner de
código de barras, stock que se descuenta solo, fiado como cuenta corriente,
vencimientos con alerta y un dashboard donde el dueño ve su negocio en una pantalla.
Se vende como **SaaS multi-tenant**: SYNTRA provee y mantiene la plataforma; cada
negocio la usa con su propia marca.

**Decisiones fundacionales (owner, 2026-07-20):**

- Nombre: **StockFlow** · carpeta `projects/stockflow-app` (neutro entre verticales).
- Vertical inicial **kiosco/almacén**; modelo adaptable a dietética/pet shop.
- **POS + escáner en MVP** (cámara del teléfono y/o lector USB keyboard-wedge).
- **Vencimientos en MVP** (fecha opcional por ingreso + alertas push, sin lotes).
- **Fiado en MVP** (cuenta corriente por cliente, ledger append-only).
- **Remarcado masivo por % en MVP** (categoría/global → +X% → preview → aplicar).
- **AFIP/ARCA fuera del MVP**: tickets internos no fiscales; el modelo deja hooks
  (`stores.cuit`, `stores.fiscal`, `sales.fiscal`) para una fase futura.
- **MercadoPago en Fase 2**, cuenta propia por negocio (patrón StudioFlow; SYNTRA no
  intermedia fondos). El MVP registra el medio de pago como dato.
- **Online-only en MVP**; cola offline = fase posterior explícita (se instrumentan
  fallos de red desde el día 1 para decidir con datos).
- UI **dark premium** (referencias del owner) + emojis/íconos de color por producto.
- `syntra-scale-security-baseline` aplicada **desde el primer código** (no auditar
  después, como pasó con StudioFlow).

## 2. Usuarios

| Usuario | Descripción | En MVP |
| --- | --- | --- |
| **Dueño (owner)** | Ve todo: dashboard, márgenes, reportes, fiado, config, equipo. También atiende: el POS está a un tap | Sí |
| **Empleado (staff)** | POS primero; fiado / ingreso de mercadería / cierre de turno según **flags de permiso** | Sí |
| **Cliente del negocio** | NO tiene login: el fiado es un ledger interno del negocio | — (portal futuro) |
| **Superadmin (SYNTRA)** | Alta/baja de negocios, soporte, billing | Flag desde 001; panel en fase final |

"Repositor" **no es un rol**: es el permiso `can_receive_stock` del empleado.
Permisos por empleado: `can_sell_on_credit`, `can_apply_discount`, `can_void_sale`,
`can_receive_stock`, `can_see_costs` (default **false**: el empleado ve precio de
venta, nunca costo/margen). Cada venta registra `sold_by`.

## 3. Propuesta de valor

- **Para el dueño:** su negocio en una pantalla (vendido hoy, ganancia real, stock
  bajo, vencimientos, fiado en la calle) y un sistema que **avisa solo** por push
  antes de que pierda plata. Sin PC, sin contador, desde el teléfono.
- **Para el empleado:** una caja más rápida que la calculadora — escanear, cobrar,
  listo.
- **Para SYNTRA:** segundo producto SaaS sobre la fórmula probada de StudioFlow
  (multi-tenant + white-label + ledger + RPCs atómicas), ingresos recurrentes en un
  mercado enorme y mal servido (ver `commercial/pitch.md`).

## 4. Alcance MVP (confirmado)

**POS (staff + owner):** venta por escaneo (cámara/USB), búsqueda y grilla de
"rápidos" (emoji+color), venta por monto libre, alta rápida de producto desde la
caja (nombre + precio, <10 s), medio de pago a 1 tap (efectivo/QR/tarjeta/
transferencia/fiado), anulación según permiso. AC duro: 3 productos cobrados en
**<15 s**, <300 ms por ítem.

**Stock:** ingreso de mercadería (escanear → cantidad → costo → vencimiento
opcional), stock como **ledger append-only** con cache denormalizado, ajustes y
mermas, umbral de stock bajo por producto, multi-código de barras por producto,
**stock negativo permitido por default** (la caja nunca se frena), remarcado masivo
por %.

**Fiado:** clientes (nombre + teléfono), venta a cuenta, pagos parciales, saldo
derivado del ledger, límite opcional con **aviso, no bloqueo**.

**Vencimientos:** fecha opcional por ingreso (sin gestión de lotes), vista "Por
vencer", resolución en 1 tap (vendido / tirar→merma), alerta configurable (default
7 días).

**Dueño:** dashboard (vendido hoy vs promedio, ganancia estimada, desglose por
medio, stock bajo, vence pronto, fiado en la calle, top 5 semana), productos y
categorías, reportes básicos, cierre de caja derivado (por rango + medio de pago),
config (marca white-label, empleados + permisos, umbrales), **push real al
teléfono**: stock bajo, vence pronto, resumen del día, fiado sobre límite.

## 5. Fuera de alcance MVP

- MercadoPago integrado (Fase 2) · AFIP/facturación fiscal (hooks listos, fase
  futura) · proveedores como entidad y órdenes de compra · multi-sucursal · portal
  del cliente de fiado · balanza/pesables y venta a granel (crítico recién en
  dietética) · promos/combos/precios por cantidad · impresora térmica · inventario
  ciego/conteos · cola offline · recordatorios de fiado por WhatsApp (Fase 2, n8n).

## 6. Riesgos de producto (top 5)

1. **Carga inicial del catálogo** (barrera nº 1) → catálogo argentino precargado con
   EAN (fuente a investigar en Fase 0/1E) + alta-en-10s desde el POS ("el catálogo
   se arma solo vendiendo") + setup asistido como servicio pago.
2. **El POS pierde contra "nada"** → lector USB recomendado en el pitch, monto libre
   siempre a un tap, presupuesto de latencia como criterio de aceptación duro.
3. **Online-only con internet de barrio** → reintentos, venta por monto degradada,
   instrumentación de fallos de red desde el día 1 para decidir la cola offline.
4. **Disciplina de datos** (sin costos cargados, el margen miente) → degradar con
   honestidad ("cargá costos para ver tu margen"), nudges, nunca bloqueos.
5. **Inflación** (precios viejos → margen falso → desconfianza) → remarcado masivo
   por % en MVP + alerta "precio sin tocar hace X días" en Fase 2.

## 7. Métrica de éxito del MVP

Un kiosco real opera caja + stock + fiado una semana completa sin volver al
cuaderno, y el dueño recibe al menos un push que le evitó una pérdida (quiebre de
stock o vencimiento). Load test verde (`syntra-scale-security-baseline`) antes del
primer cliente pago.
