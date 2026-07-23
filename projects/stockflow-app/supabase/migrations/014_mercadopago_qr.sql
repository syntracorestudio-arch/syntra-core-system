-- =============================================================================
-- StockFlow — 014_mercadopago_qr.sql  (Fase 2, tanda 2A)
-- Cobro con QR de MercadoPago, cuenta propia de cada negocio.
--
-- SYNTRA no intermedia fondos: la plata va directo a la cuenta del kiosquero.
-- Nosotros solo pedimos el QR con el monto exacto y escuchamos la confirmación.
--
-- Tres tablas:
--   · store_payment_providers — la credencial del negocio. access_token y
--     webhook_secret van CIFRADOS a nivel app (AES-256-GCM, clave en MP_ENC_KEY).
--     SIN políticas: solo service_role. Ni el dueño la lee desde su navegador.
--   · payment_intents — un cobro pedido a MP. Guarda el CARRITO, no solo el monto:
--     si el navegador de la caja se muere después de que el cliente pagó, la venta
--     se puede registrar igual desde Caja. La plata entró; la venta no se pierde.
--   · mp_webhook_events — idempotencia de webhooks.
--
-- La venta NO se registra acá. `register_sale` sigue siendo el único camino, con
-- su misma clave de idempotencia: el poll de la caja y la recuperación desde Caja
-- pueden intentarlo las veces que quieran y siempre resulta UNA venta.
-- =============================================================================

-- ---------- store_payment_providers ----------
create table if not exists public.store_payment_providers (
  store_id          uuid primary key references public.stores(id) on delete cascade,
  provider          text not null default 'mercadopago' check (provider in ('mercadopago')),
  status            text not null default 'connected' check (status in ('connected','disconnected')),
  access_token      text not null,            -- CIFRADO (AES-GCM). Nunca texto plano.
  webhook_secret    text,                     -- CIFRADO. Clave de firma que da MP.
  mp_user_id        text not null,            -- collector_id: dueño del dinero.
  mp_nickname       text,                     -- para mostrar "conectado como …"
  -- Sucursal y caja que creamos en la cuenta del negocio vía API. Sin esto no hay
  -- QR: MP exige que toda orden presencial cuelgue de una caja concreta.
  external_store_id text,
  external_pos_id   text,
  mp_pos_id         text,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger store_payment_providers_touch before update on public.store_payment_providers
  for each row execute function public.touch_updated_at();

alter table public.store_payment_providers enable row level security;
alter table public.store_payment_providers force row level security;
-- Sin políticas a propósito: el token solo se toca con service_role desde el
-- servidor. El estado que ve la UI viaja por server action, ya filtrado.

-- ---------- payment_intents ----------
create table if not exists public.payment_intents (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  currency        text not null default 'ARS',
  -- El carrito tal cual se lo vamos a pasar a register_sale. Es lo que permite
  -- recuperar una venta cuya caja se cayó con el cobro ya hecho.
  items           jsonb not null,
  client_id       uuid references public.clients(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','expired','cancelled')),
  -- La misma clave que después usa register_sale: reintentar es gratis.
  idempotency_key text not null,
  mp_order_id     text,
  mp_payment_id   text,
  qr_data         text,
  sale_id         uuid references public.sales(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '15 minutes',
  updated_at      timestamptz not null default now()
);

create unique index payment_intents_idem_uq on public.payment_intents (store_id, idempotency_key);
-- Cota de fecha en el índice de listado: la pantalla de Caja mira un día, no la historia.
create index payment_intents_store_idx on public.payment_intents (store_id, created_at desc);
-- Para el webhook: resolver la orden de MP sin escanear la tabla.
create unique index payment_intents_order_uq on public.payment_intents (mp_order_id)
  where mp_order_id is not null;
-- Para la recuperación: cobros aprobados que no llegaron a ser venta.
create index payment_intents_huerfanos_idx on public.payment_intents (store_id, created_at desc)
  where status = 'approved' and sale_id is null;

create trigger payment_intents_touch before update on public.payment_intents
  for each row execute function public.touch_updated_at();

alter table public.payment_intents enable row level security;
alter table public.payment_intents force row level security;

-- Lectura: cualquier miembro del negocio (la caja necesita ver su propio cobro).
-- El qr_data no es secreto — es justamente lo que el cliente escanea.
create policy payment_intents_read on public.payment_intents
  for select using (store_id in (select public.auth_member_stores()));

-- Sin políticas de escritura: se crean y se mueven por RPC / service_role, igual
-- que las ventas y los ledgers. Nadie marca un cobro como aprobado a mano.

-- ---------- mp_webhook_events ----------
create table if not exists public.mp_webhook_events (
  event_id     text primary key,
  store_id     uuid references public.stores(id) on delete cascade,
  type         text,
  processed_at timestamptz not null default now()
);

alter table public.mp_webhook_events enable row level security;
alter table public.mp_webhook_events force row level security;
-- Sin políticas: service_role únicamente.

-- =============================================================================
-- crear_intento_cobro — la caja pide un cobro con QR.
--
-- Valida el monto contra el carrito ACÁ y no en el cliente: el monto que se le
-- muestra al cliente para pagar no puede salir de un número que viaja por la red.
-- =============================================================================
create or replace function public.crear_intento_cobro(
  p_store_id        uuid,
  p_items           jsonb,
  p_amount          numeric,
  p_idempotency_key text,
  p_client_id       uuid default null
) returns public.payment_intents
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_intent public.payment_intents;
begin
  v_member := public.rpc_member(p_store_id);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Reintento del mismo cobro (la caja perdió la respuesta): devolver el que hay.
  select * into v_intent from public.payment_intents
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    return v_intent;
  end if;

  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key
  ) values (
    p_store_id, v_member.id, p_amount, p_items, p_client_id, p_idempotency_key
  ) returning * into v_intent;

  return v_intent;
end;
$$;

-- =============================================================================
-- marcar_intento — mueve el estado de un cobro. La caja solo puede CANCELAR el
-- suyo; aprobar es potestad exclusiva del webhook (service_role), porque la
-- verdad del pago vive en MercadoPago y no en el navegador del negocio.
-- =============================================================================
create or replace function public.cancelar_intento(p_store_id uuid, p_intent_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  update public.payment_intents
     set status = 'cancelled'
   where id = p_intent_id
     and store_id = p_store_id
     and status = 'pending';
end;
$$;

-- =============================================================================
-- vincular_venta_a_cobro — cierra el círculo: esta venta salió de este cobro.
-- Se llama después de register_sale, con la venta ya creada.
-- =============================================================================
create or replace function public.vincular_venta_a_cobro(
  p_store_id  uuid,
  p_intent_id uuid,
  p_sale_id   uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  update public.payment_intents
     set sale_id = p_sale_id
   where id = p_intent_id
     and store_id = p_store_id
     and sale_id is null;
end;
$$;

-- =============================================================================
-- cobros_sin_venta — la red de seguridad.
--
-- Un cobro aprobado sin venta significa que el cliente pagó y la caja no llegó a
-- registrar (se cayó el navegador, se cortó la luz). La plata está; la venta no.
-- Esto lo hace VISIBLE en la pantalla de Caja en lugar de dejarlo enterrado.
-- =============================================================================
create or replace function public.cobros_sin_venta(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pi.id, 'monto', pi.amount, 'items', pi.items,
             'idempotency_key', pi.idempotency_key, 'client_id', pi.client_id,
             'cuando', pi.created_at
           ) order by pi.created_at desc), '[]'::jsonb)
      from public.payment_intents pi
     where pi.store_id = p_store_id
       and pi.status = 'approved'
       and pi.sale_id is null
       -- Cota dura: si algo quedó huérfano hace una semana, ya no es un incidente
       -- de caja sino un tema de reportes. La pantalla de Caja mira lo reciente.
       and pi.created_at >= now() - interval '7 days'
  );
end;
$$;

grant execute on function public.crear_intento_cobro(uuid, jsonb, numeric, text, uuid) to authenticated;
grant execute on function public.cancelar_intento(uuid, uuid) to authenticated;
grant execute on function public.vincular_venta_a_cobro(uuid, uuid, uuid) to authenticated;
grant execute on function public.cobros_sin_venta(uuid) to authenticated;

grant select on public.payment_intents to authenticated;

-- ---------- Privilegios de service_role (explícitos, a propósito) ----------
-- La 001 hace `grant ... on all tables in schema public to service_role`, pero eso
-- es una FOTO del momento: las tablas que nacen después no quedan incluidas. Sin
-- estas tres líneas, el servidor no puede ni guardar la credencial de MercadoPago
-- (falla el upsert con un error que no dice nada). Cada migración que crea tablas
-- tiene que otorgar lo suyo — no confiar en defaults ni en grants anteriores.
grant select, insert, update, delete on public.store_payment_providers to service_role;
grant select, insert, update, delete on public.payment_intents           to service_role;
grant select, insert, update, delete on public.mp_webhook_events         to service_role;

-- authenticated/anon NO reciben nada sobre store_payment_providers ni
-- mp_webhook_events: el token cifrado y el log de webhooks son solo del servidor.