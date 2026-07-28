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
   - Deshabilitar signups públicos si el alta de negocios es manual (onboarding controlado).
   - `Site URL` y `Redirect URLs` = el dominio de producción.
3. **Backups**: activar backups automáticos (plan que los incluya). Es data de plata —
   no negociable.
4. **Network restrictions**: opcional, pero si se puede, restringir el acceso a la DB.

## 2. Migraciones (001 → latest, en orden, SIN seed)

La DB de producción se arma SOLO con las migraciones. **Nunca correr `seed.sql` /
`seed_demo.sql`** (son data de demo/test).

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
| `NEXT_PUBLIC_APP_URL` | Prod | URL base de producción (para links de email/push y `external_reference`). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Prod | Web Push (par VAPID). Generar con `web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | Prod | **SECRETO**, par del anterior. |
| `VAPID_SUBJECT` | Prod | `mailto:` del dominio. |
| `CRON_SECRET` | Prod | Bearer que autentica los crons (§6). Random largo. Vercel lo manda solo en `Authorization: Bearer <CRON_SECRET>`. |
| `RESEND_API_KEY` | Prod | **Usar la clave ROTADA** (la anterior se filtró — no reusarla). |
| `RESEND_FROM` | Prod | remitente en el dominio verificado (ej. `StockFlow <no-reply@dominio>`). |
| `RESEND_DEV_TO` | — | **NO en prod** (redirección de mails solo en dev). |
| `STOCKFLOW_REEMBOLSO_HABILITADO` | Prod | **DEJAR SIN SETEAR (OFF).** Solo prender (=`1`) DESPUÉS de validar el reembolso en sandbox MP con una terminal. |
| `NODE_ENV` | — | lo setea Vercel (`production`). No cargar a mano. |

Regla: toda `NEXT_PUBLIC_*` es visible en el cliente — nunca poner secretos ahí. El resto
son server-only.

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
- Requiere plan de Vercel con Cron Jobs habilitado.

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
- [ ] Email de prueba llega a inbox.
- [ ] Web Push: suscripción + notificación de prueba llega.
- [ ] Sin errores en consola ni en los logs de Vercel/Supabase.

## 10. Onboarding del primer cliente (el objetivo)

Con lo anterior hecho, dar de alta un cliente es:

1. Crear su **store** (onboarding) + su usuario dueño.
2. Que conecte su **cuenta de MercadoPago** (flujo in-app; el token se cifra con `MP_ENC_KEY`).
3. Setear sus **flags**: `has_posnet` (solo si tiene terminal Point validada), medios de
   confirmación, alias de transferencia, etc.
4. Cargar catálogo (o importar) y a vender.

Nada de infra por cliente: la infra es una sola, multi-tenant por RLS.

---

## Apéndice — qué queda gateado hasta tener una terminal

- **Cobros con posnet (Point)** y **split con la pata electrónica en el posnet**: ya están
  en `main` pero **dormidos** salvo que el negocio tenga `has_posnet=true` (que solo se
  prende tras validar con el device real).
- **Split de dos electrónicas (tarjeta + QR) + recuperación + reembolso**: en la branch
  `feat/stockflow-split-dos-electronicas`, sin mergear. Requiere terminal (flujo secuencial)
  + sandbox MP (endpoint de reembolso) antes de mergear y de prender
  `STOCKFLOW_REEMBOLSO_HABILITADO=1`.
- Un cliente **sin** posnet no toca nada de esto: vende con efectivo/tarjeta-a-mano/QR/
  transferencia + splits offline/QR, todo ya en `main`.
