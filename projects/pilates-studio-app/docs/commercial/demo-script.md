# StudioFlow — Guion de demo comercial (10 min)

> **Estado:** Fase 0 · Guion para vender StudioFlow a un dueño de estudio. Usa un estudio
> ficticio con datos seed para que el dashboard "se vea vivo". La demo navegable se construye
> en Fase 1; este documento define **qué** mostrar y **con qué datos**.

---

## 1. Estudio demo ficticio

**"Estudio Reforma"** — estudio de pilates boutique, 1 sala con reformers.

- **Marca demo:** nombre "Estudio Reforma", color primario sobrio, logo placeholder.
- **Zona horaria:** America/Argentina/Buenos_Aires.
- **Política:** `reservation_policy = require_credit_or_membership`,
  `cancellation_window_hours = 24`, `refund_on_late_cancel = false`.

## 2. Datos seed sugeridos

Pensados para que las métricas tengan sentido en pantalla:

- **Alumnos:** ~30 (con nombres ficticios), de los cuales:
  - ~20 **al día** (con pack vigente o membresía activa),
  - ~5 **con deuda** (sin crédito y sin membresía),
  - ~3 con **membresía próxima a vencer**,
  - ~2 con **membresía vencida**.
- **Instructores:** 3 (ej. Caro, Meli, Flor).
- **Clases recurrentes:** Reformer y Mat, varias franjas (mañana/tarde), cupo 6–8.
- **Ocurrencias:** semana actual + próxima materializadas; algunas **llenas** (para mostrar
  lista de espera) y otras con lugares.
- **Packs/membresías:** packs de 4/8/12 clases repartidos; algunas membresías mensuales.
- **Pagos del mes:** mezcla de conceptos (suelta/pack/membresía), método manual, para que
  **ingresos del mes** muestre un número realista.
- **Reservas:** varias por clase; **1–2 no-shows** y **1–2 cancelaciones** para poblar
  métricas.
- **Lista de espera:** 2–3 alumnos anotados en una clase llena.

## 3. Qué mostrar primero (apertura, ~1 min)

Abrir el **dashboard del admin** ya poblado: "Esto es lo que ve el dueño cada mañana —
ingresos del mes, ocupación de hoy, alumnos con deuda. Sin tocar un Excel." Enganchar con el
número de ingresos y la lista de deuda.

## 4. Flujo alumno (~3 min)

Desde el celular (vista mobile):
1. **Login** del alumno (ya invitado por el estudio).
2. **Calendario semanal:** se ve el cupo en vivo (ej. "Reformer 18 h — 6/8").
3. **Reservar** una clase → confirmación inmediata → aparece en "Mis clases".
4. Mostrar **su saldo** ("te quedan 5 clases de tu pack").
5. **Clase llena:** intentar reservar → ofrece **lista de espera** (orden respetado).
6. **Cancelar** una reserva dentro de las 24 h → se devuelve el crédito y se libera el cupo.

*Mensaje:* "El alumno se gestiona solo. Cero WhatsApp para reservar."

## 5. Flujo admin (~3 min)

En el panel (desktop):
1. **Crear una clase recurrente** (día/hora/cupo) → se generan las ocurrencias.
2. Abrir **una clase** → ver **anotados** + **lista de espera** → **promover** manual a
   alguien de la espera.
3. **Registrar un pago manual** de un alumno (ej. "Pack 8 clases") → asignar el pack.
4. Mostrar cómo **el saldo del alumno** y **los ingresos del mes** se actualizan al instante.

*Mensaje:* "Cargás un pago y el sistema actualiza saldo, deuda e ingresos solo."

## 6. Dashboard financiero (~2 min)

Recorrer las tarjetas: **ingresos del mes / total**, **alumnos al día / con deuda**,
**membresías vencidas / por vencer**, **packs y clases sueltas vendidas**, **ocupación**.

*Mensaje:* "Esta es la foto de tu negocio. Sabés qué entró, quién debe y qué se vende —
en cualquier momento."

## 7. Cierre comercial (~1 min)

- Recordar diferenciadores: **app con tu marca**, **la plata entra a tu cuenta** (cuando
  sumemos cobro online), **soporte SYNTRA en español**.
- Presentar **paquetes** (Starter / Studio Pro / SYNTRA Managed) y **setup inicial**.
- Pregunta de cierre: *"¿Arrancamos con el setup de tu estudio esta semana?"*
- Dejar claro el roadmap: hoy reservas + cobranza manual; el cobro online (tu MercadoPago)
  llega en una etapa siguiente.

---

### Notas para quien hace la demo
- Tener el seed cargado y la sesión lista antes de empezar (no improvisar datos en vivo).
- Mostrar SIEMPRE desde la marca del estudio demo, nunca "SYNTRA" en primer plano.
- Si el dueño pregunta por algo fuera de MVP (cobro online, recordatorios), ubicarlo en el
  roadmap con naturalidad, no prometer fecha.
