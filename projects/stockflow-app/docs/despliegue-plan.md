# StockFlow — Plan de despliegue a producción

> **Estado (2026-07-28):** StockFlow NO está desplegado en ningún lado (solo local con
> `npx supabase start`). `main` está en #183 (base de cobros + split hasta Paso 3, todo
> gateado por `has_posnet`). El split de **dos electrónicas + reembolso** está en la branch
> `feat/stockflow-split-dos-electronicas`, sin mergear, gateado hasta validar con terminal.
>
> **Objetivo:** dejar producción parada y probada, de modo que **onboarding de un cliente =
> crear su store + setear sus flags, y nada más.** Este documento es PLAN — no se ejecuta
> nada hasta que haya un primer cliente (el owner aprueba cada paso).

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage) · Vercel · MercadoPago
(cuenta por negocio) · Resend (email) · Web Push (VAPID).

---

## 0. Decisiones previas (definir antes de arrancar)

- **Región Supabase**: `sa-east-1` (São Paulo) — la más cercana a AR (menor latencia).
- **Región Vercel**: `gru1` (São Paulo) para que las server actions queden cerca de la DB.
- **Dominio**: definir (ej. `app.stockflow…`). Sin dominio propio no hay email con buena
  entregabilidad (ver §7). Se puede arrancar con el `*.vercel.app` para pruebas internas.
- **MercadoPago**: cada negocio conecta SU cuenta (SYNTRA no toca la plata). Para el
  smoke-test conviene una cuenta de **sandbox** propia.

---

## 1. Supabase — proyecto cloud

1. Crear proyecto nuevo en la región elegida. Guardar en el gestor de secretos:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (SECRETO — solo servidor)
   - **DB password / connection string** (para el CLI).
2. **Auth**: revisar `supabase/config.toml` local como referencia. Confirmar en el panel:
   - Email/password habilitado (el login del sistema).
   - **Deshabilitar signups públicos** (firme, no condicional): el alta de negocios es
     SIEMPRE manual — `/super` crea el owner con `admin.auth.admin.createUser`
     (service_role, `email_confirm: true`, password temporal), y el equipo se alta igual
     desde `/admin/equipo`. No existe ningún `signUp` público en el código. Por lo mismo,
     **no hace falta SMTP de Supabase Auth** para el onboarding (los emails de la app van
     por Resend, no por Auth).
   - `Site URL` y `Redirect URLs` = el dominio de producción.
3. **Backups**: activar backups automáticos (plan que los incluya). Es data de plata —
   no negociable.
4. **Network restrictions**: opcional, pero si se puede, restringir el acceso a la DB.

## 2. Migraciones (001 → latest, en orden, SIN seed)

La DB de producción se arma SOLO con las migraciones. **Nunca correr NINGÚN
`supabase/seed*.sql`** — hoy son tres y todos son data de dev: `seed.sql` (fixture de
tests), `seed_demo.sql` (demo comercial) y `seed_escala.sql` (kiosco sintético de ~2000
productos para probar escala). Si mañana aparece otro `seed_*.sql`, también queda
prohibido: la regla es por patrón, no por lista.

```bash
# desde projects/stockflow-app
supabase link --project-ref <ref-del-proyecto>
supabase db push        # aplica supabase/migrations/*.sql en orden ascendente
```

- Hoy `main` tiene **001 → 029**. Cuando se mergee dos-electronicas, suma **030 → 033**.
- Verificar que el orden numérico esté completo y sin huecos antes de `db push`.
- **Post-migración, correr las suites de verificación** contra la DB de prod recién creada
  (son transaccionales con ROLLBACK, no ensucian): `verify.sql`, `verify-money-loss.sql`,
  `verify-caja.sql`, `verify-split*.sql`. Si alguna falla → parar, no seguir.
- Confirmar que RLS quedó activo en todas las tablas (las migraciones lo setean; verificar
  que ninguna quedó abierta).

## 3. Storage

Hoy la app no crea buckets en las migraciones (los assets — ilustraciones, imágenes de
login — son estáticos en `public/`). Si en el futuro se suben imágenes de producto a
Storage, crear el/los buckets con sus policies acá. **Verificar** antes de asumir que no
hace falta.

## 4. Vercel — hosting

1. Importar el repo. **Root Directory = `projects/stockflow-app`** (monorepo).
2. Framework: Next.js (autodetectado). Build: `next build` (default).
3. Región de funciones: `gru1`.
4. Conectar el deploy de producción a la branch `main` (main = siempre desplegable).
5. Primer deploy: que quede en verde el build ANTES de cargar todas las envs (o cargarlas
   primero y luego deploy).

## 5. Variables de entorno / secretos (Vercel → Project → Settings → Environment Variables)

| Variable | Entorno | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod (+Preview) | del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod (+Preview) | pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod | **SECRETO**, solo server |
| `MP_ENC_KEY` | Prod | **AES-256-GCM, 32 bytes.** Cifra los tokens de MP de cada negocio. **Se setea UNA vez y NUNCA se cambia**: rotarla vuelve ilegibles los tokens ya guardados (los negocios tendrían que reconectar MP). Generar fuerte y guardar en el gestor de secretos. |
| `NEXT_PUBLIC_APP_URL` | Prod | URL base de producción. **Crítica para MP**: la URL del webhook que cada negocio registra se deriva de acá (`${APP_URL}/api/webhooks/mercadopago?store=<id>`). Setearla al dominio final ANTES de que cualquier negocio conecte MP — si cambia después, cada negocio tiene que re-registrar su webhook en su panel de MP. También la usan links de email/push. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Prod | Web Push (par VAPID). Generar con `web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | Prod | **SECRETO**, par del anterior. |
| `VAPID_SUBJECT` | Prod | `mailto:` del dominio. |
| `CRON_SECRET` | Prod | Bearer que autentica los crons (§6). Random largo. Vercel lo manda solo en `Authorization: Bearer <CRON_SECRET>`. |
| `RESEND_API_KEY` | Prod | **Usar la clave ROTADA** (la anterior se filtró — no reusarla). |
| `RESEND_FROM` | Prod | remitente en el dominio verificado (ej. `StockFlow <no-reply@dominio>`). |
| `RESEND_DEV_TO` | — | **NO en prod** (redirección de mails solo en dev). |
| `STOCKFLOW_REEMBOLSO_HABILITADO` | Prod | **Dejar SIN SETEAR.** Desde el rescate del split (054) es un control real y *fail-closed*: sólo `=1` habilita; ausente, vacío o cualquier otro valor ⇒ el reembolso se rechaza. Prender **únicamente** después de validar el endpoint contra el sandbox de MP. |
| `NODE_ENV` | — | lo setea Vercel (`production`). No cargar a mano. |

Regla: toda `NEXT_PUBLIC_*` es visible en el cliente — nunca poner secretos ahí. El resto
son server-only.

### 5.1 Supabase Auth — DOS ajustes sin los que `/recuperar` no funciona

Ninguno de los dos está en Vercel: se configuran en el panel de Supabase, y
**los dos fallan en silencio**, que es lo que los vuelve peligrosos.

**a · URL de redirección en la allowlist** (Auth → URL Configuration → Redirect URLs)

Agregar `https://<dominio-real>/**`.

El link de recuperación vuelve por `/auth/callback`, que canjea el token por
sesión y aterriza en `/cuenta`. GoTrue **sólo respeta el `redirect_to` si está
en esa lista**; si no está, no devuelve error: cae al `site_url` y el dueño
termina en la home **sin poder elegir contraseña**, con el token ya quemado.

> Verificado en local, no deducido: en la primera corrida el mail salió con
> `redirect_to=http://127.0.0.1:3000` en vez de nuestro callback, justamente
> por esto. El patrón tiene que llevar comodín (`/**`): el destino incluye
> `?next=…` y una URL exacta no matchea.

**b · SMTP apuntando a Resend** (Auth → Emails → SMTP Settings)

Sin esto, `/recuperar` acepta el pedido, muestra "revisá tu correo" **y el mail
no sale nunca** — el peor modo de falla posible, porque el dueño se queda
esperando en vez de pedir ayuda. El SMTP de Auth es independiente del
`RESEND_API_KEY` de la app (ese lo usa el reporte mensual, no GoTrue).

**Prueba de aceptación** (va en el checklist de §post-deploy): pedir el link
con el email del dueño, abrirlo, y confirmar que **aterriza en `/cuenta`** y que
la contraseña nueva entra. Si aterriza en la home, es (a).

### 5.2 MercadoPago — SIN credenciales de aplicación propias (verificado en código)

**No existen `MP_CLIENT_ID` / `MP_CLIENT_SECRET` ni flujo OAuth** — es por diseño, no un
faltante: cada negocio usa su PROPIA aplicación de MercadoPago. La conexión
(`admin/configuracion/mercadopago-actions.ts`) es:

1. El dueño crea su aplicación en MP y **pega su Access Token de producción** en
   Configuración → se valida con `mpQuienEs` y se guarda **cifrado con `MP_ENC_KEY`**.
   La app crea sucursal+caja en SU cuenta con ese token.
2. **Webhook (registro MANUAL, por negocio)**: la pantalla de Configuración le muestra al
   dueño SU URL de notificaciones — `${NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago?store=<id>`
   — y él la registra en el panel de su aplicación de MP. **No se registra por API**: es un
   paso del checklist de conexión de cada negocio, contra el dominio de producción.
3. **Firma del webhook (por negocio, opcional pero recomendada)**: el dueño pega la clave
   de firma de su panel de MP → se guarda cifrada (`webhook_secret`) y el handler verifica
   el HMAC (`x-signature`). Sin firma, el webhook igual es seguro-por-diseño: es solo un
   "avisá que mires" — la verdad del pago SIEMPRE se re-consulta a la API de MP con el
   token del negocio (defensa en profundidad, no fuente de verdad).

Implicación operativa: el único secreto MP a nivel plataforma es `MP_ENC_KEY`. Todo lo
demás (token, firma, webhook) es por-negocio y entra por la UI de Configuración durante el
onboarding.

## 6. Crons (ya declarados en `vercel.json`)

```json
{ "crons": [
  { "path": "/api/cron/alerts",         "schedule": "0 12 * * *" },   // diario 12:00 UTC = 09:00 AR
  { "path": "/api/cron/monthly-report", "schedule": "0 11 1 * *" }    // día 1, 11:00 UTC = 08:00 AR
]}
```

- Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`; los handlers lo verifican y
  devuelven 401 si no coincide. **Sin `CRON_SECRET` seteada, los crons quedan 401** (bien:
  fail-closed).
- Los horarios son **UTC**. Confirmar que 09:00/08:00 AR es lo deseado; si no, ajustar.
- **Plan de Vercel: se necesita Pro para crons puntuales.** En Hobby los cron jobs están
  capados (máx. 2 por cuenta, frecuencia máxima diaria) y el disparo es **best-effort**
  (puede correr en cualquier momento de la hora programada, o demorarse). Nuestros dos
  crons entran en el cupo de Hobby, pero las alertas diarias y el reporte mensual son
  cara-al-cliente: para horario confiable → **Vercel Pro**. Verificar los límites vigentes
  del plan al momento de ejecutar (cambian).

## 7. Dominio + entregabilidad de email

Sin esto, los mails (alertas, reportes) caen en spam o no llegan.

1. Apuntar el dominio a Vercel (registros que indique Vercel) y setear `NEXT_PUBLIC_APP_URL`.
2. En **Resend**: verificar el dominio → agregar en el DNS:
   - **SPF** (TXT) y **DKIM** (CNAME/TXT) que da Resend.
   - **DMARC** (TXT): arrancar en `p=none` (monitoreo) y endurecer luego.
3. `RESEND_FROM` debe usar ese dominio verificado.
4. Probar un envío real y revisar que llegue a inbox (no spam).

## 8. Seguridad pre-launch

- La app ya trae rate-limiting en las acciones sensibles (login, cobros, leads) y cotas de
  fecha/índices (baseline). Repasar `syntra-scale-security-baseline` antes de abrir a un
  cliente real.
- Confirmar headers de seguridad y que no haya secretos en `NEXT_PUBLIC_*`.
- (Opcional recomendado) Sentry + un uptime monitor apuntando a un endpoint de health.

## 9. Smoke-test en producción (checklist, con una cuenta de prueba)

- [ ] Login entra y la sesión persiste.
- [ ] Alta de negocio (onboarding) crea el store con RLS aislando su data.
- [ ] Alta de producto + venta en efectivo → aparece en Caja y en el cierre.
- [ ] Venta con QR (MP sandbox del negocio) → acredita → se registra (sin venta fantasma).
- [ ] Fiado + pago dividido offline → imputa a cada medio; el cierre cuadra.
- [ ] Reporte mensual / alertas: disparar el cron manualmente con el Bearer y ver que corre.
- [ ] Gate de posnet: un negocio con `has_posnet=false` NO ve nada de Point en la caja
      (ni pregunta terminal/pantalla, ni tarjeta-al-posnet) — cobra QR/efectivo como siempre.
- [ ] Gate del asistente: el cron `monthly-report` saltea los negocios con
      `ai_assistant_enabled=false` (solo procesa los que tienen el add-on prendido; el
      response del cron reporta `skipped`).
- [ ] **Recuperación de contraseña de punta a punta**: pedir el link, abrirlo, que
      aterrice en `/cuenta` (NO en la home) y que la contraseña nueva entre. Si cae
      en la home, falta la URL en la allowlist de Auth (§5.1a).
- [ ] Email de prueba llega a inbox.
- [ ] Web Push: suscripción + notificación de prueba llega.
- [ ] Sin errores en consola ni en los logs de Vercel/Supabase.

## 10. Onboarding del primer cliente (el objetivo)

Con lo anterior hecho, dar de alta un cliente es:

1. Crear su **store + usuario dueño desde `/super`** (service_role crea el auth user con
   password temporal; sin signup público).
2. Que conecte su **cuenta de MercadoPago** (flujo in-app §5.1: pega su token, registra SU
   URL de webhook en su panel de MP, y opcionalmente la clave de firma).
3. Setear sus **flags**: `has_posnet` (solo si tiene terminal Point validada), medios de
   confirmación, alias de transferencia, etc.
4. Cargar catálogo (o importar) y a vender.

Nada de infra por cliente: la infra es una sola, multi-tenant por RLS.

---

## Apéndice — qué queda gateado hasta tener una terminal

- **Cobros con posnet (Point)** y **split con la pata electrónica en el posnet**: ya están
  en `main` pero **dormidos** salvo que el negocio tenga `has_posnet=true` (que solo se
  prende tras validar con el device real).
- **Split de dos electrónicas (tarjeta + QR) + recuperación + reembolso**: rescatado de
  `feat/stockflow-split-dos-electronicas` (estuvo 3 semanas fuera de main sin PR). Sigue
  requiriendo terminal real (flujo secuencial) + sandbox MP para el endpoint de reembolso
  antes de prender `STOCKFLOW_REEMBOLSO_HABILITADO=1`.

  > ✅ **Resuelto en el rescate (054).** Esta nota advertía que, al entrar la rama,
  > "sin setear" pasaría a significar *prendido y sin control*. **Esa predicción era
  > equivocada**: la rama traía el gate incorporado y es *fail-closed* —
  > `process.env.STOCKFLOW_REEMBOLSO_HABILITADO === "1"`, así que ausente ⇒ apagado—,
  > en la server action (`caja/actions.ts`) y en el botón (`caja/page.tsx`).
  >
  > Lo que **sí** faltaba, y el barrido de puntos de entrada encontró, era otra cosa:
  > `marcar_pata_reembolsada` —la RPC que transiciona una pata `approved → refunded`—
  > pedía sólo `rpc_member`, o sea **cualquier empleado**. Y no era un registro falso
  > y nada más: `reembolsarGrupo` procesa únicamente las patas todavía `approved`, así
  > que una marcada a mano **saltea el reembolso real para siempre** (el cliente no
  > cobra nunca y el sistema dice que sí), esquivando además el flag, que vive en la
  > acción y no en la base. 054 la pasó a owner junto con `grupos_a_medio_cobrar` y
  > `cobros_sin_venta`. Cubierto por `supabase/tests/verify-reembolso-owner.sql`, que
  > prueba las dos direcciones.
  >
  > Por eso el gate se construye **en esa rama y antes de mergearla**, sobre los
  > puntos de entrada que ella misma trae, con test en las dos direcciones
  > (ausente ⇒ rechaza en todos lados · `=1` ⇒ anda). Nada que mueva plata puede
  > entrar a `main` sin que alguien lo haya prendido a conciencia.
- Un cliente **sin** posnet no toca nada de esto: vende con efectivo/tarjeta-a-mano/QR/
  transferencia + splits offline/QR, todo ya en `main`.
