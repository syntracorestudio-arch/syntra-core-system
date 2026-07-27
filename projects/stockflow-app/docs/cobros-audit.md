# Cobros — auditoría del checkout + propuesta (terminales, confirmación, mejoras)

> **PLAN ONLY.** Auditoría del flujo de cobro actual + benchmark + opciones de
> integración con terminales AR + propuesta de UX de confirmación y mejoras.
> Sin código, sin migraciones. Fecha: 2026-07-27. Próxima migración libre: **025**.
>
> **No re-arregla** los fixes de integridad de pago ya mergeados esta semana
> (H1 key↔carrito, H2 cancelar en vuelo, H3 monto server-side del QR, M4
> registro forzado del cobro pagado, M5 vínculo venta↔intento) — los referencia
> para no contradecirlos.

---

## A) Auditoría del estado actual

Cinco medios (`pos-screen.tsx:64-70`): **efectivo, tarjeta, transferencia, QR (MercadoPago), fiado**. El medio elegido se guarda **tal cual como string** en `sales.payment_method` — es el **único** discriminador en todo el sistema. No hay número de referencia, ni ID de terminal, ni monto entregado/vuelto, ni sub-clasificación.

### Flujo por método

| Método | Interacción | Se registra | Validación de monto |
| --- | --- | --- | --- |
| **Efectivo** | **1 tap** en Cobrar → registra y vacía | `sales(payment_method='cash')` + `sale_items` + `stock_ledger` | ninguna (no hay "paga con"/vuelto) |
| **Tarjeta** | **1 tap** → registra | idem, `'card'` | **ninguna** — el monto real está en el posnet externo |
| **Transferencia** | **1 tap** → registra | idem, `'transfer'` | **ninguna** — la plata está en el banco/CVU |
| **QR (MP conectado)** | Diálogo con QR vivo + polling 2,5s | `payment_intents` → al acreditar, `register_sale` con `p_paid=true` | **server-authoritative** (H3): monto recomputado del catálogo + binding contra el monto REAL acreditado en MP |
| **QR (MP NO conectado)** | **1 tap** (se comporta como tarjeta/transfer) | `sales('qr')` marcado a mano | ninguna |
| **Fiado** | 1 tap (con guarda de cliente obligatorio) | idem, `'account'` + `client_ledger(delta=-total)` | límite = **aviso, no bloqueo** |

**Camino compartido** (`pos-screen.tsx` `cobrar()` `:223` → `registrar()` `:243`): el único branch es `qr && mpConectado` → abre `CobroQrDialog`. **Todo lo demás cae a `registrar(null)` en un solo tap, sin pantalla de revisión.** La venta se crea server-side en `register_sale` (migración **023**), se limpia el carrito y se rota la key de idempotencia. El medio **vuelve a `cash` después de cada venta** (`:280`).

**Reporting** — el string `payment_method` alimenta todo: `dashboard_summary.by_method` (incluye fiado), `cierre_caja.by_method` (excluye `account`, suma los cobros de fiado a su medio real, calcula `efectivo_esperado`), `reportes_medios`. **Nada valida que el monto de `card`/`transfer` coincida con lo que la terminal o el banco procesó de verdad.** El QR es el único con monto reconciliado.

### Puntos donde el cajero se puede equivocar (estado actual)

| Riesgo | Métodos | Detalle |
| --- | --- | --- |
| **Método equivocado** (caro) | todos | El medio default y post-venta es `cash`. Si el cajero no cambia el medio, una venta de tarjeta/transfer queda como efectivo → **descuadra `efectivo_esperado`** y distorsiona `by_method` en los 3 reportes. |
| **Monto ≠ terminal** (el más caro) | **tarjeta, transfer** | El monto real vive afuera (posnet/banco); la app graba el total del carrito sin campo para confirmarlo ni reconciliarlo. Si el posnet se tecleó distinto (recargo, propina, error), libros y banco divergen para siempre. **Esto es exactamente lo que una terminal integrada elimina (§C).** |
| **Sin cálculo de vuelto** | efectivo | No hay "paga con" ni vuelto: el cajero lo hace de cabeza, el error es invisible al sistema. |
| **Sin confirmación** | todos | El botón único es el punto de no retorno. Un producto mal tapeado o un doble-escaneo se cobra sin revisión; corregir = anular después (`anularVenta`). |
| **Doble-cobro entre dispositivos** | tarjeta | La idempotencia (H1) protege dentro de un carrito, pero el posnet es **otro aparato**: un decline+retry en la terminal vs. un tap exitoso en la app puede dar terminal-cobrada-dos-veces o app-registrada-sin-captura. La app no lo detecta. |
| **"Ya me pagó — cobrar igual"** | QR | Fuerza completar sin confirmación de MP; si se aprieta de más, queda una venta `qr` sin plata (se recupera solo por el banner de Caja). |
| **Cliente/límite en fiado** | fiado | Cliente obligatorio ✅, pero el `<select>` no confirma (deuda al cliente equivocado) y el límite solo avisa. |

> Los fixes en vuelo ya cubren: doble-registro por key reusada (H1), cancelar-en-vuelo (H2), tamper de monto del QR (H3), cobro pagado irrecuperable (M4). **No proponer re-ingresar el monto del QR en el cliente** — rompería H3.

---

## B) Benchmark externo (investigación)

**Patrón dominante: confirmar SIN frenar, y monto reconciliado por la propia terminal/QR — no por lo que teclea el cajero.**

- **Square** — el pago es un paso con **medios múltiples (split tender)**: el total debe completarse entre tenders, con timeout de 5 min que anula lo parcial; en efectivo **muestra el vuelto y lo deja en pantalla hasta imprimir/enviar recibo**. El propio equipo de Square documenta que un flujo de tender confuso **genera tickets de soporte por tender equivocado** → confirma que el confirm + claridad de medio es un problema real, no cosmético. ([split tender](https://squareup.com/help/us/en/article/5097-process-split-tender-payments-with-square), [cash change](https://community.squareup.com/t5/Hardware-Setup-Troubleshooting/cash-sales-show-change-amount/m-p/356115))
- **MercadoPago Point / QR** — dos integrados: **QR** (Punto de Venta + Dinámico) y **terminal Point** que recibe el monto pusheado por API. Es el estándar del mercado AR. ([MP developers](https://www.mercadopago.com.ar/developers/en/docs), [MP Point](https://www.mercadopago.com.ar/developers/en/docs/mp-point/integration-test))
- **Fudo** (POS gastronómico AR) — integra **MP QR (PDV + Dinámico)** y soporta **pago dividido** (efectivo + tarjeta + MP en una misma venta). ([Fudo · MP](https://soporte.fu.do/es/articles/11732024-introduccion-mercadopago-integracion-en-fudo), [medios de pago](https://soporte.fu.do/docs/to-medios-pago))
- **Bistrosoft** (POS AR) — activa **Point Plus de Mercado Pago para cobrar con QR *y con tarjeta*** desde el sistema, eligiendo medio + monto, con **multi-tender**. Confirma que la terminal Point es el camino de tarjeta-integrada que usa el software AR. ([Bistrosoft · MP](https://bistrosoft.com/mercado-pago-la-alianza-mas-ventajosa-para-tu-negocio-gastronomico/))
- **SumUp / Clip** — SumUp = **lector Bluetooth** (requiere emparejar por app nativa → **no es viable desde una PWA sin wrapper nativo**, ver §C). Clip es principalmente México. *(Disponibilidad/relevancia AR: needs verification.)*

**Lecturas para StockFlow:** (1) el confirm-step es estándar y probadamente reduce errores; (2) el vuelto en efectivo se muestra siempre; (3) el split payment es común en AR (Fudo/Bistrosoft); (4) la tarjeta seria se integra por **terminal que recibe el monto** (Point), no por tecleo manual.

---

## C) Integración con posnet / terminales de tarjeta (Argentina)

Dos familias, y una restricción dura de plataforma primero:

> **Restricción de la PWA:** StockFlow es web/PWA (Next.js), sin app nativa. Solo son viables las integraciones **cloud (REST API + webhook)**. Las terminales que se conectan por **Bluetooth/USB local** (lectores tipo SumUp) **no se pueden manejar desde el navegador** sin envolver la app en un binario nativo (Capacitor/React Native) — quedaría fuera del alcance actual.

### Opción 1 — MercadoPago Point (RECOMENDADA como primer target) ✅

**Cómo funciona (verificado):** el servidor postea una **orden con el monto** vía la **misma Orders API que StockFlow ya usa para el QR** (`/v1/orders`), apuntando a un **`device_id`** (la terminal Point física vinculada a la cuenta del negocio); la terminal cobra la tarjeta y el resultado vuelve por **webhook** (+ se puede consultar por GET). **Cloud REST, sin app nativa ni Bluetooth.** ([MP Point](https://www.mercadopago.com.ar/developers/en/docs/mp-point/integration-test))

**Por qué es la mejor primera apuesta:**
- **Reusa TODA la infra MP que ya existe** en StockFlow: `store_payment_providers` (token cifrado AES-GCM por negocio), el webhook con HMAC + idempotencia (H3b), la Orders API (`mpCrearOrdenQR` ya postea a `/v1/orders`), el binding de monto real (`montoPagado`, H3). Una orden `point/device` es una variante de la de `qr`.
- **Elimina el riesgo de monto ≠ terminal** (§A): el monto lo **empuja el sistema** a la terminal; el cajero no lo teclea. Y se reconcilia contra el pago real (mismo patrón H3).
- **Multi-tenant natural:** cada negocio ya conecta su cuenta MP; sumar el `device_id` de su Point es un campo más en el onboarding.
- Cloud → funciona en la PWA tal cual. SDK Node oficial disponible.
- *Endpoint/naming exacto (Orders vs. el viejo "Payment Intents" de Point) y el emparejamiento `device_id`↔token: needs verification contra la doc vigente antes de estimar.*

### Opción 2 — Payway (ex Prisma/Posnet) — secundaria

Tiene **portal de developers** ([developers.payway.com.ar](https://developers.payway.com.ar/catalog)) y **SDK .NET**, pero lo documentado es **"Venta Online"** = gateway de pago **card-not-present** (e-commerce, token) — **no** el push del monto a un posnet físico presencial. La terminal integrada (smart-POS / posnet integrado) requiere **gestión comercial + SDK de terminal**. *(El path físico-presencial push-amount: needs verification.)* Relevante si un cliente ya opera con Payway y no quiere MP.

### Opción 3 — Getnet (Santander) — secundaria

**API regional** (una integración para AR/BR/MX/CL) + **Get Checkout** (online). El **"POS Integrado"** existe pero **requiere contactar a un ejecutivo** y testing conjunto. ([Getnet docs](https://docs.globalgetnet.com/es/docs?doc=get-started)) Multi-país; alta fricción de onboarding.

### Opción 4 — Manual / standalone (lo de hoy, sigue siendo el fallback)

El cajero teclea el monto en su **posnet propio** (cualquier adquirente) y la app solo **registra "tarjeta"**. **Cero integración, siempre disponible**, cero costo de dev — pero arrastra el riesgo de monto ≠ terminal (§A). Es el **default universal** y el modo para negocios que no integran.

### Recomendación

**MP Point primero.** Es cloud (encaja en la PWA), **reusa la infra MP existente** (mínimo dev incremental vs. cualquier otro adquirente), elimina el mismatch de monto por diseño, y es el estándar AR que el resto del software (Bistrosoft) ya usa. Payway/Getnet quedan como **integraciones a demanda** si un cliente lo pide. El manual sigue como fallback siempre presente.

*Costos/comisiones por adquirente: needs verification (dependen del acuerdo comercial de cada negocio; StockFlow no intermedia fondos, igual que con el QR).*

---

## D) UX de confirmación + antierror

**Principio:** la confirmación **no es un modal nuevo — es la segunda cara del botón que ya existe.** Sin diálogo, sin cambiar de zona, sin sacar el pulgar del pie del carrito. *(product-experience-designer, sobre el `pos-screen.tsx` real.)*

### El paso de confirmación: botón de dos estados "armar → confirmar", method-aware

- **Estado A (igual a hoy):** total + grilla de medios + botón `Cobrar $1.800 · 3 u.`
- **1er tap → Estado B (misma zona, sin modal):** una tarjeta in-place del mismo alto: **chip del método** (tocarlo = ← Volver a A), **total en 4xl tabular**, y **`Confirmar $1.800`**.
- **2do tap → registra** (mismo `registrar(null)`) y vuelve a A con el toast `Cobrado $X`.

**Por qué cumple sin frenar:** es **+1 tap deliberado**, no un modal; el total grande + el chip de método **son lo que el cajero dice en voz alta** ("son mil ochocientos, en efectivo") → la revisión se monta sobre un gesto que ya hace. Método y monto juntos a la vista cazan los dos errores caros de una.

**Anti "doble-tap reflejo" (crítico):** (1) **cambio de color de estado** (la superficie cambia visiblemente) + (2) **lockout de ~250 ms** antes de que Confirmar acepte input (los reflejos caen <300 ms; un deliberado ni lo nota). Plan B: invertir posiciones (Confirmar arriba, Volver donde estaba Cobrar).

**Escaneo durante el Estado B = "me faltó un producto":** cancela la confirmación, agrega el ítem y vuelve a A. Convierte el peor caso en un gesto natural. **Enter sigue libre** (terminador del lector) — confirmar es siempre tap, nunca Enter.

**Diferenciación por método:**

| Método | Estado B muestra |
| --- | --- |
| **Efectivo** | total + **mini-pad "Paga con"** (chips $2k/$5k/$10k/$20k + Justo + ⌨) → **vuelto calculado client-side** |
| **Tarjeta** | total + "Pasá la tarjeta en el posnet" (o, con Point integrado, "Enviado a la terminal…") |
| **Transferencia** | total + **alias/CVU del negocio + copiar + QR de CVU** |
| **Fiado** | total + `SaldoCliente` (ya existe) reubicado |
| **QR (MP)** | **no cambia** — su `CobroQrDialog` ya ES el paso de confirmación. No duplicar. |

**¿Siempre o configurable?** Recomendado: **siempre y uniforme** (la predictibilidad = velocidad por memoria muscular), con un **toggle por negocio/método** (`Ajustes → Confirmar antes de cobrar`, default ON) para poder exigirlo solo en efectivo+transferencia y saltarlo en tarjeta/QR. **Decisión del owner.**

### Mejoras más allá del pedido (valor / esfuerzo)

| # | Mejora | Valor | Esfuerzo | Quick-win |
| --- | --- | --- | --- | --- |
| 1 | **Vuelto en efectivo** (chips de billetes + cálculo), dentro del Estado B | Alto | Bajo-Med | ✅ |
| 2 | **Transferencia: alias/CVU + copiar + QR de CVU** (hoy "marca y reza") | Alto | Bajo-Med | ✅ |
| 3 | **Deshacer / cambiar método** post-venta (toast `Cobrado` con `Deshacer` ~15s → anula y reabre) | Alto | Med* | ✅ si hay reverso idempotente |
| 4 | **Redondeo de vuelto** ($50/$100 — no hay monedas en AR) | Med | Bajo | ✅ |
| 5 | **Códigos con peso/precio embebido** (EAN prefijo `2x`) para dietética/verdulería | Alto (rubro) | Med | — |
| 6 | **Cantidad rápida en la línea** (×2/×3 sin re-escanear) | Med | Bajo | ✅ |
| 7 | **Beep/chime de "cobrado"** (mostrador ruidoso, sin mirar) | Med | Bajo | ✅ |
| 8 | **Aviso de carrito colgado** (>X min → "¿venta anterior?") | Med | Bajo | ✅ |
| 9 | **Pago dividido** (parte efectivo/parte tarjeta) — necesita `sale.payments[]` | Med | Alto | — (Fase 2) |
| 10 | **Recibo opcional** — WhatsApp (`wa.me`) barato / impresión térmica cara | Med | Bajo (WA) / Alto (print) | WA sí |
| 11 | **Tarjeta con terminal integrada** (push del monto — MP Point, §C) | Alto | Alto | — (tier hardware) |

\* #3 (Deshacer) es el complemento más fuerte del confirm: la confirmación caza el error antes; el deshacer caza el que se coló. Ya existe `anularVenta` (reverso idempotente con contra-asientos) → factible.

**Guardarraíles de velocidad:** nunca tocar el path de escaneo (sigue instantáneo); el Estado B **renderiza sin red** (vuelto client-side, cero fetch hasta el commit); cero campos obligatorios en el 80% (mirar y confirmar); posición aprendible del Confirmar; preservar idempotencia + Enter-libre. **Objetivo sub-15s intacto.**

---

## E) Impacto en modelo de datos / contrato

Todo **additivo**; el discriminador sigue siendo `sales.payment_method` (una tarjeta cobrada por Point sigue grabándose `'card'` → `by_method`/`reportes_medios`/`cierre_caja` **no cambian**). Regla de contrato congelado: objeto nuevo = migración nueva (**próxima libre: 025**).

| Mejora | Cambio de datos | Aditivo |
| --- | --- | --- |
| Confirmación (D) | **ninguno** — es UI pura sobre el flujo actual | — |
| Vuelto en efectivo | opcional: `sales.cash_tendered numeric` + derivar vuelto (para reconciliar caja). Sin esto, es solo UI. | migración 025, columna nullable |
| Alias/CVU transferencia | `store_settings.transfer_alias text` (o en `branding jsonb`) | 025, aditivo |
| **Tarjeta integrada (MP Point)** | **reusa `payment_intents`** (el modelo del QR generaliza a "orden a un device") + `store_payment_providers.mp_device_id`. La venta se registra con `register_sale(..., p_paid=true)` igual que el QR pagado. | aditivo sobre la infra MP existente |
| Pago dividido (#9) | **nuevo:** tabla `sale_payments(sale_id, method, amount)` — rompe el modelo de un solo `payment_method`. `by_method`/reportes leerían de ahí (cambio de contrato mayor). | migración propia, Fase 2, decisión aparte |

**Notas scale-security-baseline:** cualquier lectura nueva (p. ej. estado de una orden Point) va acotada + por RPC/service-role como el QR; el webhook de Point reusa el patrón HMAC + idempotencia + `maxDuration` ya existente; `mp_device_id` y credenciales van en `store_payment_providers` (solo service_role, ya cifrado). Nada de esto toca los invariantes de `register_sale` (probados: sobreventa, idempotencia, aislamiento).

---

## F) Recomendación por fases (secuenciada vs. los fixes de integridad)

> **Fase 0 — primero los fixes de integridad de pago.** Ya están mergeados (H1/H2/H3/M4 en #171/#172/#175); **falta mergear #176** (Tanda 3). **Nada de esta propuesta arranca antes de eso** — el confirm-step y el Point se apoyan en el `register_sale`/QR ya endurecidos. Cero colisión: esta propuesta es additiva y no toca esas RPCs.

- **Fase 1 — Quick wins, sin hardware (el pedido del owner + lo que sale casi gratis).**
  Confirm-step de dos estados (D) + **vuelto en efectivo** (#1) + **alias/CVU en transferencia** (#2) + **redondeo** (#4). Todo UI + a lo sumo 2 columnas aditivas (025). Es el mayor golpe de valor por esfuerzo: caza método/monto equivocado y el error de vuelto. Trabajo visual = variantes vivas (owner juzga en su navegador).
- **Fase 1.5 — Deshacer post-venta (#3)** + cantidad rápida (#6) + beep (#7) + carrito colgado (#8). Cierran el ciclo del error con el `anularVenta` que ya existe.
- **Fase 2 — Tarjeta integrada: MP Point.** Reusa la infra MP; elimina el mismatch de monto de tarjeta por diseño. Requiere una terminal Point de prueba + confirmar la Orders API `device`. Es el salto de "registra tarjeta" a "cobra tarjeta".
- **Fase 3 — Avanzado / a demanda.** Pago dividido (#9, tabla nueva), recibo por WhatsApp (#10), códigos con peso (#5) cuando entre dietética/verdulería, Payway/Getnet si un cliente lo exige.

---

## G) Preguntas abiertas para el owner

1. **Confirmación: ¿siempre, o toggle por método/negocio?** (default sugerido: siempre; opción de saltar tarjeta/QR).
2. **¿Guardar el monto entregado / vuelto en la venta** (para reconciliar caja), o el vuelto es solo ayuda visual? (lo primero = columna nueva).
3. **Terminal integrada: ¿tenés (o el piloto tiene) una MercadoPago Point?** Define si Fase 2 es real a corto plazo.
4. **Alias/CVU del negocio** para transferencias: ¿dónde se configura y quién lo carga? (¿un QR de CVU también?).
5. **¿Hay demanda de pago dividido** en tu segmento, o es lujo? (define si Fase 3 sube).
6. **¿Algún cliente atado a Payway/Getnet** que descarte MP Point como único camino de tarjeta?
7. **Lockout anti-doble-tap** (250 ms sugerido) y ¿tecla física de confirmar en tills sin touch?

---

### Fuentes
- MercadoPago Developers — [docs](https://www.mercadopago.com.ar/developers/en/docs) · [MP Point integration](https://www.mercadopago.com.ar/developers/en/docs/mp-point/integration-test)
- Payway Developers — [catálogo de APIs](https://developers.payway.com.ar/catalog) · [.NET SDK](https://github.com/payway-ar/sdk-net-ventaonline)
- Getnet — [docs](https://docs.globalgetnet.com/es/docs?doc=get-started) · [Get Checkout](https://www.getnet.com.ar/cobra-online/get-checkout)
- Square — [split tender](https://squareup.com/help/us/en/article/5097-process-split-tender-payments-with-square) · [cash change](https://community.squareup.com/t5/Hardware-Setup-Troubleshooting/cash-sales-show-change-amount/m-p/356115)
- Fudo — [integración MP](https://soporte.fu.do/es/articles/11732024-introduccion-mercadopago-integracion-en-fudo) · [medios de pago](https://soporte.fu.do/docs/to-medios-pago)
- Bistrosoft — [MP / Point Plus](https://bistrosoft.com/mercado-pago-la-alianza-mas-ventajosa-para-tu-negocio-gastronomico/)

*Marcado "needs verification": endpoint/naming exacto de la Orders API de Point + emparejamiento device↔token; path físico-presencial (push-amount) de Payway; comisiones por adquirente; disponibilidad AR de SumUp/Clip.*
