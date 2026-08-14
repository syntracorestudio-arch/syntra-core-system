# Validar cobros contra MercadoPago — checklist de sandbox

**Por qué es urgente.** El camino de cobro es el código de mayor riesgo de la app
y **nunca habló con MercadoPago de verdad**. Hoy están verificados sólo contra
nuestros propios tests: las tres hipótesis de pérdida de plata (H1/H2/H3), la
atadura del monto, el HMAC del webhook y el split con dos patas electrónicas.
Un test que pasa contra un mock demuestra que el mock hace lo que escribimos,
no que MP haga lo que creemos.

**No depende del despliegue.** Una cuenta de sandbox es gratis y son ~15 minutos.
No hace falta hosting ni dominio: el webhook entra por un túnel a tu máquina.

---

## Lo que necesito de vos

### 1 · Aplicación de prueba en el panel de MercadoPago

En <https://www.mercadopago.com.ar/developers> → *Tus integraciones* → **Crear
aplicación**:

- Producto: **Pagos online** (con QR/Checkout). Si vas a probar Point, marcá
  también *Pagos presenciales*.
- Modelo de integración: **CheckoutAPI / QR**.

De ahí sacás, en **Credenciales de prueba**:

| Dato | Dónde | Para qué |
| --- | --- | --- |
| **Access Token de prueba** (`TEST-…` o `APP_USR-…` de la cuenta de prueba) | Credenciales de prueba | Es lo ÚNICO que se pega en la app |
| **Clave secreta de firma** | *Webhooks* → *Configurar notificaciones* | Firma HMAC de las notificaciones |

> ⚠️ La app valida el token contra MP apenas lo pegás (`mpQuienEs`) y **rechaza
> un token inválido con un mensaje claro** — no guarda basura cifrada. Si te dice
> "MercadoPago rechazó ese token", es el token, no la app.

### 2 · Datos de la sucursal

Al conectar, el formulario pide **calle, altura, ciudad y provincia**. No es
burocracia nuestra: MP usa la dirección de la sucursal para retenciones
impositivas, y con esos datos la app crea en TU cuenta la sucursal y la caja
(`mpAsegurarCaja`). **Sin caja no hay QR posible.**

Poné la dirección real del negocio de prueba; cualquier cosa coherente sirve.

### 3 · Un túnel público (para el webhook)

MP tiene que poder llamar a tu máquina. Con `ngrok`:

```bash
ngrok http 3000
# te da algo como https://ab12-181-x-x-x.ngrok-free.app
```

Y esa URL va en `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://ab12-181-x-x-x.ngrok-free.app
```

La app arma sola la URL del webhook y te la muestra en Configuración:
`{NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago?store={storeId}`
Esa es la que pegás en el panel de MP.

> Si `NEXT_PUBLIC_APP_URL` no está, `urlWebhook()` devuelve `null` y la pantalla
> no te puede mostrar qué pegar. Es el primer paso, no el último.

### 4 · La clave de cifrado

Los tokens se guardan cifrados con AES-256-GCM; la clave vive en el entorno,
**nunca en la base**. Generá una y ponela en `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```env
MP_ENC_KEY=<los 32 bytes en base64>
```

> **Una por entorno, y no se rota.** Si cambia, los tokens guardados quedan
> ilegibles: la app lo trata como "no configurado" pero **lo loguea**, porque sin
> ese aviso el webhook correría sin verificar firma y nadie se enteraría.

---

## Orden de la prueba

1. `.env.local` con `MP_ENC_KEY` + `NEXT_PUBLIC_APP_URL` → reiniciar `npm run dev`
2. `ngrok http 3000`
3. `/admin/configuracion` → conectar con el Access Token + dirección
4. Copiar la URL de webhook que muestra la pantalla → pegarla en el panel de MP
5. Panel de MP → copiar la **clave secreta de firma** → pegarla en Configuración
6. Cobrar en el POS con **QR** y pagar con un **usuario de prueba** de MP

## Qué queda validado con esto

| | |
| --- | --- |
| ✅ QR vivo | La app genera la orden con el monto exacto y el cliente paga de verdad |
| ✅ Webhook + HMAC | Que MP firme como esperamos y que la firma se verifique |
| ✅ Idempotencia | Reenviar la misma notificación no duplica la venta |
| ✅ Atadura del monto | Que lo acreditado sea lo cobrado, no lo que dijo el cliente |
| ✅ Pata electrónica del split | Una parte por QR y el resto en efectivo |
| ⚠️ **Point (posnet)** | **NO se valida con sandbox: necesita el aparato físico.** El código está gateado por `has_posnet` + `mp_terminal_id`, así que sin device queda apagado y no molesta |
| ⚠️ Reembolso | El reembolso de una venta a medio cobrar vive en SQL (`027`) y **nunca se ejerció contra MP**. No hay flag de entorno que lo apague: si el camino se toca, corre. Es lo primero a revisar después del QR |

## Lo que voy a correr yo cuando estén las credenciales

- El ciclo completo QR: cobrar → pagar → acreditar → venta registrada con su
  `payment_intent` atado, y que NO exista venta si el pago no llega
- Reenvío del mismo webhook (idempotencia) y webhook con firma adulterada
  (debe dar 401)
- Split con una pata electrónica, y el caso "el cliente no paga la parte del QR"
- `cobros_sin_venta`: que un cobro acreditado sin venta quede visible en Caja y
  se pueda recuperar

---

**Estado:** pendiente de credenciales. Todo lo demás del camino de cobro está
verificado contra nuestros tests; esto es lo único que falta para poder decir
que funciona **contra MercadoPago**, que no es lo mismo.
