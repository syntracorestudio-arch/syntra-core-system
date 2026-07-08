# StudioFlow — Puesta en producción (Vercel + Supabase)

> Guía práctica. Las partes de **cuenta y secretos** las hace el owner (Vercel, Supabase
> de producción, env vars, dominio). El código ya está deploy-ready.
> Arquitectura: **Vercel** (Next.js) + **Supabase producción** (DB/Auth/Storage).
> El proyecto vive en el monorepo → en Vercel el **Root Directory** es
> `projects/pilates-studio-app`.

---

## 0. Prerrequisitos
- Cuenta en **Vercel** (gratis alcanza para empezar).
- Cuenta en **Supabase** (ya tenés; el proyecto de prod es **NUEVO**, distinto de `syntraflow-dev`).
- El repo en GitHub (ya está).
- (Opcional) un **dominio** propio.

---

## 1. Crear el proyecto de Supabase de PRODUCCIÓN
1. supabase.com → **New project** (nombre ej. `studioflow-prod`, región cercana, guardá la **DB password**).
2. Cuando esté listo, en **Project Settings → API** copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (SECRETO) → `SUPABASE_SERVICE_ROLE_KEY`
   - El **Project ref** (está en la URL) → `SUPABASE_PROJECT_REF`

## 2. Aplicar el schema (migraciones) a prod
En el dashboard de Supabase prod → **SQL Editor**, pegá y ejecutá **en orden** el contenido de
`supabase/migrations/`:
```
001_initial_schema.sql        009_edit_class_rpc.sql
002_rls_policies.sql          010_promote_waitlist_rpc.sql
003_reservation_rpc.sql       011_auto_promote_waitlist.sql
004_auth_signup_trigger.sql   012_public_studio_landing.sql
005_apply_payment_rpc.sql     013_landing_logo.sql
006_studio_join_codes.sql     014_instructor_link.sql
007_fix_member_financial_status_rls.sql  015_mercadopago_and_notifications.sql
008_admin_class_rpcs.sql      016_apply_online_payment.sql
```
> **NO** ejecutes `seed.sql` en prod (son datos demo). Prod arranca vacío.
> El bucket de logos (`studio-logos`) lo crea la migración 013.

## 3. Configurar Auth en Supabase prod
- **Authentication → URL Configuration**: `Site URL` = el dominio del deploy (ej.
  `https://studioflow.vercel.app`). Agregá esa URL a **Redirect URLs**.
- **Authentication → Providers → Email**: dejar habilitado email+password.
  Definí si querés confirmación de email (para invitados por código puede ir sin confirmación).

## 4. Crear el proyecto en Vercel
1. Vercel → **Add New → Project** → importá el repo de GitHub.
2. **Root Directory**: `projects/pilates-studio-app` (importante, es un monorepo).
3. Framework: **Next.js** (autodetectado). Build/Output por defecto.

## 5. Variables de entorno en Vercel (Project → Settings → Environment Variables)
Cargá (Production, y Preview si querés):
```
NEXT_PUBLIC_SUPABASE_URL       = https://<ref-prod>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon de prod>
SUPABASE_SERVICE_ROLE_KEY      = <service_role de prod>   (secreto)
SUPABASE_PROJECT_REF           = <ref-prod>
MP_ENC_KEY                     = <clave nueva de 32 bytes base64>   (secreto)
MP_WEBHOOK_URL                 = https://<tu-dominio>/api/webhooks/mercadopago
```
- Generá `MP_ENC_KEY` de prod (distinta a la de dev):
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `MP_WEBHOOK_URL` se completa cuando ya sabés el dominio del deploy (paso 6).

## 6. Primer deploy + dominio
1. **Deploy**. Vercel te da una URL `https://<algo>.vercel.app`.
2. (Opcional) conectá tu **dominio** propio en Vercel.
3. Actualizá `MP_WEBHOOK_URL` y el `Site URL` de Supabase con el dominio final y **re-deploy**.

## 7. Crear el PRIMER estudio (prod arranca vacío)
Todavía no hay superadmin (Fase 5), así que el alta del primer estudio es manual:
1. **SQL Editor** (prod):
   ```sql
   insert into public.studios (id, name, slug, timezone, status)
   values (gen_random_uuid(), 'Nombre del Estudio', 'nombre-estudio', 'America/Argentina/Buenos_Aires', 'active')
   returning id;  -- copiá el id
   insert into public.studio_settings (studio_id) values ('<studio_id>');  -- defaults
   ```
2. **Authentication → Users → Add user**: creá el email/clave del dueño (el trigger crea su `profile`).
   Copiá su **user id** (uid).
3. Vinculá al dueño como admin:
   ```sql
   insert into public.members (studio_id, profile_id, role, status)
   values ('<studio_id>', '<uid del dueño>', 'admin', 'active');
   ```
4. El dueño ya puede entrar en `/login`. Desde el panel crea clases, packs, y genera el
   **código de alta** (Ajustes/alumnos) para que sus alumnos se unan en `/join`.

## 8. Smoke test en prod
- `/login` → entra el admin → `/admin` (dashboard vacío pero sin errores).
- Crear una clase, un pack, registrar un pago manual.
- (MercadoPago) conectar Access Token de producción del estudio en *Ajustes → Cobro online*;
  con `MP_WEBHOOK_URL` pública ya funciona el webhook real.
- Revisar que no haya errores en los logs de Vercel.

---

## Notas
- **Nunca** commitear `.env.local` ni secretos; en prod viven en Vercel.
- `MP_ENC_KEY` de prod debe ser estable: si la cambiás, los tokens MP guardados dejan de descifrarse (habría que reconectar).
- La ruta `/api/dev/supabase-health` ya responde 404 en producción.
- Backups: Supabase hace backups automáticos según el plan; revisá el plan si vas a tener datos reales.
- Salida futura (Fase 5): extraer `pilates-studio-app` a su repo propio si conviene para CI/deploy dedicado.
