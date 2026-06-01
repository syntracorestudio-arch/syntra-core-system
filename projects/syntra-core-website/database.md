# BASE DE DATOS

Plataforma: **Supabase (PostgreSQL)**. Migraciones en [`supabase/migrations/`](supabase/migrations/).

---

## Estado actual (Sprint 2)

### Tabla: `leads` ✅ implementada

Captación desde el formulario de contacto del sitio.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `name` | text | requerido |
| `email` | text | requerido |
| `company` | text | opcional |
| `message` | text | requerido |
| `source` | text | origen (default `website`) |
| `status` | text | `new` / `contacted` / `qualified` / `won` / `lost` |
| `created_at` | timestamptz | default `now()` |

**Seguridad:** RLS activo, sin políticas públicas. La inserción ocurre solo
server-side (Server Action `submitLead`) con la `SERVICE_ROLE_KEY`. Validación
con Zod en cliente y servidor. Honeypot anti-spam.

Migración: [`supabase/migrations/0001_leads.sql`](supabase/migrations/0001_leads.sql)

---

## Cómo conectar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pegar `0001_leads.sql` → **Run**.
3. Project Settings → API → copiar `URL` y `service_role` secret.
4. Crear `.env.local` desde `.env.example` con esos valores.
5. Reiniciar `npm run dev`. El form ya persiste leads reales.

> Sin `.env.local`, el formulario funciona igual en dev: valida y registra el
> lead en consola (no persiste). Listo para producción sin tocar código.

---

## Tablas futuras (roadmap — no implementadas)

### `propuestas`
`id` · `cliente` · `estado` · `precio` · `fecha`

### `clientes`
`id` · `empresa` · `contacto` · `estado` · `fecha_inicio`
