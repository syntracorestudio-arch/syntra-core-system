-- ===========================================================================
-- verify-promos-cross-tenant.sql — 059
--
-- La fuga que esto cierra estuvo VIVA en main: `promo_vigente` y `promo_precio`
-- eran `security definer`, recibían el `store_id` de quien llamaba y no
-- chequeaban membresía. Cualquier usuario de cualquier kiosco leía promos,
-- costos congelados y precios de otro kiosco.
--
-- Se prueba en las DOS direcciones y, sobre todo, se prueba que EL POS SIGA
-- VENDIENDO: un arreglo de aislamiento que rompe el camino de cobro es peor
-- que la fuga.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · el ataque cross-tenant ya no entra =='
begin;
do $$
declare
  v_luci  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';  -- cajera del negocio 1
  v_ajeno uuid := '33333333-3333-3333-3333-333333333333';  -- negocio 3
  v_prod  uuid;
begin
  select id into v_prod from public.products where store_id = v_ajeno limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);

  /* La segunda cerradura: sin el grant, `authenticated` no llega ni a evaluar
     la guarda. Antes de 059 esto devolvia el precio del producto ajeno. */
  begin
    perform public.promo_precio(v_ajeno, v_prod);
    raise exception 'FALLO 1.a: una cajera leyo el precio de otro kiosco';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.promo_vigente(v_ajeno, v_prod);
    raise exception 'FALLO 1.b: una cajera leyo la promo de otro kiosco (con cost_at_start)';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 1 · sin grant para authenticated: ni el precio ni la promo ajena'

\echo ''
\echo '== 2 · la guarda interna, por si alguien re-otorga el permiso =='
begin;
do $$
declare
  v_luci  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_ajeno uuid := '33333333-3333-3333-3333-333333333333';
  v_prod  uuid;
begin
  select id into v_prod from public.products where store_id = v_ajeno limit 1;

  /* La leccion del hallazgo de `admin_stores`: una superficie con UNA sola
     cerradura se abre sola el dia que alguien agrega un grant de mas. Se
     simula ese error y se comprueba que la funcion se defiende igual. */
  grant execute on function public.promo_precio(uuid, uuid) to authenticated;
  grant execute on function public.promo_vigente(uuid, uuid) to authenticated;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);

  begin
    perform public.promo_precio(v_ajeno, v_prod);
    raise exception 'FALLO 2.a: con el grant puesto, la guarda interna no frena';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;

  begin
    perform public.promo_vigente(v_ajeno, v_prod);
    raise exception 'FALLO 2.b: promo_vigente sin guarda interna';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 2 · dos cerraduras: aunque se re-otorgue el grant, la guarda frena'

\echo ''
\echo '== 3 · REGRESION: el POS sigue vendiendo, y con el precio de promo =='
begin;
do $$
declare
  v_store  uuid := '33333333-3333-3333-3333-333333333333';
  v_sofia  uuid := '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
  v_prod   uuid;
  v_promo  numeric;
  v_res    jsonb;
  v_precio numeric;
  v_n      int;
begin
  -- Un producto de ESE negocio con promo viva.
  select p.product_id, p.promo_price into v_prod, v_promo
    from public.promos p
   where p.store_id = v_store and p.ended_at is null
     and p.starts_on <= public.store_hoy(v_store)
     and p.ends_on   >= public.store_hoy(v_store)
   limit 1;

  if v_prod is null then
    raise notice 'sin promo viva en el fixture: se saltea el bloque 3';
    return;
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);

  /* `register_sale` llama a `promo_vigente` por dentro. Si la guarda estuviera
     mal escrita, la venta se caeria con not_a_member — y un arreglo de
     aislamiento que rompe el camino de cobro es peor que la fuga. */
  v_res := public.register_sale(v_store,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1)),
    'cash'::text, gen_random_uuid()::text);

  perform set_config('role', 'postgres', true);
  select unit_price into v_precio from public.sale_items
   where sale_id = (v_res->>'sale_id')::uuid limit 1;

  if v_precio is distinct from v_promo then
    raise exception 'FALLO 3: se cobro % y la promo vigente es %', v_precio, v_promo;
  end if;

  -- Y los tiles del POS se siguen armando (tambien llaman a promo_vigente).
  perform set_config('role', 'authenticated', true);
  select count(*) into v_n
    from jsonb_array_elements(public.pos_destacados(v_store, 24)::jsonb);
  if v_n = 0 then
    raise exception 'FALLO 3.b: pos_destacados dejo de devolver tiles';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 3 · se vende con el precio de promo y los tiles se arman igual'

\echo ''
\echo '========================================================================'
\echo ' verify-promos-cross-tenant · TODO EN VERDE'
\echo '========================================================================'
