# Pago dividido con DOS partes electrónicas — análisis (diferido)

> **PLAN / ANÁLISIS.** Sin código. Cómo desarrollar un split con dos tramos
> asíncronos (ej. tarjeta al posnet + QR) en una misma venta. Nace del pedido del
> owner (2026-07-27): "en un kiosco es raro, pero contemplémoslo". Se **difiere**
> frente a la versión de una sola parte electrónica (Paso 3); acá queda el diseño
> para cuando se retome.

## El problema central (por qué es duro, no caro)

Con **una** parte electrónica, el peor caso es un huérfano recuperable: la plata se
capturó y falta registrar la venta → el banner de Caja la re-arma. Limpio.

Con **dos** capturas independientes (dos pagos MP distintos), aparece un estado que
hoy no existe: **plata capturada de un tramo y el otro sin cobrar** = una venta a
MEDIO COBRAR. Ejemplo: efectivo $1000 + tarjeta-posnet $2000 (acredita) + QR $1500
(el cliente se va antes de pagar). Ya hay $2000 capturados en MP y no hay venta
completa. Eso **no se puede evitar** con dos capturas: solo se puede **gestionar**
(resumir o reembolsar). Ese es el salto real de complejidad y de riesgo.

## Diseño propuesto (cuando se construya)

### 1. Modelo — grupo de intentos, no un intento suelto
Cada tramo electrónico = un `payment_intent` propio (monto parcial + su método),
todos ligados por un `split_group_id` y guardando el reparto completo + la posición
del tramo. La venta se registra **recién cuando TODOS los tramos del grupo están
`approved`**. Reusa `split_pagos` (ya existe) + una columna de grupo.

### 2. Cobro SECUENCIAL, no simultáneo
La terminal Point es serie (un cobro por vez), y el cliente no apoya la tarjeta y
escanea el QR al mismo tiempo. Entonces: cobrar tramo 1 → acredita → cobrar tramo 2
→ acredita → registrar. La caja orquesta la secuencia; nunca dos MP en paralelo.

### 3. Registro al final, atómico
Cuando el último tramo acredita, se llama `register_split_sale(..., p_paid=true)` con
el reparto completo (ya soporta múltiples métodos). Igual que hoy, pero disparado por
"todos los tramos listos" en vez de "el único tramo listo".

### 4. Recuperación = "venta a medio cobrar" (lo nuevo y crítico)
Un estado nuevo en Caja, distinto del huérfano simple:
- Muestra qué tramos se cobraron (✓ tarjeta $2000) y cuál falta (QR $1500).
- **Resumir**: reabrir el cobro del tramo que falta; al acreditar, registrar la venta.
- **Reembolsar y cancelar**: si el cliente se fue, devolver los tramos capturados con
  la **API de reembolsos de MercadoPago** (superficie NUEVA, hoy no la usamos) y
  anular el intento de venta.
- Cota de tiempo: un grupo a medio cobrar vencido (>X h) se marca para revisión del
  dueño, nunca se queda colgado silencioso.

### 5. Guardas de integridad
- Un solo grupo activo por caja a la vez (no dos ventas a medio cobrar mezcladas).
- Idempotencia por tramo (misma clave → mismo intento).
- El binding de monto por tramo (cada intent.amount = su tramo) se mantiene.
- La venta no existe hasta que el grupo cierra → cero venta fantasma.

## Qué hace falta que hoy no tenemos
1. **Grupo de intentos** (`split_group_id` + orquestación secuencial).
2. **Estado "a medio cobrar"** en Caja + flujo de **resumir**.
3. **API de reembolsos de MP** (para el camino "el cliente se fue") — dep/superficie
   nueva, con su propio HMAC/idempotencia y testing.
4. Máquina de estados del grupo (qué tramo sigue, cuál falló) + su recuperación.

## Esfuerzo y recomendación
Es un proyecto en sí (del tamaño de todo el split), no un ajuste. El grueso del
riesgo está en el reembolso y en la recuperación parcial. **Recomendación:** construir
primero la versión de **una parte electrónica** (Paso 3) —cubre el 95% real— y dejar
esto para cuando haya demanda concreta de dos electrónicas en una venta. Cuando se
retome: TDD sobre la máquina de estados del grupo + un sandbox real de reembolsos MP
antes de tocar plata de verdad.

## Verificación (cuando se implemente)
Tests de: grupo con 2 tramos que acreditan en orden → una sola venta split; crash
tras el tramo 1 → estado "a medio cobrar", resumir completa la venta; reembolso del
tramo 1 → venta anulada sin plata perdida; idempotencia por tramo; cota de vencimiento.
