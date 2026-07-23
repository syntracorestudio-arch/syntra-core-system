# StockFlow — Exploración fiscal AFIP/ARCA

> **Estado:** exploración de Fase 2 (2026-07-22). NO es una tanda de código: es el
> documento que decide SI se construye, CÓMO y con qué responsabilidad. Los hooks
> de datos ya existen desde la 001 (`stores.cuit`, `stores.fiscal`, `sales.fiscal`).
> Fuentes: ARCA (ex-AFIP) y contadores, julio 2026 — ver el pie.

---

## 0. TL;DR para decidir

- **AFIP dejó de existir en 2024**; el organismo hoy es **ARCA** (Agencia de
  Recaudación y Control Aduanero). El web service y los conceptos son los mismos.
- El kiosco típico es **monotributista** → emite **Factura C** (nunca A/B, no
  discrimina IVA). El CAE (Código de Autorización Electrónico) es lo que la vuelve
  válida; sin CAE, la factura no existe para ARCA.
- **La clave que cambia todo el alcance:** un monotributista que le vende a
  **consumidor final NO está obligado a emitir un comprobante por cada venta**.
  Puede emitir **UNA Factura C diaria por el total del día**. Un kiosco con 60
  ventas de $800 no factura 60 veces: factura una vez, al cierre.
- Emitir electrónicamente **de verdad** exige un **certificado digital X.509 por
  CUIT** y hablar SOAP con el web service **WSFEv1**. Es el mismo patrón
  *per-tenant* que ya usamos para MercadoPago: cada negocio delega SU certificado.
- **El riesgo no es técnico, es de responsabilidad.** Un CAE mal pedido, un número
  salteado o una fecha corrida es plata del cliente frente a ARCA. Facturar es la
  única función de StockFlow donde un bug nuestro se transforma en una multa suya.

**Recomendación (§6):** construir **"Factura C diaria agregada"** — un comprobante
por día, disparado desde el cierre de caja —, NO facturación por venta ni
controlador fiscal. Cubre la obligación legal del kiosquero con la mínima
superficie de error, y deja los hooks para el caso avanzado si aparece demanda.

---

## 1. Qué obliga ARCA, y la excepción que nos salva el alcance

Los blogs dicen dos cosas que parecen contradictorias; reconciliadas:

1. **Todo contribuyente inscripto (monotributista incluido) debe estar en
   condiciones de emitir factura electrónica C.** No hay excepción por ser chico,
   nuevo o facturar poco.
2. **PERO** para **ventas masivas a consumidor final**, el monotributista **no
   está obligado a emitir una factura por operación** ni a usar controlador
   fiscal. Le alcanza con **una Factura C diaria por el monto total** (RG que
   habilita el "comprobante resumen" diario a consumidor final).

La obligación de emitir **por venta** aparece solo cuando:

- el comprador **pide factura** (otro monotributista, un responsable inscripto,
  una empresa que necesita el gasto), o
- la operación individual **supera el umbral de identificación** del consumidor
  final. En 2026 ese piso subió fuerte: hay que identificar al comprador (nombre +
  CUIT/DNI) recién **por encima de $10.000.000** por comprobante — irrelevante
  para un kiosco.

**Consecuencia de diseño:** el 99% de las ventas de un kiosco caen en el caso
"consumidor final, monto chico, no pide factura" → **una Factura C al cierre del
día alcanza**. El caso "el cliente pide factura" es minoritario y se resuelve con
un botón puntual en el POS, no rediseñando la caja.

---

## 2. Los cuatro caminos, y cuál sirve

| Camino | Qué es | Sirve a StockFlow |
| --- | --- | --- |
| **Formulario web "Comprobantes en línea"** | El kiosquero entra a arca.gob.ar y tipea la factura a mano (4-5 min c/u) | **No** — es lo que ya hace sin nosotros; no aporta la app |
| **Controlador fiscal** | Hardware/impresora homologada que emite tickets con CAE | **No** — hardware, homologación por equipo, caro; el monotributista NO está obligado |
| **WSFEv1 por venta** | La app pide un CAE a ARCA en cada cobro | **No para MVP** — máxima superficie de error, latencia en la caja, y legalmente innecesario |
| **WSFEv1 diario agregado** | La app pide **UN** CAE por el total del día, al cierre | **Sí** — cubre la obligación, mínimo error, cero fricción en la venta |

El camino elegido usa el **mismo web service** que la facturación por venta
(WSFEv1); la diferencia es **cuándo** y **cuántas veces** se llama. Eso importa:
construir el agregado diario deja el motor listo y el salto a "por venta" (si
algún día un rubro lo pide) es un cambio de disparador, no una reescritura.

---

## 3. El stack técnico de WSFEv1 (qué habría que construir de verdad)

Facturar contra ARCA son **dos web services SOAP encadenados**:

1. **WSAA (autenticación).** Con el **certificado digital del negocio** (X.509 +
   clave privada) se firma un "Ticket de Requerimiento de Acceso" (TRA); ARCA
   devuelve un **token + sign** válido **12 horas**. Es el login. Hay que cachear
   ese ticket, no pedir uno por factura.
2. **WSFEv1 (facturación).** Con el token se llama:
   - `FECompUltimoAutorizado` → el último número autorizado (para no saltear ni
     repetir numeración; ARCA es estricto y **rechaza huecos**).
   - `FECAESolicitar` → manda el comprobante (tipo C, punto de venta, número,
     fecha, importe, condición del receptor) y **devuelve el CAE + su
     vencimiento**, o un error tipado.
   - `FEParamGet*` → tablas de referencia (tipos de comprobante, alícuotas,
     monedas) para no hardcodear.

**Homologación vs producción.** ARCA tiene dos entornos idénticos: *homologación*
(sin validez legal, para probar) y *producción*. Se cambia una URL. Se prueba
entero en homologación antes de tocar producción — igual que hicimos con el
sandbox de MercadoPago.

**El certificado es lo caro, no el SOAP.** Cada negocio, una vez:
- genera una clave y un CSR, o lo hacemos nosotros por él,
- sube el certificado en ARCA y **delega el web service "Facturación
  Electrónica"** a ese certificado,
- registra un **punto de venta** de tipo "Web Service" (los puntos de venta del
  formulario web y del WS son distintos y no se mezclan).

Esto es **onboarding fiscal por-tenant**, hermano exacto del de MercadoPago:
credencial sensible del negocio, cifrada AES-256-GCM, que solo el servidor toca.

Existen librerías Node que encapsulan el SOAP (afip.js / AfipSDK, o self-hosted
tipo pyafipws/LibreriaAFIP como referencia). **Reducen el SOAP, no la
responsabilidad**: el manejo del certificado, la numeración y la conciliación
siguen siendo nuestros.

---

## 4. Incidencia en la APP (qué se toca)

Los hooks de datos **ya existen** (001): `stores.cuit`, `stores.fiscal jsonb`,
`sales.fiscal jsonb`. Lo que faltaría, para el camino diario agregado:

**Datos (una migración nueva, ~`017_fiscal.sql`):**
- `store_fiscal_credentials` — certificado + clave **cifrados** (AES-256-GCM,
  patrón `store_payment_providers`), punto de venta, condición fiscal, entorno
  (homolog/prod). **Sin policies: solo service_role.**
- `fiscal_documents` — **append-only**, un asiento por comprobante emitido:
  tipo, punto de venta, número, fecha, importe, **CAE + vencimiento**, estado
  (`pending`/`authorized`/`rejected`), y **el rango de `sales` que resume**. La
  numeración es sagrada → mismo rigor que un ledger: nunca UPDATE del número.
- Índice único `(store_id, punto_venta, numero)` — la base impide un duplicado
  aunque el código falle.

**Backend:**
- `lib/afip/` — cliente WSAA (cachea el ticket 12 h) + WSFEv1, análogo a
  `lib/mercadopago.ts`.
- RPC / server action `emitir_factura_diaria(store_id, fecha)` — suma las ventas
  del día (excluye anuladas), pide el CAE, escribe `fiscal_documents`. Idempotente
  por `(store_id, fecha)`: si ya se emitió, no duplica.
- El caso "el cliente pide factura ahora" → acción puntual desde el POS que
  factura **esa** venta y la marca en `sales.fiscal`.
- **Conciliación:** al pedir CAE, cotejar SIEMPRE contra
  `FECompUltimoAutorizado`. Si ARCA y nosotros discrepamos en el número, **frenar
  y avisar**, nunca adivinar.

**UI:**
- Ajustes → "Facturación AFIP": pegar/generar el certificado, punto de venta,
  botón de prueba contra homologación. Se conecta **una vez**, como MercadoPago.
- Un bloque en **Caja / cierre**: "Facturar el día" con el CAE resultante y el PDF
  descargable/imprimible del comprobante C.
- Estado honesto cuando falla: "ARCA no respondió, reintentamos" — nunca dar por
  emitida una factura sin CAE.

**Infra:**
- `AFIP_*` envs por entorno (homolog/prod), como `MP_ENC_KEY`.
- Reintentos: ARCA se cae seguido. La emisión tiene que ser reintentable sin
  duplicar (de ahí la idempotencia por día).

**Lo que NO se toca:** `register_sale` no cambia — facturar es un paso **posterior
e independiente** de vender. Una venta existe y es válida para el negocio aunque
la factura fiscal se emita horas después o falle. Igual que separamos "cobrar por
QR" de "registrar la venta".

---

## 5. Incidencia para el CLIENTE (el kiosquero)

**Lo que gana:**
- Cumple con ARCA **sin entrar a la página de ARCA**. Hoy, el que factura, tipea a
  mano; el que no, está en falta. StockFlow lo vuelve un botón en el cierre.
- Una sola conexión inicial y se olvida: el sistema factura el total del día solo.
- Cuando un cliente le pide factura (un remisero, un comercio), la emite en el acto
  desde el POS en vez de mandarlo "a la vuelta".
- **Diferencial de venta real:** es lo único que Contabilium, Gestión Comercio y
  TICKX tienen y nosotros no. Cierra el flanco fiscal del pitch.

**La fricción (y por qué el camino diario la minimiza):**
- El onboarding fiscal es intrínsecamente burocrático: certificado + delegación +
  punto de venta en ARCA. Es la barrera nº1. **Mitigación:** asistirlo como
  servicio pago (igual que la carga inicial de catálogo), no dejarlo solo frente a
  ARCA.
- Necesita CUIT y estar dado de alta. El que trabaja 100% en negro no es cliente de
  esta feature — y no es a quien apuntamos.

**El riesgo — y hay que decírtelo sin maquillar:**
- Facturar es la **única** función donde un bug nuestro se transforma en un
  problema fiscal **del cliente**: un número salteado, una fecha corrida, un
  importe mal sumado, un CAE tomado como válido cuando ARCA lo rechazó. El resto de
  StockFlow, si falla, molesta; esto, si falla, **cuesta plata y multas ajenas**.
- Por eso el diseño es conservador: **append-only, idempotente, conciliado contra
  ARCA en cada emisión, y honesto cuando falla**. Y por eso **NO** empezamos
  facturando por venta: menos llamadas = menos superficie donde equivocarse.
- Implicancia de negocio: sumar facturación nos acerca a "software de gestión con
  responsabilidad fiscal". Conviene **términos claros** (somos la herramienta, la
  responsabilidad tributaria es del contribuyente) antes de encender producción.

---

## 6. Recomendación y fasing

**Construir "Factura C diaria agregada", en dos escalones, y NO antes de tener un
kiosco real usando el MVP** (el gate de Fase 2 del roadmap).

- **Escalón fiscal 1 — Conexión + emisión diaria (una tanda, ~`017_fiscal.sql`):**
  onboarding del certificado en Ajustes, WSAA+WSFEv1 contra **homologación**,
  `emitir_factura_diaria` desde el cierre de caja, `fiscal_documents` append-only,
  PDF del comprobante. Gate: emitir en homologación de punta a punta con un CUIT de
  prueba **antes** de tocar producción.
- **Escalón fiscal 2 — Factura puntual a pedido + producción:** botón "facturar
  esta venta" en el POS para cuando el cliente la pide; identificación del receptor
  sobre el umbral; habilitar producción con un negocio piloto y conciliación
  vigilada las primeras semanas.

**Queda fuera (respetando el patrón de scope del proyecto):** controlador fiscal
(hardware), Factura A/B (responsable inscripto — otro público), notas de crédito
automáticas por anulación (v2 fiscal: hoy una venta anulada simplemente no entra en
el resumen del día), régimen de información de terceros.

**Precondiciones del owner** (ninguna bloquea seguir explorando, sí bloquean
código):
1. Un **CUIT de prueba** y acceso a **homologación** de ARCA para desarrollar sin
   riesgo.
2. Definir la **postura de responsabilidad** (términos de uso) antes de producción.
3. Confirmar que el público objetivo **factura** (hay kioscos que operan sin CUIT;
   para ésos la feature es inútil y no debería frenar el roadmap).

---

### Fuentes (julio 2026)

- ARCA — Factura electrónica vs. controlador fiscal: https://www.afip.gob.ar/facturacion/comprobantes/fe-vs-cf.asp
- ARCA — Webservices de factura electrónica (WSFEv1, doc SOAP): https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp
- ARCA — Monotributo / Facturación: https://www.afip.gob.ar/monotributo/ayuda/facturacion.asp
- ARCA — Nuevos importes para identificar consumidores finales: https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=4511
- Blog del Contador — Monotributistas: ¿obligados a FE y/o controlador fiscal por ventas masivas a consumidor final?: http://blogdelcontador.com.ar/news-6594
- Proyecto WSFEv1 (SistemasÁgiles, referencia de implementación): https://www.sistemasagiles.com.ar/trac/wiki/ProyectoWSFEv1
