-- ===========================================================================
-- 066 · El contacto humano y las notas del cliente
--
-- QUÉ RESUELVE. "71 días de atraso" se lee EXACTAMENTE IGUAL hayas reclamado
-- tres veces o ninguna, y son dos conversaciones opuestas: en un caso la
-- próxima llamada es un recordatorio, en el otro es una charla sobre si el
-- cliente sigue. La escalera automática (060/061) registra lo que manda el
-- SISTEMA; no hay ningún lugar donde quede lo que hizo la PERSONA.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ NO VA EN `platform_audit` — la trampa que evita esta tabla
-- ---------------------------------------------------------------------------
--
-- `platform_audit` parece el lugar obvio: ya guarda actor, motivo, fecha y
-- negocio. Sería un error grave.
--
-- **Esa tabla LA LEE EL CLIENTE**, en su propia pantalla de cuenta
-- (`admin/configuracion/actividad-syntra.tsx`, vía RLS). Es a propósito: es lo
-- que convierte al panel en soporte y no en puerta trasera.
--
-- Una nota de cobranza es exactamente lo contrario: es interna, y se escribe
-- con el candor con el que se escribe algo que nadie más va a leer — "dice que
-- paga el viernes pero ya me dijo lo mismo el mes pasado". Guardar eso en
-- `platform_audit` se lo muestra al cliente en su pantalla. No hay forma de
-- arreglarlo después: el que escribió la nota confiaba en que era privada.
--
-- Por eso tabla aparte, sin RLS para nadie y sin ningún camino de lectura desde
-- la app del cliente. La regla que queda: `platform_audit` es lo que SYNTRA le
-- HIZO al negocio y el cliente lo lee; `client_contacts` es lo que SYNTRA
-- HABLÓ con el negocio y el cliente NO lo lee.
-- ===========================================================================

create table if not exists public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  /* `set null` y no `cascade`: si el superadmin se borra, el registro del
     contacto tiene que sobrevivir — igual que en `platform_audit`. El email
     queda en texto por el mismo motivo. */
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email text not null,
  canal       text not null check (canal in ('whatsapp', 'llamada', 'email', 'presencial', 'otro')),
  /* Mínimo real pero bajo: acá el que escribe es el mismo que lee, así que no
     hace falta el piso de 10 de `platform_audit` (que existe porque ese texto
     se lo lee un tercero). "No atendió" es un resumen legítimo. */
  resumen     text not null check (length(trim(resumen)) >= 3),
  created_at  timestamptz not null default now()
);

/* La consulta real es siempre "los contactos de ESTE negocio, del más nuevo al
   más viejo". El índice la sirve entera. */
create index if not exists client_contacts_store_idx
  on public.client_contacts (store_id, created_at desc);

/* RLS prendida y CERO policies: ningún cliente puede ver una fila, ni siquiera
   las suyas. Es el mismo patrón que `subscriptions` (057) — la relación
   comercial entre SYNTRA y el cliente no se expone del lado del cliente. */
alter table public.client_contacts enable row level security;

revoke all on public.client_contacts from public, anon, authenticated;
/* DELETE sí, UPDATE no. Son notas internas del propio operador sobre sí mismo,
   no un registro de cumplimiento: si se cargó el contacto en el negocio
   equivocado hay que poder borrarlo, porque si no la lista se vuelve basura y
   se deja de mirar. UPDATE no, para que "ya le reclamé" no se pueda reescribir
   en silencio: se borra y se carga de nuevo, que deja la fecha nueva a la
   vista. */
grant select, insert, delete on public.client_contacts to service_role;

-- ---------------------------------------------------------------------------
-- 2 · Cuándo volver a llamar
--
-- Va en `subscriptions` y no en la tabla de contactos porque es un estado
-- ACTUAL del cliente ("volver a llamarlo el 25"), no un hecho histórico. Si
-- viviera en el contacto, habría que salir a buscar el último de todos para
-- saber la fecha vigente, y cambiarla obligaría a inventar un contacto que no
-- ocurrió.
-- ---------------------------------------------------------------------------
alter table public.subscriptions add column if not exists seguimiento_el date;

-- ---------------------------------------------------------------------------
-- 3 · registrar_contacto — el contacto y la fecha de seguimiento, juntos
--
-- Es UNA operación aunque toque dos tablas: el momento en que se anota "hablé
-- con Rosa" es el mismo en que se decide "la vuelvo a llamar el 25". Separarlo
-- en dos llamadas deja el caso de que una ande y la otra no, y el resultado
-- silencioso sería un contacto registrado sin seguimiento — o sea un cliente
-- que nadie vuelve a llamar.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_contacto(
  p_store_id    uuid,
  p_canal       text,
  p_resumen     text,
  p_actor_id    uuid,
  p_actor_email text,
  p_seguimiento date default null,
  /* Explícito y no "si viene null no toques": hace falta poder BORRAR la fecha
     de seguimiento ("ya está, no lo llamo más"), y sin esta bandera null sería
     ambiguo entre "no cambiar" y "limpiar". */
  p_tocar_seguimiento boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  if p_seguimiento is not null and p_seguimiento < current_date then
    raise exception 'seguimiento_en_el_pasado';
  end if;

  insert into public.client_contacts (store_id, actor_id, actor_email, canal, resumen)
  values (p_store_id, p_actor_id, coalesce(p_actor_email, 'desconocido'), p_canal, p_resumen)
  returning id into v_id;

  if p_tocar_seguimiento then
    update public.subscriptions
       set seguimiento_el = p_seguimiento
     where store_id = p_store_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke execute on function public.registrar_contacto(uuid, text, text, uuid, text, date, boolean)
  from public, authenticated, anon;
grant  execute on function public.registrar_contacto(uuid, text, text, uuid, text, date, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4 · guardar_notas — la ficha permanente del cliente
--
-- Distinto de un contacto: el contacto es "qué pasó el martes", la nota es "lo
-- que hay que saber de este cliente siempre" (que atiende después de las 6, que
-- el hijo maneja la caja). Por eso se pisa en vez de acumularse.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_notas(p_store_id uuid, p_notas text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_filas int;
begin
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  update public.subscriptions
     set notas = nullif(trim(coalesce(p_notas, '')), '')
   where store_id = p_store_id;

  get diagnostics v_filas = row_count;
  /* Sin plan no hay dónde guardar la nota. Se dice explícito en vez de
     devolver ok con un update de 0 filas: si no, el texto se escribe, la
     pantalla dice "guardado" y al recargar no está. */
  if v_filas = 0 then
    raise exception 'sin_suscripcion';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.guardar_notas(uuid, text) from public, authenticated, anon;
grant  execute on function public.guardar_notas(uuid, text) to service_role;
