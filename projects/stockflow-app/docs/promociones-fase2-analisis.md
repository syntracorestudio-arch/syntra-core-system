# Promociones Fase 2 — análisis de mecánicas de kiosco (2026-08-08)

> Análisis previo a plan. El plan v1 (`promociones-plan.md`) excluyó
> bundles/2x1/combos a propósito; el owner reabre esa puerta a sabiendas.
> Nada de esto es código todavía: primero las decisiones de §6.

## 1 · Taxonomía por MECANISMO (no por nombre de cartel)

| Grupo | Carteles | Mecanismo real | Problema que resuelve | Frecuencia en kiosco chico |
| --- | --- | --- | --- | --- |
| **A. Precio por cantidad, UN producto** | 2x1 · 3x2 · "2da al 50%" · "2 x $1.000" · precio de bulto | `f(producto, qty)` → total de línea. Se resuelve en la LÍNEA | Subir ticket · mover volumen · liquidar sin regalar al que lleva 1 | **Alta** — "2 x $X" es EL cartel de kiosco (gaseosas, alfajores, cerveza). El 2x1 seco es raro (es −50%); el 3x2 es más de súper |
| **B. Surtido por categoría** | "3 alfajores x $1.500, cualquiera" | Cart-level: N unidades de un conjunto, precios heterogéneos | Mover una góndola entera con un cartel | Media-alta, casi siempre sobre precios parejos |
| **C. Combo cruzado** | "pancho + gaseosa $3.500" | Bundle con componentes y receta de stock | Ticket compuesto | Media, solo kiosco-comida. El workaround honesto ya existe: crear "el combo" como producto |
| **D. Medio de pago** | "precio efectivo / lista" | % sobre el TOTAL según cómo se paga | Trasladar la comisión | **Altísima en Argentina — pero NO es una promo**: es política de precios sale-level, choca con el split, merece su propio análisis |
| **E. Franja horaria** | "promo merienda" | Promo simple + ventana de horas | Horas muertas | Baja (es de cafetería) |
| **F. Fidelidad** | "10° café gratis" | Contador por cliente | Retención | Baja y ajena: exige identificar al cliente en cada venta |

**Hallazgo central:** 2x1, 3x2, "2da al 50%" y "N x $M" son **UN solo
mecanismo** — precio por cantidad sobre un producto. Pero dentro de A hay dos
semánticas que dan totales distintos y hay que ELEGIR:

- **Por grupos**: "2 x $1.000" ⇒ cada par $1.000, la 3ra a lista (3 = $1.600).
  Es lo que el cartel dice y lo que hace el súper. **Recomendada.**
- **Por umbral**: llevando 2+, todas a $500 (3 = $1.500). Más simple, regala
  la unidad extra.

Dato de dominio: la "2da al 50%" muchas veces la banca la DISTRIBUIDORA — no
hay que modelarlo, pero explica la demanda.

## 2 · Encaje con la arquitectura (grupo A)

- **Entidad: `promos` gana `min_qty int default 1`. NO una tabla nueva.** La
  promo actual es `min_qty 1` (cero migración semántica) y "una promo viva por
  producto" (`047:180-198`) pasa a impedir GRATIS el margen compuesto (2x1
  sobre algo ya rebajado). Dos tablas = dos definiciones de "vigente" = el
  agujero.
- **`promo_price` sigue siendo POR UNIDAD** (2 x $1.000 ⇒ `min_qty 2,
  promo_price 500`). Guardar el unitario exacto evita todo el barro: con
  "3 x $1.000" el unitario da $333,33, `line_total` 999,99 ≠ 1.000, y el gate
  del split (`028:195-199`, tolerancia 0,01) queda al borde del
  `split_sum_mismatch`. El alta acepta "N x $Total" pero exige división exacta.
- **`register_sale`**: mismo punto de resolución (`045:458-467`). Con
  `min_qty > 1`: `floor(qty/min_qty)·min_qty` unidades a precio de promo, el
  resto a lista — **dos filas de `sale_items`** (una con `promo_id +
  list_price`, otra sin). Verificado contra cada invariante: reportes
  (`sum(line_total)` exacto), split, void (devuelve por fila), medición
  (`promo_id ⟺ list_price` se sostiene), fingerprint (hash sobre los items de
  entrada, no cambia), override manual (sigue ganando y no registra promo).
- **`promo_vigente` NO gana parámetro qty** — devuelve la fila con `min_qty`;
  la cantidad la conoce quien resuelve (register_sale / el carrito).
- **POS no-interactivo se sostiene** — y es la mejor propiedad: el cajero
  escanea la 2da unidad y el precio baja SOLO (el carrito ya mergea
  cantidades, `pos-screen.tsx:358-369`). Dos ajustes: (1) el tachado no aplica
  a cantidad 1 → formato `$600 · 2 x $1.000` en tile/búsqueda/carteles;
  (2) espejo determinista `desgloseLinea(producto, qty)` en `lib/promos.ts`
  (mismo patrón que `finMinimo`: la RPC es la autoridad, el espejo evita que
  botón y ticket difieran — sin él, el split se cae).
- **Lo que se hereda sin tocar**: below_cost sobre el unitario, duración
  mínima, escalones por reemplazo, `resolve_expiry`, `store_hoy`, carteles
  (con formato nuevo de dos precios).

## 3 · El motor de sugerencias

Las promos de cantidad nacen de OTRO motivo (pelear un precio, subir ticket) —
el motor actual es riesgo-de-vencimiento y no tiene nada honesto que decir.
**Fase 2: 100% manuales.** Extensión honesta para fase 3: ofrecer el formato
alternativo en la sugerencia de vencimiento ("en vez de todo a −25%, 2da al
50%: misma rebaja promedio, pero el que lleva 1 paga lista") — es una cuenta,
no una promesa.

**Medición honesta** (computable con las dos filas): unidades en promo vs. a
lista durante la vigencia · **unidades por ticket antes/durante** (LA métrica
de un "2 x") · % de tickets que alcanzaron el umbral · lo que costó, siempre.
Nunca "la promo causó X ventas".

## 4 · Riesgos nuevos

1. **Canibalización** (el que llevaba 1 ahora lleva 2 rebajadas): no
   prevenible, sí visible — la medición antes/durante es el guardarraíl.
2. **Margen compuesto**: imposible por diseño con `min_qty` en la misma tabla.
3. **Cartel con dos precios**: el "antes" tachado desaparece (a cantidad 1 no
   hay rebaja; tachar sería mentir). Cartel y POS con la MISMA aritmética →
   `desgloseLinea` lo consumen ambos.
4. **Redondeo**: resuelto guardando el unitario exacto. Si se cede a "N x
   $Total" libre, vuelve entero.
5. Momento de confusión nuevo en caja: la 2da unidad sube el total MENOS que
   el precio — el desglose en la línea del carrito es la vacuna.

## 5 · Priorización

- **Fase 2 (UNA feature): "Precio por cantidad"** — `min_qty` + resolución en
  register_sale (dos filas) + catálogo + `desgloseLinea` + formato N x $Total
  en POS/carteles + alta con conversión "N x $Total ⇄ unitario" + medición
  antes/durante. Sugerencias sin cambios. Casi todo lo difícil ya está pago.
- **Fase 3 (con evidencia del piloto)**: surtido por categoría · formato
  alternativo en sugerencias · métrica por-ticket en la sección.
- **Roadmap aparte, NO por la puerta de promos**: descuento por medio de pago
  (precio efectivo/lista). Posiblemente lo MÁS demandado, pero es política de
  precios con implicancias en split y MP — análisis propio.
- **No construir nunca**: combos con receta de stock · fidelidad por puntos ·
  franjas horarias · promos por cliente · optimización de elasticidad.
- **Scope creep a vigilar**: horas de vigencia "ya que estamos" · alta masiva
  por categoría · notas/motivos · rastrear qué banca la distribuidora.

## 6 · Decisiones del owner antes de congelar el plan

1. **Semántica**: "2 x $1.000" con 3 unidades — ¿$1.600 (grupos, recomendada)
   o $1.500 (umbral)?
2. **Convivencia**: ¿una promo viva por producto, de cualquier tipo? (simple y
   2x no coexisten — recomendado sí).
3. **Campo primario del alta**: ¿"2 x $1.000" (total) o "llevando 2, $500 c/u"?
4. **¿El grupo A alcanza para el piloto, o su cartel real es el surtido de
   alfajores (grupo B)?** Si el negocio que va a probar vive del "3 x
   cualquiera", conviene saberlo ANTES de congelar.
5. **Precio efectivo/tarjeta**: ¿entra al roadmap como feature propia, o
   afuera por ahora?

---

# PLAN FIRME — Fase 2: precio por cantidad (congelado 2026-08-08)

## Decisiones del owner (cerradas, no se relitigan)

1. **Semántica POR GRUPOS**: "2 x $1.000" llevando 3 = **$1.600** (la 3ra a
   lista). Convención de súper; protege el margen de la unidad suelta.
2. **UNA promo viva por producto, de CUALQUIER tipo** (precio o cantidad).
   Descuentos compuestos: nunca. La regla de overlap existente cubre ambos.
3. **El alta habla como el cartel**: el input es el precio del GRUPO
   ("2 x $1.000"); la UI muestra la equivalencia calculada
   ("= $500 c/u · antes $600") como confirmación. Un input, dos lecturas.
4. **No hay piloto todavía** (la app no está desplegada) ⇒ se construye Fase 2
   ahora (monta la maquinaria existente) y la **Fase 3 (surtido por categoría)
   queda explícitamente GATEADA por evidencia de kiosco real post-deploy**.
   El motor de sugerencias NO toca las promos de cantidad.
5. **Precio por medio de pago (efectivo/lista)**: al roadmap como feature
   PROPIA con su propio arco de análisis, después de las prioridades de
   deploy. No es una promo; queda fuera de este sistema.

## Contrato (congelar en rpc-contracts.md ANTES del SQL)

- `promos.min_qty int not null default 1 check (1..24)`. `promo_price` sigue
  siendo POR UNIDAD dentro del grupo (2 x $1.000 ⇒ min_qty 2, promo_price 500).
  El alta exige división exacta del precio de grupo.
- `create_promo(p_min_qty default 1)`: `invalid_qty` fuera de rango; el resto
  de las validaciones (below_cost, duración, overlap, reemplazo con herencia
  de list_price) operan sobre el unitario y NO cambian.
- `register_sale`: con `min_qty > 1`, `unidades_promo =
  floor(qty/min_qty)·min_qty` al unitario de promo y el RESTO a lista — **dos
  filas exactas de `sale_items`** (la de promo con `promo_id + list_price`; la
  de resto sin promo). Con `qty < min_qty`: una fila a lista, sin promo. El
  override manual (`can_apply_discount`) sigue ganando y no registra promo.
- RPCs de catálogo: con `min_qty > 1` el `price` expuesto es el de LISTA (a
  cantidad 1 no hay rebaja — el tachado sería mentira); se agregan
  `promo_min_qty` y `promo_unit_price`.
- `promos_listado` / medición: cuentan SOLO las filas con `promo_id` ⇒ solo
  unidades efectivamente rebajadas. `promos_carteles` expone `min_qty`.
- Sin cambios: `promo_vigente` (firma), motor de sugerencias, split, void,
  fingerprint, `store_hoy`.

## TDD — costuras de plata PRIMERO (`verify-promos-cantidad.sql`)

1. "2 x $1.000" llevando 3 cobra **$1.600 exactos** (dos filas: 2×500 + 1×600).
2. Carrito mixto: promo de cantidad + monto libre + producto común, pagado con
   **split** — la suma cierra al centavo.
3. **Void** revierte stock y atribución exactos (las dos filas).
4. **Idempotencia**: replay del mismo carrito ⇒ misma venta, sin duplicar.
5. Medición: la promo declara **2** unidades (no 3), y el resignado es
   (600−500)·2 = $200.
6. `qty < min_qty` ⇒ todo a lista, sin `promo_id`.
7. Promo de cantidad + promo de precio sobre el mismo producto ⇒
   `promo_overlap` (y con `p_reemplazar`, reemplazo atómico).
8. Catálogo: `price` = lista con `min_qty > 1`; `promo_min_qty` y
   `promo_unit_price` presentes.
9. `below_cost` evaluado sobre el unitario del grupo.
10. Regresión: TODAS las suites previas verdes, con promos vivas en la base.

## UI

- **POS**: el precio baja SOLO al 2º escaneo (cero interacción). Espejo
  determinista `desgloseLinea(producto, qty)` en `lib/promos.ts` — la RPC es
  la autoridad; el espejo evita que botón y ticket difieran (sin él, el split
  se cae). Tile/búsqueda: formato "2 x $1.000" (sin tachado). Línea del
  carrito: desglose al cruzar el umbral. Delta en Confirmar: ya existe,
  absorbe el caso.
- **Sección**: alta con chips de mecánica + precio de GRUPO + equivalencia;
  cards con "2 x $1.000"; sugerencias intactas.
- **Carteles**: "2 x $1.000" protagonista + "1 x $600", pantalla e impresión.

## Verificación

tsc · lint · build · `node --test` · `verify-promos-cantidad.sql` + batería
completa verde (fixture Y seed de escala, con promos vivas) · consola limpia ·
visión 360/390/1920 · **gate visual: el owner escanea 3 unidades de un
"2 x $1.000" y verifica el ticket ($1.600)** → OK → safe-commit-gate → PR →
merge manual del owner.
