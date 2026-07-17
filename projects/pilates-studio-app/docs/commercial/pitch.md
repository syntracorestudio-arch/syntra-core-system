# StudioFlow — Pitch comercial (v2)

> **Estado:** 2026-07-17 · Producto **construido y validado** (no roadmap): reservas,
> cobranza, pagos online MercadoPago end-to-end, push al teléfono, multi-rol completo.
> Precios tentativos (mercado argentino), a confirmar por el owner.

---

## Propuesta comercial (1 frase)

**"Tu estudio con su propia app: tus alumnos reservan solos y les avisa al teléfono,
la plata del cobro online entra directo a TU MercadoPago, y vos ves en tiempo real
quién pagó, quién debe y cuánto ganás — sin planillas ni perseguir gente por WhatsApp."**

## El problema del dueño

Un estudio boutique se gestiona hoy con **Excel + WhatsApp + memoria**:

- Sobrecupos o clases vacías porque nadie sabe cuántos lugares quedan.
- "¿Hay lugar mañana?" por WhatsApp, todos los días, a toda hora.
- Perseguir pagos: "¿me transferiste?", "se te venció el pack".
- Cero foto del negocio: cuánto entró, cuánto se gastó, si el mes dio ganancia.
- Un lugar se libera a las 22 h y queda vacío porque nadie se enteró.

## Qué es StudioFlow (todo construido, hoy)

Una app **con la marca del estudio** (nombre, logo y color propios) con cuatro
experiencias distintas:

- **Alumno** (celular, instalable como app): reserva en 2 toques, ve su saldo,
  cancela con reglas claras, compra packs online, sigue su progreso.
- **Instructor**: su agenda, sus alumnos, asistencia en un toque, sus números del mes.
- **Recepción**: el día de hoy, check-in de llegada y cobro rápido en mostrador.
- **Dueño**: dashboard con ingresos, egresos, **rentabilidad**, ocupación, deuda,
  reportes de 6 meses y configuración total (precios, políticas, marca, equipo).

## Los 7 diferenciales que la competencia no tiene

1. **Avisos que llegan al teléfono como WhatsApp** 📲 — burbuja real (con la app
   cerrada): "se liberó un lugar y tu reserva se confirmó", "recibimos tu pago",
   "feliz cumpleaños". Sin costo por mensaje, sin WhatsApp Business.
2. **Lista de espera 100% automática** — se libera un lugar → sube solo el primero
   con saldo, le avisa al teléfono y su reserva queda confirmada. Configurable por
   estudio (hasta el inicio / hasta la ventana / manual). **Cero trabajo del dueño:
   pensada para estudios sin recepcionista.**
3. **Mi entrenamiento (el "Strava del estudio")** — el alumno ve su racha de semanas,
   se pone un objetivo mensual, mira su tendencia, sus horas entrenadas y un análisis
   de sus propios datos. Fideliza: la constancia se vuelve un juego.
4. **Cumpleaños automático** 🎂 — el día del cumple, la app saluda al alumno al
   teléfono con la voz del estudio; recepción y el instructor lo ven para saludar en
   persona. Detalle humano que ningún sistema local tiene.
5. **La plata entra directo a TU MercadoPago** — SYNTRA no intermedia fondos ni cobra
   % de tus ventas. Conectás tu cuenta una vez y el pack se acredita solo cuando el
   pago se aprueba.
6. **Control financiero real** — no solo ingresos: egresos por categoría, tarifas del
   equipo (por clase / semana / mes) con pago sugerido calculado de las clases
   dictadas, y **resultado del mes** (ganancia, no solo facturación).
7. **White-label real** — el alumno ve "la app de SU estudio". Color de marca
   aplicado en vivo, logo propio, instalable en el teléfono con su ícono.

## Beneficios en una línea cada uno

- ✅ Cero sobrecupos · ✅ Cero "¿hay lugar?" por WhatsApp · ✅ Lugares liberados que se
  ocupan solos · ✅ Menos deuda (reserva atada al saldo + cobro online) · ✅ La foto
  del negocio en una pantalla · ✅ Alumnos más constantes (racha + objetivo + avisos)
  · ✅ Imagen profesional que justifica precios premium.

## Paquetes tentativos

| Paquete | Incluye | Estado |
| --- | --- | --- |
| **Setup inicial** (único) | Alta del estudio, carga de clases/packs/precios, branding, capacitación de 1 h | Disponible |
| **Starter** (mensual) | TODO lo core: reservas, cupos, waitlist automática, packs/membresías, cobranza manual, push al teléfono, Mi entrenamiento, cumpleaños, multi-rol, dashboard financiero | Disponible |
| **Studio Pro** (mensual) | Starter + **cobro online MercadoPago** (cuenta propia) + egresos/rentabilidad + reportes avanzados | Disponible |
| **SYNTRA Managed** (mensual) | Pro + automatizaciones a medida (recordatorios WhatsApp/email, campañas) + soporte prioritario | Add-on por cliente |

> La automatización de mensajería externa (n8n) se vende como servicio aparte por
> cliente — decisión del owner 2026-07-16.

## Objeciones frecuentes

| Objeción | Respuesta |
| --- | --- |
| *"Ya me arreglo con Excel/WhatsApp."* | Hasta que un sobrecupo o un lugar vacío te cuesta plata. StudioFlow te devuelve las horas de WhatsApp y te muestra la ganancia del mes sin calcular nada. |
| *"¿Se quedan con un % de mis cobros?"* | No. Tu MercadoPago, tu plata, directo. Pagás solo la suscripción. |
| *"Mis alumnos no usan apps."* | Es web instalable: 2 toques para reservar, sin descargar de ningún store. Y recepción puede operar por ellos. |
| *"No tengo recepcionista."* | Mejor: la lista de espera, los avisos y los saludos trabajan solos. StudioFlow está diseñado para estudios sin recepción. |
| *"¿Es difícil arrancar?"* | SYNTRA hace el setup completo y te entrega todo andando. |
| *"¿Mis datos?"* | Aislamiento por estudio a nivel base de datos (RLS). Nadie ve lo de otro. Te exportamos todo si te vas. |

## Próximo paso comercial

Demo en vivo de 12 minutos (ver `demo-script.md`) con "Estudio Reforma" — incluye el
momento burbuja-al-teléfono en la mano del prospecto.
