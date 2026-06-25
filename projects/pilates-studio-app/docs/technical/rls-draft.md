# StudioFlow — RLS draft (Fase 1B)

> **DRAFT documental. SQL ilustrativo, NO ejecutable.** No es una migración. Fuente:
> [database.md](../database.md) §5, [business-rules.md](../business-rules.md),
> [schema-draft.md](schema-draft.md).

## Principio rector

**Aislamiento por tenant (`studio_id`) en TODAS las tablas de negocio**, vía RLS de Postgres.
Nadie ve ni escribe datos de un estudio al que no pertenece. El **rol** (client / admin /
reception / instructor) refina qué puede hacer **dentro** de su estudio. Las escrituras
sensibles (reservar, registrar pago, aplicar pack) **no** se hacen por RLS directa sino por
**RPC `SECURITY DEFINER`** que valida y escribe — el cliente no inserta de negocio a mano.

## Funciones helper (SECURITY DEFINER, search_path fijo)

```sql
-- DRAFT — no ejecutar.
-- Estudios donde el usuario actual es member activo.
create function auth_member_studios() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select studio_id from members
  where profile_id = auth.uid() and status = 'active'
$$;

-- ¿El usuario tiene cierto rol en cierto estudio?
create function auth_has_role(p_studio uuid, p_roles text[]) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where profile_id = auth.uid() and studio_id = p_studio
      and status = 'active' and role = any(p_roles)
  )
$$;
```

> **Por qué helpers SECURITY DEFINER:** evitan **recursión de RLS** (una policy sobre
> `members` que consulte `members` se cicla). El helper lee `members` sin re-disparar RLS.
> `search_path` fijo = anti-hijack.

## Patrón general por tabla

```sql
-- DRAFT. Para CADA tabla de negocio:
alter table <t> enable row level security;
alter table <t> force row level security;

-- Lectura: solo filas de mis estudios.
create policy <t>_select on <t> for select
  using (studio_id in (select auth_member_studios()));

-- Escritura admin (CRUD operativo): solo admin/reception de ese estudio.
create policy <t>_write_admin on <t> for all
  using     (auth_has_role(studio_id, array['admin','reception']))
  with check(auth_has_role(studio_id, array['admin','reception']));
```

`force row level security` para que ni el owner de la tabla saltee las policies. El
**service_role** (server/cron de SYNTRA) **bypassa** RLS por diseño de Supabase → se usa
solo en RPC/funciones controladas, nunca expuesto al cliente.

---

## Matriz de permisos (qué puede cada rol, dentro de su estudio)

| Tabla | client | admin | reception (post-MVP) | instructor (post-MVP) |
| --- | --- | --- | --- | --- |
| studios | read | read+update | read | read |
| profiles | read/update **propio** | read (de su estudio) | read | read (limitado) |
| members | read **propio** | CRUD | read + alta básica | read (sus clases) |
| classes | read | CRUD | read | read (suyas) |
| class_schedules | read | CRUD | read | read |
| class_occurrences | read | CRUD | read | read (suyas) |
| class_reservations | **propias** (vía RPC) | read+manage | read+manage | read (asistentes) |
| waitlist | **propia** (vía RPC) | read+promote | read+promote | — |
| passes | read | CRUD | read | — |
| member_passes | read **propio** | manage (vía RPC) | read | — |
| memberships | read **propio** | manage (vía RPC) | read | — |
| credit_ledger | read **propio** | read (sin update/delete) | read | — |
| payments | read **propio** | create+read (vía RPC) | create+read | — |
| attendance | read **propio** | manage | manage | manage (sus clases) |
| studio_settings | — | read+update | read | — |

> "vía RPC" = la escritura la hace una función `SECURITY DEFINER` que valida reglas; el rol
> no tiene `INSERT/UPDATE` directo sobre esa tabla.

---

## Políticas por rol — detalle

### client (alumno)
- **Lee** solo lo de **su(s)** estudio(s) y, en tablas personales, **solo lo propio**:

```sql
-- DRAFT. Reservas: el alumno ve solo las suyas.
create policy reservations_select_own on class_reservations for select
  using (
    studio_id in (select auth_member_studios())
    and member_id in (select id from members where profile_id = auth.uid())
  );
```
- **Crea/cancela reservas** y **se anota en waitlist** **solo vía RPC** (no INSERT directo):
  no hay policy de insert para client en `class_reservations`/`waitlist`.
- **Lee su saldo/pagos** (`credit_ledger`, `member_passes`, `memberships`, `payments`) filtrado
  por `member_id` propio. **No** puede escribirlos.
- **Nunca** ve datos de otros alumnos ni de otros estudios.

### admin / owner
- **CRUD completo dentro de su `studio_id`** (clases, schedules, occurrences, alumnos, passes,
  attendance, settings) vía `auth_has_role(studio_id, array['admin'])` (+ reception donde aplica).
- **Registrar pago / asignar pack / membresía** → vía **RPC** (aplica beneficio + ledger en
  transacción), no INSERT suelto, para mantener consistencia con créditos.
- **`credit_ledger`:** admin **lee** pero **no** update/delete (append-only; correcciones por
  asiento `adjust` vía RPC). Revocar `update,delete` a roles no-service.

### reception (post-MVP, Fase 2)
- Igual que admin **excepto**: sin acceso a `studio_settings` sensibles ni a métricas
  financieras globales (puede registrar pagos y gestionar reservas/alumnos).
- Implementación: las policies admin usan `array['admin','reception']` salvo en
  `studio_settings` (solo `['admin']`) y vistas de métricas globales.

### instructor (post-MVP, Fase 1.1/2)
- **Lee** sus `classes`/`occurrences` y la **lista de asistentes** (reservas de sus clases);
  marca `attendance`. **No** ve finanzas (`payments`, `credit_ledger`, `member_passes`).
- Requiere vincular `classes.instructor_id` al `member` instructor.

### superadmin (SYNTRA, Fase 5)
- **No** es un rol de cliente con RLS amplia. Opera vía **service_role** en endpoints server
  controlados (alta/baja de estudios, soporte, métricas globales). Nunca se expone la
  service key al navegador.

---

## Cómo se evita la fuga entre estudios
1. **`studio_id` obligatorio** en cada tabla + policy `select using (studio_id in (auth_member_studios()))`.
2. **Helpers SECURITY DEFINER** para resolver pertenencia/rol sin recursión.
3. **`force row level security`** en todas las tablas.
4. **Escrituras de negocio por RPC** que revalidan `studio_id` del actor vs el de la fila.
5. **service_role solo server-side** (RPC/cron), jamás en el cliente.
6. **Tests de aislamiento (Fase 1C):** crear estudio A y B; verificar que un client/admin de A
   no lee/escribe ninguna fila de B en **ninguna** tabla (suite por tabla × rol).

## Riesgos RLS
- **Recursión de policies** sobre `members` → mitigada con helpers SECURITY DEFINER.
- **`credit_ledger` mutable** → revocar update/delete explícitamente; solo insert vía RPC.
- **Olvidar `enable/force RLS`** en una tabla nueva → checklist de migración + test que
  falla si alguna tabla de negocio no tiene RLS.
- **Performance** de `studio_id in (select …)` → indexar `members(profile_id, studio_id)` y
  `studio_id` en cada tabla; el set de estudios por usuario es chico.
- **service_role filtrado** al cliente → nunca en env público; solo server.

> Siguiente: [rpc-reservation-draft.md](rpc-reservation-draft.md).
