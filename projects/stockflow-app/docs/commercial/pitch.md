# StockFlow — Pitch y posicionamiento

> **Estado:** Fase 0 · Research de mercado con fuentes primarias verificado
> 2026-07-20. Precios en ARS de esa fecha (ajustar al usar).

---

## La línea

**"Tu negocio en una pantalla — y te avisa antes de que pierdas plata."**

Para el kiosquero que hoy cobra con la app de MercadoPago y lleva el stock y el
fiado en la cabeza o en un cuaderno.

## El mapa competitivo

| Competidor | Precio/mes | Qué es | Por qué no le sirve al kiosquero |
| --- | --- | --- | --- |
| Contabilium | $122k–245k +IVA | Back-office pyme (ARCA, multi-CUIT) | 5-10x fuera de rango; foco contable; no es una caja |
| Xubio | $23,1k (débito)–$295k +IVA | Contabilidad + facturación | **Sin POS**: mueve stock por comprobantes; UX de contador |
| Gestión Comercio | $26k | POS de kiosco completo | Windows desktop + SQL Server local; cero mobile |
| TICKX | $50k–100k | POS de kiosco en la nube | Solo browser; sin app instalable ni push |
| Kyte | USD 10–20 | Mobile-first prolijo, con fiado | Sin ARCA ni MP; cobra en dólares |
| MercadoPago Point | comisión por cobro | El statu quo: cobrar + lista de ventas | No gestiona stock, fiado ni vencimientos |

**Amenaza a monitorear:** MP lanzó en México (jul-2025) un POS con inventario sobre
Point Smart. Si llega a Argentina, comoditiza el POS básico → nuestros diferenciales
defendibles son los otros cuatro, no el POS en sí.

## Los diferenciales (huecos que nadie cubre)

1. **Te avisa solo.** Push al teléfono: stock bajo, vence pronto, fiado pasado de
   límite, resumen del día. Cero competidores lo hacen — todos son "entrá y mirá el
   reporte". Es la demo de 10 segundos que cierra la venta.
2. **Tu ganancia real.** Margen por producto a costo de reposición, en vivo. Con
   inflación, el kiosquero "gana" en nominal y pierde al reponer — nadie se lo
   muestra. Incluye remarcado masivo por % (la tarea semanal argentina).
3. **El fiado sin cuaderno.** Cuenta corriente por cliente, pagos parciales, saldo
   siempre exacto. Las apps globales lo ignoran; los desktop lo entierran.
4. **Vencimientos en el bolsillo.** Hoy solo existe en un software Windows de 2010.
5. **Se maneja desde tu teléfono.** Android primero, dark premium, white-label con
   la marca del negocio. El incumbente real es Windows-2010 o el cuaderno. "Si sabés
   usar WhatsApp, sabés usar esto." Sin contador, sin PC, sin manual.

## Pricing (a definir por el owner)

Ventana enorme entre MP (gratis pero no gestiona) y Contabilium ($147k final).
Anclas reales: Gestión Comercio $26k · TICKX $50k · Xubio $23,1k (con trampa
débito). **Sweet spot defendible: $15.000–35.000/mes final, en pesos**, precio
único sin sorpresas. Add-ons posibles: setup asistido (carga de catálogo inicial),
vertical premium (Fase 3).

## Objeciones típicas

- *"Ya cobro con MercadoPago."* — Perfecto: seguí cobrando con MP. StockFlow es lo
  que MP no hace: stock, fiado, vencimientos, ganancia. (Y en Fase 2, el QR de MP
  sale de acá adentro.)
- *"No tengo tiempo de cargar todos los productos."* — No los cargás: escaneás y
  vendés. Lo que no existe se da de alta en 10 segundos y queda para siempre. En
  una semana el catálogo se armó solo. (+ setup asistido si lo quiere ya.)
- *"¿Y si se corta internet?"* — Anotás el monto en un tap cuando vuelve; los
  kioscos del plan piloto nos dicen cuánto duele de verdad antes de construir el
  modo offline completo.
- *"¿Facturás con AFIP?"* — El sistema es de gestión interna; tu facturación sigue
  como hoy. La integración fiscal está en el roadmap.

## A quién le vendemos primero

Kiosco/almacén de barrio con dueño presente y 0-2 empleados, que ya usa el teléfono
para todo. Piloto: 1 negocio conocido, gratis 1 mes a cambio de feedback y de los
datos de dolor (cortes de internet, velocidad de caja). El modelo (white-label +
multi-tenant) escala después a dietéticas y pet shops sin reescribir.
