-- =============================================================================
-- StockFlow — 004_fiado_rpcs.sql  (tanda 1C)
--
-- Cuenta corriente de clientes. Mismo patrón que el stock: el saldo NUNCA es un
-- contador mutable, siempre es la suma del ledger. Acá viven el cobro de fiado
-- y el ajuste manual del dueño.
-- =============================================================================

-- =============================================================================
-- register_client_payment — el cliente paga (total o parcial).
-- Un pago mayor que la deuda está permitido: queda a favor y el delta positivo
-- lo modela solo, sin caso especial.
-- =============================================================================
create or replace function public.register_client_payment(
  p_store_id       uuid,
  p_client_id      uuid,
  p_amount         numeric,
  p_payment_method text,
  p_note           text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_client  public.clients;
  v_balance numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_sell_on_credit) then
    raise exception 'not_allowed';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- El pago de fiado entra a la caja del día en que se cobra, así que necesita
  -- medio de pago propio (business-rules §4). 'account' no aplica: sería pagar
  -- una deuda con otra deuda.
  if p_payment_method not in ('cash','qr','card','transfer') then
    raise exception 'invalid_payment_method';
  end if;

  select * into v_client from public.clients
   where id = p_client_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'client_not_found';
  end if;

  insert into public.client_ledger (store_id, client_id, delta, reason,
                                    payment_method, note, created_by)
  values (p_store_id, p_client_id, p_amount, 'payment', p_payment_method,
          p_note, v_member.id);

  select coalesce(sum(delta), 0) into v_balance
    from public.client_ledger where client_id = p_client_id;

  return jsonb_build_object(
    'client_id', p_client_id,
    'balance', v_balance,
    'settled', v_balance >= 0
  );
end;
$$;

-- =============================================================================
-- adjust_client_balance — corrección manual del dueño (perdonar una deuda,
-- corregir una carga mal hecha). Solo owner: es plata.
-- =============================================================================
create or replace function public.adjust_client_balance(
  p_store_id  uuid,
  p_client_id uuid,
  p_delta     numeric,
  p_note      text
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_balance numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'note_required';  -- un ajuste de plata sin motivo no se audita
  end if;

  perform 1 from public.clients
   where id = p_client_id and store_id = p_store_id for update;
  if not found then
    raise exception 'client_not_found';
  end if;

  insert into public.client_ledger (store_id, client_id, delta, reason, note, created_by)
  values (p_store_id, p_client_id, p_delta, 'adjust', p_note, v_member.id);

  select coalesce(sum(delta), 0) into v_balance
    from public.client_ledger where client_id = p_client_id;

  return v_balance;
end;
$$;

grant execute on function public.register_client_payment(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.adjust_client_balance(uuid, uuid, numeric, text) to authenticated;