-- =============================================================================
-- StockFlow — 031_split_dos_medio_cobrar.sql  (Recuperación "a medio cobrar" del
-- split de dos electrónicas: una pata cobrada, la otra no)
--
-- El Paso 1 abrió un estado nuevo: la caja se cae entre las dos patas y queda una
-- acreditada y la otra no = plata capturada sin venta. Esta migración lo hace
-- recuperable:
--
--   · payment_intents.split_leg_method — qué método electrónico cobra ESTA pata
--     ('card' o 'qr'). Deja el estado del grupo sin ambigüedad (tarjeta y QR pueden
--     tener el mismo monto): el banner puede decir "cobraste $X con tarjeta, falta
--     $Y en QR" y la caja sabe qué pata reabrir. crear_intento_cobro_split lo guarda.
--   · grupos_a_medio_cobrar — grupos con ≥1 pata acreditada, sin venta, no cerrados.
--     Devuelve por grupo lo cobrado y lo que falta. Lectura acotada (7 días).
--   · cobros_sin_venta ahora EXCLUYE las patas de un grupo (split_group_id not null):
--     las maneja el banner de grupo, no el de huérfanos simple. Recuperar una pata de
--     grupo por el camino viejo saltearía la verificación del grupo.
--
-- register_split_group NO cambia: las claves deterministas por método garantizan una
-- sola pata por método, así que su chequeo por conteo/monto (030) sigue siendo correcto.
--
-- Aditivo. Aplicar DESPUÉS de 030. La corre el owner.
-- =============================================================================

-- 1) El método electrónico que cobra cada pata del grupo (para el estado sin ambigüedad).
alter table public.payment_intents
  add column if not exists split_leg_method text
    check (split_leg_method is null or split_leg_method in ('card', 'qr'));

-- 2) crear_intento_cobro_split + p_leg_method. Cambia la firma (se agrega al final, con
--    default null) → drop del de 030 + create. Los callers de 7 args (030) siguen
--    andando: usan args nombrados y p_leg_method toma su default.
drop function if exists public.crear_intento_cobro_split(uuid, jsonb, jsonb, numeric, text, uuid, uuid);

create or replace function public.crear_intento_cobro_split(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_leg_amount      numeric,  -- monto de la pata electrónica (tarjeta o QR) que cobra MP
  p_idempotency_key text,
  p_client_id       uuid default null,
  p_group_id        uuid default null,   -- grupo del split de dos electrónicas
  p_leg_method      text default null    -- 'card' | 'qr': qué método cobra esta pata
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

  -- Método de pata válido cuando se manda (el resto de la validación es igual que 030).
  if p_leg_method is not null and p_leg_method not in ('card', 'qr') then
    raise exception 'invalid_leg_method';
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

  -- El intento cobra SOLO la pata electrónica (lo que MP carga). El reparto completo
  -- queda guardado para registrar la venta al acreditar; el grupo + el método de pata
  -- ligan y etiquetan esta pata para el cierre verificado y la recuperación.
  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key,
    split_pagos, split_group_id, split_leg_method
  ) values (
    p_store_id, v_member.id, p_leg_amount, p_items, p_client_id, p_idempotency_key,
    p_pagos, p_group_id, p_leg_method
  ) returning * into v_intent;

  return v_intent;
end;
$$;

grant execute on function public.crear_intento_cobro_split(uuid, jsonb, jsonb, numeric, text, uuid, uuid, text) to authenticated;

-- 3) grupos_a_medio_cobrar: grupos con al menos una pata acreditada, sin venta y sin
--    cerrar. Devuelve por grupo lo cobrado (patas acreditadas, por método) y lo que
--    falta (partes electrónicas del reparto sin pata acreditada). Acotado a 7 días,
--    como el banner de huérfanos.
create or replace function public.grupos_a_medio_cobrar(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  return (
    with grupos as (
      select pi.split_group_id as group_id,
             -- El reparto y los items son iguales en todas las patas del grupo.
             (array_agg(pi.split_pagos order by pi.created_at))[1]   as split_pagos,
             (array_agg(pi.items order by pi.created_at))[1]         as items,
             (array_agg(pi.client_id order by pi.created_at))[1]     as client_id,
             min(pi.created_at)                                      as cuando,
             count(*) filter (where pi.status = 'approved')          as n_approved
        from public.payment_intents pi
       where pi.store_id = p_store_id
         and pi.split_group_id is not null
         and pi.sale_id is null
         and pi.created_at >= now() - interval '7 days'
       group by pi.split_group_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'group_id', g.group_id,
             'items', g.items,
             'split_pagos', g.split_pagos,
             'total', (select coalesce(sum((p->>'amount')::numeric), 0)
                         from jsonb_array_elements(g.split_pagos) p),
             'client_id', g.client_id,
             'cuando', g.cuando,
             -- Cobrado: patas acreditadas del grupo, por su método y monto.
             'cobrado', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'method', pi.split_leg_method, 'amount', pi.amount)
                        order by pi.created_at), '[]'::jsonb)
                 from public.payment_intents pi
                where pi.store_id = p_store_id
                  and pi.split_group_id = g.group_id
                  and pi.status = 'approved'
             ),
             -- Pendiente: partes electrónicas del reparto sin una pata acreditada.
             'pendiente', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'method', x.method, 'amount', x.amount)), '[]'::jsonb)
                 from jsonb_to_recordset(g.split_pagos) as x(method text, amount numeric)
                where x.method in ('card', 'qr')
                  and not exists (
                    select 1 from public.payment_intents pi
                     where pi.store_id = p_store_id
                       and pi.split_group_id = g.group_id
                       and pi.status = 'approved'
                       and pi.split_leg_method = x.method
                  )
             )
           ) order by g.cuando desc), '[]'::jsonb)
      from grupos g
     -- Solo lo que tiene plata en juego: al menos una pata acreditada.
     where g.n_approved >= 1
  );
end;
$$;

grant execute on function public.grupos_a_medio_cobrar(uuid) to authenticated;

-- 4) cobros_sin_venta EXCLUYE las patas de un grupo: las recupera el banner de grupo,
--    no el de huérfanos simple (recuperarlas por el camino viejo saltearía la
--    verificación del grupo). El split QR de una sola pata (Paso 2, sin grupo) sigue.
create or replace function public.cobros_sin_venta(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pi.id,
             'monto', coalesce(
               (select sum((p->>'amount')::numeric) from jsonb_array_elements(pi.split_pagos) p),
               pi.amount),
             'items', pi.items,
             'idempotency_key', pi.idempotency_key,
             'client_id', pi.client_id,
             'split_pagos', pi.split_pagos,
             'cuando', pi.created_at
           ) order by pi.created_at desc), '[]'::jsonb)
      from public.payment_intents pi
     where pi.store_id = p_store_id
       and pi.status = 'approved'
       and pi.sale_id is null
       and pi.split_group_id is null   -- patas de grupo → banner de grupo, no acá
       and pi.created_at >= now() - interval '7 days'
  );
end;
$$;

grant execute on function public.cobros_sin_venta(uuid) to authenticated;

-- 5) register_split_group endurecido: verifica por MÉTODO acreditado (split_leg_method),
--    no por conteo de intentos. Así tolera patas abandonadas (un QR que expiró y se
--    resumió con otra clave): solo cuentan las patas ACREDITADAS, una por método. El
--    binding de monto sigue: lo acreditado por el grupo == las partes electrónicas.
--    (Reemplaza el chequeo por conteo de 030; las claves deterministas del Paso 1 ya
--    daban una pata por método, así que el Paso 1 sigue válido con leg_method seteado.)
create or replace function public.register_split_group(
  p_store_id        uuid,
  p_group_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res       jsonb;
  v_sale      uuid;
  v_n_elec    integer;        -- partes electrónicas del reparto (card/qr)
  v_missing   integer;        -- métodos electrónicos sin pata acreditada
  v_sum_group numeric(12,2);  -- suma acreditada por las patas del grupo
  v_sum_elec  numeric(12,2);  -- suma de las partes electrónicas del reparto
begin
  perform public.rpc_member(p_store_id);

  if p_group_id is null then
    raise exception 'group_incomplete';
  end if;

  -- Partes electrónicas esperadas del reparto (las que se cobran por MP: card/qr).
  select count(*), coalesce(sum(amount), 0)
    into v_n_elec, v_sum_elec
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
   where x.method in ('card', 'qr');
  if v_n_elec = 0 then
    raise exception 'group_incomplete';
  end if;

  -- Completo = CADA método electrónico del reparto tiene una pata acreditada en el grupo.
  -- Si falta una (nunca se cobró, o no acreditó) → nunca registramos una venta a medias.
  select count(*)
    into v_missing
    from (select distinct method
            from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
           where method in ('card', 'qr')) em
   where not exists (
           select 1 from public.payment_intents pi
            where pi.store_id = p_store_id
              and pi.split_group_id = p_group_id
              and pi.status = 'approved'
              and pi.split_leg_method = em.method
         );
  if v_missing > 0 then
    raise exception 'group_incomplete';
  end if;

  -- Binding de monto del grupo: lo acreditado por sus patas == partes electrónicas del
  -- reparto (atrapa un doble cobro de la misma pata: sumaría de más).
  select coalesce(sum(amount), 0)
    into v_sum_group
    from public.payment_intents
   where store_id = p_store_id and split_group_id = p_group_id and status = 'approved';
  if abs(v_sum_group - v_sum_elec) > 0.01 then
    raise exception 'group_amount_mismatch';
  end if;

  -- Registrar la venta (atómica, con el reparto imputado). La plata ya entró → p_paid.
  v_res := public.register_split_sale(
             p_store_id := p_store_id,
             p_items := p_items,
             p_pagos := p_pagos,
             p_idempotency_key := p_idempotency_key,
             p_paid := true
           );
  v_sale := (v_res->>'sale_id')::uuid;

  -- Vincular las patas ACREDITADAS a la venta (cierra el grupo). Las abandonadas quedan
  -- como intentos sueltos sin venta, inofensivos (no vuelven al banner: el grupo ya cerró).
  update public.payment_intents
     set sale_id = v_sale
   where store_id = p_store_id and split_group_id = p_group_id
     and status = 'approved' and sale_id is null;

  return v_res;
end;
$$;

grant execute on function public.register_split_group(uuid, uuid, jsonb, jsonb, text) to authenticated;