-- =============================================================================
-- StockFlow — 030_split_dos_electronicas.sql  (Split con DOS patas electrónicas:
-- tarjeta al posnet + QR, cada una un cobro MP asíncrono independiente)
--
-- Hasta el Paso 3 (029) el split tenía UNA sola pata electrónica (tarjeta O QR). Con
-- dos, aparece un estado que antes no existía: la "venta a medio cobrar" — una pata
-- acreditada y la otra no. Para gestionarlo hace falta LIGAR las dos patas y no
-- registrar la venta hasta que las DOS acreditan.
--
--   · payment_intents.split_group_id uuid — agrupa las patas de un mismo split. Cada
--     pata sigue siendo un intento independiente (su propio amount = su parte, su
--     propia idempotency_key, su propia orden MP); el grupo las une para el cierre y
--     la recuperación.
--   · crear_intento_cobro_split gana p_group_id (guarda el grupo en cada pata). El
--     resto igual que 029: cobra SU pata (p_leg_amount), valida que el reparto sume el
--     total del carrito server-side, y guarda el reparto completo (split_pagos).
--   · register_split_group — registra la venta split RECIÉN cuando TODAS las patas del
--     grupo están 'approved'. Si falta una → group_incomplete (jamás una venta con una
--     pata sin cobrar). Atómico (reusa register_split_sale con p_paid=true) y vincula
--     las DOS patas a la venta. Idempotente por la clave compartida.
--
-- Aditivo. Aplicar DESPUÉS de 029. La corre el owner.
-- =============================================================================

-- 1) El grupo que liga las patas de un mismo split de dos electrónicas.
alter table public.payment_intents
  add column if not exists split_group_id uuid;

-- Índice parcial: la recuperación y el registro de grupo buscan por (store, grupo).
create index if not exists payment_intents_group_idx
  on public.payment_intents (store_id, split_group_id)
  where split_group_id is not null;

-- 2) crear_intento_cobro_split + p_group_id. Cambia la firma (se agrega p_group_id al
--    final, con default null) → drop del de 029 + create. Los callers de 6 args (029)
--    siguen andando: usan args nombrados y p_group_id toma su default.
drop function if exists public.crear_intento_cobro_split(uuid, jsonb, jsonb, numeric, text, uuid);

create or replace function public.crear_intento_cobro_split(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_leg_amount      numeric,  -- monto de la pata electrónica (tarjeta o QR) que cobra MP
  p_idempotency_key text,
  p_client_id       uuid default null,
  p_group_id        uuid default null  -- grupo del split de dos electrónicas (null = una sola pata)
) returns public.payment_intents
language plpgsql security definer set search_path = public as $$
declare
  v_member     public.members;
  v_intent     public.payment_intents;
  v_item       jsonb;
  v_product    public.products;
  v_qty        numeric(12,3);
  v_unit_price numeric(12,2);
  v_total      numeric(12,2) := 0;
  v_is_free    boolean;
  v_suma       numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  -- Reintento del mismo cobro (la caja perdió la respuesta): devolver el que hay.
  select * into v_intent from public.payment_intents
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    return v_intent;
  end if;

  -- Total AUTORITATIVO del carrito (mismo cálculo que crear_intento_cobro / register_sale).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_is_free := (v_item->>'product_id') is null;
    v_qty := coalesce((v_item->>'qty')::numeric, 1);
    if v_qty <= 0 then
      raise exception 'invalid_qty';
    end if;

    if v_is_free then
      v_unit_price := (v_item->>'free_amount')::numeric;
      if v_unit_price is null or v_unit_price <= 0 then
        raise exception 'invalid_amount';
      end if;
    else
      select * into v_product from public.products
       where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
      if not found then
        raise exception 'product_not_found';
      end if;
      if v_product.status <> 'active' then
        raise exception 'product_archived';
      end if;
      if (v_item->>'unit_price') is not null then
        if not (v_member.role = 'owner' or v_member.can_apply_discount) then
          raise exception 'not_allowed';
        end if;
        v_unit_price := (v_item->>'unit_price')::numeric;
        if v_unit_price < 0 then
          raise exception 'invalid_amount';
        end if;
      else
        v_unit_price := v_product.price;
      end if;
    end if;

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  if v_total <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Reparto válido: ≥2 partes, métodos permitidos, todo > 0, y que sume el total.
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) < 2 then
    raise exception 'split_needs_two';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
     where x.method is null or x.method not in ('cash','card','transfer','qr')
        or x.amount is null or x.amount <= 0
  ) then
    raise exception 'invalid_split_payment';
  end if;

  select coalesce(sum(x.amount), 0) into v_suma
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);
  if abs(v_suma - v_total) > 0.01 then
    raise exception 'split_sum_mismatch';
  end if;

  -- La pata electrónica es PARCIAL (el split tiene ≥2 partes >0): 0 < leg < total.
  if p_leg_amount is null or p_leg_amount <= 0 or p_leg_amount > v_total + 0.01 then
    raise exception 'invalid_leg_amount';
  end if;

  -- El intento cobra SOLO la pata electrónica (lo que MP carga). `estadoCobro` compara
  -- el acreditado contra este `amount`. El reparto completo queda guardado para
  -- registrar la venta split al acreditar (o recuperarla si la caja se cae). El grupo
  -- (cuando lo hay) liga esta pata con la otra electrónica de la misma venta.
  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key, split_pagos, split_group_id
  ) values (
    p_store_id, v_member.id, p_leg_amount, p_items, p_client_id, p_idempotency_key, p_pagos, p_group_id
  ) returning * into v_intent;

  return v_intent;
end;
$$;

grant execute on function public.crear_intento_cobro_split(uuid, jsonb, jsonb, numeric, text, uuid, uuid) to authenticated;

-- 3) register_split_group: cierra un split de dos electrónicas. Solo registra la venta
--    cuando TODAS las patas del grupo acreditaron; si no, group_incomplete. Reusa la
--    RPC atómica register_split_sale (register_sale + reparto en la misma transacción)
--    y vincula las DOS patas a la venta. Idempotente por p_idempotency_key.
create or replace function public.register_split_group(
  p_store_id        uuid,
  p_group_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res        jsonb;
  v_sale       uuid;
  v_n_group    integer;   -- patas del grupo
  v_n_approved integer;   -- patas del grupo acreditadas
  v_sum_group  numeric(12,2);  -- suma de lo cobrado por las patas del grupo
  v_n_elec     integer;   -- partes electrónicas del reparto (card/qr)
  v_sum_elec   numeric(12,2);  -- suma de las partes electrónicas del reparto
begin
  perform public.rpc_member(p_store_id);

  if p_group_id is null then
    raise exception 'group_incomplete';
  end if;

  -- Estado del grupo: cuántas patas hay y cuántas acreditaron, y cuánto sumaron.
  select count(*),
         count(*) filter (where status = 'approved'),
         coalesce(sum(amount) filter (where status = 'approved'), 0)
    into v_n_group, v_n_approved, v_sum_group
    from public.payment_intents
   where store_id = p_store_id and split_group_id = p_group_id;

  -- Partes electrónicas esperadas del reparto (las que se cobran por MP: card/qr).
  select count(*), coalesce(sum(amount), 0)
    into v_n_elec, v_sum_elec
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
   where x.method in ('card', 'qr');

  -- Grupo completo = tantas patas como partes electrónicas, y TODAS acreditadas. Si
  -- falta una (nunca se creó, o no acreditó) → nunca registramos una venta a medias.
  if v_n_group = 0 or v_n_group <> v_n_elec or v_n_approved <> v_n_group then
    raise exception 'group_incomplete';
  end if;

  -- Binding de monto del grupo: lo cobrado por las patas tiene que igualar las partes
  -- electrónicas del reparto. Defensa en profundidad sobre el binding por pata.
  if abs(v_sum_group - v_sum_elec) > 0.01 then
    raise exception 'group_amount_mismatch';
  end if;

  -- Registrar la venta (atómica, con el reparto imputado). La plata ya entró por las
  -- dos patas → p_paid=true. Idempotente por la clave compartida.
  v_res := public.register_split_sale(
             p_store_id := p_store_id,
             p_items := p_items,
             p_pagos := p_pagos,
             p_idempotency_key := p_idempotency_key,
             p_paid := true
           );
  v_sale := (v_res->>'sale_id')::uuid;

  -- Vincular las DOS patas a la venta (cierra el grupo; deja de ser "a medio cobrar").
  update public.payment_intents
     set sale_id = v_sale
   where store_id = p_store_id and split_group_id = p_group_id and sale_id is null;

  return v_res;
end;
$$;

grant execute on function public.register_split_group(uuid, uuid, jsonb, jsonb, text) to authenticated;