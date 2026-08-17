-- ===========================================================================
-- 055 · Trazabilidad — qué hizo SYNTRA en el negocio de un cliente
--
-- Plan: docs/identidad-acceso-plan.md §C (bloque 3, ítems 11 y 12).
--
-- El problema que resuelve no es técnico, es de confianza. `/super` corre con
-- `service_role` (saltea RLS) y desde ahí SYNTRA puede suspender un negocio,
-- crear otro o prender el asistente. Hoy eso no deja rastro en ningún lado:
-- la única prueba de que algo pasó es la memoria del que lo hizo.
--
-- LO QUE CONVIERTE ESTO EN SOPORTE Y NO EN PUERTA TRASERA es la última línea
-- de esta migración: **el dueño puede leer las filas de SU negocio**. Una
-- bitácora que sólo ve quien la escribe no es una auditoría, es un diario.
--
-- Tres propiedades, y ninguna es decorativa:
--
--   1 · APPEND-ONLY de verdad. No hay policy de UPDATE ni de DELETE para
--       NADIE — tampoco para `service_role`. Una bitácora que se puede editar
--       no prueba nada. (`postgres` como superusuario siempre podría; eso es
--       inevitable y por eso el valor está en que el CLIENTE la vea.)
--   2 · `reason` obligatorio y de 10 caracteres mínimo, tipeado a mano. Un
--       motivo opcional se deja vacío siempre, y "test" no explica nada.
--   3 · TODAS las mutaciones de /super, no sólo las de emergencia. La
--       excepción es lo que vuelve inútil el registro.
-- ===========================================================================

create table if not exists public.platform_audit (
  id             uuid primary key default gen_random_uuid(),
  /* Quién: el profile del superadmin. `set null` y no `cascade`: si algún día
     se borra ese usuario, la fila de auditoría tiene que SOBREVIVIR — es
     justamente el registro de lo que hizo. Por eso también se guarda el email
     en texto: es el dato que le sirve al cliente para leer la fila dentro de
     seis meses. */
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_email    text not null,
  action         text not null,
  /* Sobre qué. Los dos son opcionales porque no toda acción toca un negocio
     (crear uno lo estrena) ni un perfil. */
  target_store   uuid references public.stores(id) on delete set null,
  target_profile uuid references public.profiles(id) on delete set null,
  /* El nombre del negocio, congelado: si el store se borra o cambia de nombre,
     "suspendimos Kiosco El Trébol" tiene que seguir leyéndose igual. */
  target_label   text,
  reason         text not null check (length(trim(reason)) >= 10),
  ip             text,
  created_at     timestamptz not null default now()
);

/* La lectura del dueño filtra por `target_store` y ordena por fecha; la de
   SYNTRA barre todo por fecha. Un índice compuesto sirve a las dos. */
create index if not exists platform_audit_store_idx
  on public.platform_audit (target_store, created_at desc);

alter table public.platform_audit enable row level security;

/* SIN policy de insert/update/delete a propósito: con RLS activa y sin policy,
   `authenticated` no puede hacer NADA. `service_role` la saltea entera y es el
   único que escribe (desde las server actions de /super). */
drop policy if exists platform_audit_lee_el_dueno on public.platform_audit;
create policy platform_audit_lee_el_dueno on public.platform_audit
  for select using (public.auth_has_role(target_store, array['owner']));

revoke insert, update, delete on public.platform_audit from authenticated, anon;
grant select on public.platform_audit to authenticated;

-- ---------------------------------------------------------------------------
-- registrar_accion_plataforma — la ÚNICA forma de escribir
--
-- `security definer` + `service_role`: la llaman las server actions de /super,
-- que ya corren con esa llave. Existe como RPC y no como insert suelto para
-- que el `reason` no se pueda esquivar desde el código de la app — la
-- validación vive en un solo lugar y la base la hace cumplir.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_accion_plataforma(
  p_actor_id       uuid,
  p_actor_email    text,
  p_action         text,
  p_reason         text,
  p_target_store   uuid default null,
  p_target_profile uuid default null,
  p_target_label   text default null,
  p_ip             text default null
) returns public.platform_audit
language plpgsql security definer set search_path = public as $$
declare
  v_fila public.platform_audit;
begin
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_requerido';
  end if;

  insert into public.platform_audit (actor_id, actor_email, action, reason,
                                     target_store, target_profile, target_label, ip)
  values (p_actor_id, p_actor_email, p_action, trim(p_reason),
          p_target_store, p_target_profile, p_target_label, p_ip)
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke execute on function public.registrar_accion_plataforma(uuid, text, text, text, uuid, uuid, text, text) from public, authenticated, anon;
grant  execute on function public.registrar_accion_plataforma(uuid, text, text, text, uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- created_by — quién dio de alta cada negocio y cada miembro (ítem 12)
--
-- Nullable y sin backfill: las filas que ya existen no se inventan un autor.
-- `set null` por lo mismo que arriba — el dato de quién creó qué no puede
-- desaparecer porque se dé de baja al que lo creó.
-- ---------------------------------------------------------------------------
alter table public.stores
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.members
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
