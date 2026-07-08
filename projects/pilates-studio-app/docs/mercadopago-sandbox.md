# MercadoPago — credenciales de prueba (sandbox)

> Para probar el cobro online **sin dinero real**. Opción A: cada estudio pega su
> **Access Token**; para testear usamos el token **de prueba** de una aplicación de test.

## 1. Crear una aplicación en MercadoPago Developers
1. Entrá a **https://www.mercadopago.com.ar/developers/panel** (con una cuenta de MP; puede ser la tuya).
2. **Tus integraciones → Crear aplicación**.
3. Nombre: `StudioFlow (test)`. Modelo: **Pagos online / Checkout Pro**. Producto: **Checkout Pro**.
4. Guardá. Vas a entrar al panel de la app.

## 2. Copiar el Access Token de PRUEBA
1. En la app → **Credenciales de prueba** (NO las de producción).
2. Copiá el **Access Token** de prueba (empieza con `TEST-...`).
   - Ese es el que vamos a **pegar en StudioFlow → Ajustes → Conectar MercadoPago** para el estudio demo.
3. (Opcional) copiá también la **Public Key** de prueba.

> ⚠️ El Access Token es secreto: **no lo pegues en el chat**. Cuando lleguemos a probar,
> lo cargás vos directamente en la pantalla de Ajustes de la app.

## 3. Crear usuarios de prueba (comprador y vendedor)
Para simular una compra real necesitás 2 usuarios de test:
1. En el panel de la app → **Cuentas de prueba → Crear cuenta de prueba** (o vía API).
2. Creá **una cuenta VENDEDOR** (recibe el pago) y **una COMPRADOR** (paga).
3. El **Access Token de prueba** que uses en StudioFlow debe ser el del **VENDEDOR**
   (así el pago "entra" a esa cuenta de test).
4. Con el usuario **COMPRADOR** pagás en el checkout usando **tarjetas de prueba** de MP
   (ver paso 4).

## 4. Tarjetas de prueba (para pagar en el checkout)
MercadoPago da tarjetas ficticias. Ejemplos (verificá los vigentes en su doc):
- **Mastercard** `5031 7557 3453 0604` · CVV `123` · venc. `11/30`
- **Visa** `4509 9535 6623 3704` · CVV `123` · venc. `11/30`
- Nombre del titular: `APRO` → pago **aprobado**; `OTHE` → **rechazado**; `CONT` → **pendiente**.
- DNI: `12345678`.

## 5. Qué necesito de vos para probar (Slices B y C)
- El **Access Token de prueba (vendedor)** → lo cargás en Ajustes cuando esté la pantalla.
- Que el **webhook** pueda recibir notificaciones. En dev, MercadoPago necesita una URL
  pública: usaremos un túnel (ej. `ngrok`/`cloudflared`) apuntando a `localhost` **o**
  probamos el webhook con el simulador de MP. Lo coordinamos al llegar a Slice C.

## Notas
- **Producción**: cada estudio real pega **su propio** Access Token de **producción**
  (lo saca de su panel de MP). El dinero entra directo a la cuenta del estudio; SYNTRA no
  intermedia fondos.
- Guardamos el token **cifrado** y accesible **solo del lado del servidor** (nunca al navegador).
- Doc oficial: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
