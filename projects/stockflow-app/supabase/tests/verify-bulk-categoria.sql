-- =============================================================================
-- StockFlow — verify-bulk-categoria.sql
-- Invariantes de datos de "categorizar en masa" (bulkAssignCategory):
-- el UPDATE masivo de category_id corre bajo RLS como usuario autenticado.
--
--   1. Con un id AJENO colado en el array, el update devuelve SOLO las filas
--      propias (el contador honesto que muestra la UI) y las mueve de verdad.
--   2. La fila del otro negocio queda intacta (verificado sin RLS).
--   3. Quitar categoría en masa (null) también funciona.
--
-- Requiere: migraciones + seed (fixture El Trébol / Doña Rosa).
-- Todo dentro de una transacción con ROLLBACK: no deja rastro.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- Setup (sin RLS): un producto del otro negocio para colarlo en el array.
create temp table _ajeno on commit drop as
  select id, category_id
    from public.products
   where store_id <> '11111111-1111-1111-1111-111111111111'
     and status = 'active'
   limit 1;

grant select on _ajeno to authenticated;

-- Impersonar al dueño del Trébol.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_trebol constant uuid := '11111111-1111-1111-1111-111111111111';
  v_cat_bebidas constant uuid := 'c1000000-0000-0000-0000-000000000001';
  v_coca constant uuid := 'd1000000-0000-0000-0000-000000000001';
  v_ajeno uuid;
  v_count int;
  v_cat uuid;
begin
  select id into v_ajeno from _ajeno;
  if v_ajeno is null then
    raise exception 'SETUP: el seed no tiene productos de otro negocio activo';
  end if;

  -----------------------------------------------------------------------------
  -- 1. Mover en masa con un id ajeno colado: cuenta 1, no 2.
  -----------------------------------------------------------------------------
  with cambiadas as (
    update public.products
       set category_id = v_cat_bebidas
     where id = any (array[v_coca, v_ajeno])
       and store_id = v_trebol
       and status = 'active'
    returning id
  )
  select count(*) into v_count from cambiadas;

  if v_count is distinct from 1 then
    raise exception 'FALLA 1: el update masivo devolvió % filas (esperaba 1: solo la propia)', v_count;
  end if;

  select category_id into v_cat from public.products where id = v_coca;
  if v_cat is distinct from v_cat_bebidas then
    raise exception 'FALLA 1b: la fila propia no quedó en Bebidas (quedó %)', v_cat;
  end if;
  raise notice 'OK  1. Update masivo bajo RLS: contador honesto y fila propia movida';

  -----------------------------------------------------------------------------
  -- 3. Quitar categoría en masa (null).
  -----------------------------------------------------------------------------
  with cambiadas as (
    update public.products
       set category_id = null
     where id = any (array[v_coca])
       and store_id = v_trebol
       and status = 'active'
    returning id
  )
  select count(*) into v_count from cambiadas;

  select category_id into v_cat from public.products where id = v_coca;
  if v_count is distinct from 1 or v_cat is not null then
    raise exception 'FALLA 3: quitar categoría en masa no funcionó (count %, cat %)', v_count, v_cat;
  end if;
  raise notice 'OK  3. Quitar categoría en masa (null) funciona';
end $$;

-- 2. La fila ajena quedó intacta — se mira SIN RLS, contra el valor capturado.
reset role;

do $$
declare
  v_esperada uuid;
  v_actual uuid;
  v_id uuid;
begin
  select id, category_id into v_id, v_esperada from _ajeno;
  select category_id into v_actual from public.products where id = v_id;
  if v_actual is distinct from v_esperada then
    raise exception 'FALLA 2: FUGA — el update masivo tocó una fila de otro negocio (% → %)', v_esperada, v_actual;
  end if;
  raise notice 'OK  2. Cero filas ajenas tocadas (aislamiento cross-tenant del update masivo)';
end $$;

rollback;
