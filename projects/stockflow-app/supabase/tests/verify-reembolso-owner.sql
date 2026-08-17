-- ===========================================================================
-- verify-reembolso-owner.sql — 054
--
-- Prueba las DOS direcciones sobre las tres RPCs que 054 pasó a owner, y en
-- particular la que puede dejar a un cliente sin su plata:
-- `marcar_pata_reembolsada` marca approved → refunded, y `reembolsarGrupo`
-- sólo procesa patas `approved` ⇒ una pata marcada a mano por un empleado
-- SALTEA EL REEMBOLSO REAL PARA SIEMPRE.
--
-- Cajera del negocio 1 (Luci) contra su propio negocio: no se está probando
-- aislamiento entre negocios (eso ya lo cubre verify-permisos), sino el
-- recorte entre el dueño y SU empleado.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · la CAJERA no puede tocar ninguna de las tres =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_luci  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_intent uuid;
begin
  -- Con TODOS los permisos puestos: el caso más permisivo posible. Ninguno de
  -- los flags de empleado habilita esto, y de eso se trata el test.
  update public.members
     set can_sell_on_credit = true, can_void_sale = true,
         can_receive_stock = true, can_see_costs = true,
         can_close_register = true, can_see_reports = true
   where profile_id = v_luci;

  select id into v_intent from public.payment_intents
   where store_id = v_store limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);

  begin
    perform public.grupos_a_medio_cobrar(v_store);
    raise exception 'FALLO 1.a: una cajera leyó los grupos a medio cobrar';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  begin
    perform public.cobros_sin_venta(v_store);
    raise exception 'FALLO 1.b: una cajera leyó los cobros sin venta';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  -- La grave: marcar una pata como reembolsada sin mover un peso.
  if v_intent is not null then
    begin
      perform public.marcar_pata_reembolsada(v_store, v_intent);
      raise exception 'FALLO 1.c: una cajera marcó una pata como REEMBOLSADA — el cliente no cobra nunca y el sistema dice que sí';
    exception when sqlstate 'P0001' then
      if sqlerrm <> 'not_allowed' then raise; end if;
    end;
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 1 · las tres levantan not_allowed para la cajera (con todos los flags puestos)'

\echo ''
\echo '== 2 · el DUEÑO no perdió nada =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_duena uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duena), true);

  perform public.grupos_a_medio_cobrar(v_store);
  perform public.cobros_sin_venta(v_store);

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 2 · la dueña sigue leyendo las dos'

\echo ''
\echo '== 3 · marcar_pata_reembolsada sigue siendo idempotente y acotada =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_duena uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_id    uuid;
  v_out   public.payment_intents;
begin
  -- Pata approved, sin venta: la única reembolsable.
  insert into public.payment_intents (store_id, member_id, amount, status, sale_id,
                                     items, idempotency_key)
  select v_store, m.id, 100, 'approved', null, '[]'::jsonb, 'test-054-' || gen_random_uuid()
    from public.members m
   where m.store_id = v_store and m.role = 'owner'
   limit 1
  returning id into v_id;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duena), true);

  v_out := public.marcar_pata_reembolsada(v_store, v_id);
  if v_out.status <> 'refunded' then
    raise exception 'FALLO 3.a: no marcó refunded';
  end if;

  -- Segunda vez: devuelve sin romper (reintento del mismo reembolso).
  v_out := public.marcar_pata_reembolsada(v_store, v_id);
  if v_out.status <> 'refunded' then
    raise exception 'FALLO 3.b: dejó de ser idempotente';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 3 · marca, es idempotente, y el gate no rompió el camino del dueño'

\echo ''
\echo '========================================================================'
\echo ' verify-reembolso-owner · TODO EN VERDE'
\echo '========================================================================'
