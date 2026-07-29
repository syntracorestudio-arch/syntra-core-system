-- =============================================================================
-- StockFlow — SEED DE ESCALA: un kiosco realista de ~2000 productos (SOLO DEV)
--
-- Herramienta para ver y medir la app al tamaño de un kiosco REAL (800-2000+ SKUs):
-- densidad de las pantallas, payload, búsqueda server-side, rankings, alertas.
-- Es el "catálogo sintético" que pide el gate de escala de
-- `docs/inventario-escala-audit.md` §F.
--
-- ── Reglas de esta herramienta ───────────────────────────────────────────────
-- · Crea su PROPIO negocio (Kiosco Escala) con su PROPIO dueño. NUNCA siembra en
--   los negocios del fixture (`seed.sql`): la primera versión lo hacía y pintaba
--   de rojo los conteos de verify.sql sin que hubiera ningún bug (deriva aparecida
--   dos veces antes de nombrarla — no repetirla).
-- · NO corre sola: `supabase/config.toml` solo auto-ejecuta `seed.sql` en el reset.
--   Se corre a mano, después del reset, cuando hace falta el catálogo grande.
-- · SOLO DEV. Producción se arma únicamente con migraciones — el plan de despliegue
--   (`docs/despliegue-plan.md` §2) prohíbe correr cualquier `supabase/seed*.sql`.
--
-- Uso:
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/seed_escala.sql
--
-- Login del kiosco grande: dueno@escala.test / stockflow123
--
-- Limpieza (borra el negocio entero por cascada, sin tocar el fixture):
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -c "delete from public.stores where id = '33333333-3333-3333-3333-333333333333';"
-- =============================================================================

\set ON_ERROR_STOP on

-- ---------- Dueño del kiosco de escala (workaround GoTrue: tokens en '' no NULL) ----------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'dueno@escala.test',
   extensions.crypt('stockflow123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dueño Escala"}')
on conflict (id) do nothing;

-- El trigger handle_new_user ya creó el profile.

-- ---------- Negocio propio ----------
insert into public.stores (id, name, slug, branding) values
  ('33333333-3333-3333-3333-333333333333', 'Kiosco Escala', 'kiosco-escala',
   '{"accent":"#2e6bff","subtitle":"2000 SKUs de prueba"}'::jsonb)
on conflict (id) do nothing;

insert into public.store_settings (store_id) values
  ('33333333-3333-3333-3333-333333333333')
on conflict (store_id) do nothing;

insert into public.members (id, store_id, profile_id, role, display_name,
                            can_sell_on_credit, can_receive_stock, can_void_sale, can_see_costs)
values
  ('cccc3333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   'cccccccc-0000-0000-0000-000000000001', 'owner', 'Dueño Escala', true, true, true, true)
on conflict (id) do nothing;

-- ---------- Categorías (las 8 del onboarding real) ----------
insert into public.categories (id, store_id, name, emoji, color, sort) values
  ('c3000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Bebidas',     '🥤', '#3b82f6', 1),
  ('c3000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Golosinas',   '🍫', '#ec4899', 2),
  ('c3000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Cigarrillos', '🚬', '#f59e0b', 3),
  ('c3000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Almacén',     '📦', '#10b981', 4),
  ('c3000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Limpieza',    '🧼', '#06b6d4', 5),
  ('c3000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Fiambres',    '🧀', '#eab308', 6),
  ('c3000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Panadería',   '🥖', '#f97316', 7),
  ('c3000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Varios',      '🧷', '#8b5cf6', 8)
on conflict (id) do nothing;

begin;

-- ---------- ~2000 productos realistas ----------
do $$
declare
  v_store   uuid := '33333333-3333-3333-3333-333333333333';
  v_cats    text[] := array['Bebidas','Golosinas','Cigarrillos','Almacén','Limpieza','Fiambres','Panadería','Varios'];
  v_cat_id  uuid;
  v_base    text;
  v_variante text;
  v_nombre  text;
  v_precio  numeric;
  v_costo   numeric;
  v_stock   numeric;
  v_emoji   text;
  v_prod    uuid;
  v_n       int := 0;
  i         int;
  v_cat_ix  int;

  v_bebidas   text[] := array['Coca-Cola','Pepsi','Sprite','Fanta','Manaos','Seven Up','Paso de los Toros','Agua Villavicencio','Agua Eco de los Andes','Villa del Sur','Cunnington','Gatorade','Powerade','Cepita','Baggio','Ades','Levite','Quilmes','Brahma','Stella Artois','Andes','Corona','Heineken','Schneider','Fernet Branca','Gancia','Campari','Smirnoff','Sprite Zero','Red Bull','Speed','Monster','Terma','Tereré','Cachamai'];
  v_golo      text[] := array['Alfajor Jorgito','Alfajor Guaymallén','Alfajor Milka','Alfajor Fantoche','Alfajor Terrabusi','Bon o Bon','Rocklets','Tita','Rhodesia','Mantecol','Bananita Dolca','Chocolinas','Oreo','Pepitos','Sonrisas','Melba','Opera','Rumba','Águila','Block','Shot','Kinder','Baggio Chupetín','Chupetín Pico Dulce','Sugus','Menthoplus','Halls','Beldent','Topline','Flynn Paff','Palitos de la Selva','Gomitas Mogul','Pastillas DRF','Turrón Arcor','Caramelos Media Hora'];
  v_cigs      text[] := array['Marlboro','Philip Morris','Chesterfield','Lucky Strike','Camel','Parliament','Rothmans','Viceroy','Jockey','Colorado','Melbourne','Next','Gauloises','Pall Mall','L&M','Dunhill','Kent','Winston','Derby','Red Point'];
  v_almacen   text[] := array['Fideos Matarazzo','Fideos Lucchetti','Arroz Gallo','Arroz Molinos','Aceite Natura','Aceite Cocinero','Azúcar Ledesma','Yerba Playadito','Yerba Taragüi','Yerba Rosamonte','Yerba CBSé','Café La Virginia','Café Dolca','Té Green Hills','Harina Blancaflor','Puré de tomate Arcor','Arvejas Marolio','Atún La Campagnola','Sardinas','Mayonesa Hellmanns','Ketchup Hellmanns','Mostaza','Sal Celusal','Polenta Presto','Avena Quaker','Mermelada Arcor','Dulce de leche La Serenísima','Galletitas Criollitas','Galletitas Express','Vinagre Menoyo'];
  v_limpieza  text[] := array['Lavandina Ayudín','Detergente Magistral','Jabón en polvo Ala','Jabón Skip','Suavizante Vívere','Limpiador Cif','Desodorante Poett','Papel higiénico Higienol','Papel higiénico Elegante','Rollo de cocina Sussex','Servilletas','Esponja Mortimer','Trapo de piso','Bolsas de residuo','Insecticida Raid','Jabón Dove','Shampoo Sedal','Pasta dental Colgate','Cepillo dental','Desodorante Rexona'];
  v_fiambres  text[] := array['Jamón cocido','Jamón crudo','Salame','Mortadela','Queso cremoso','Queso port salut','Queso rallado','Muzzarella','Salamín','Bondiola','Panceta','Leberwurst','Queso untable Casancrem','Manteca La Serenísima','Yogur Ser','Yogur Yogurísimo','Leche La Serenísima','Leche Sancor','Crema de leche','Huevos'];
  v_panaderia text[] := array['Pan francés','Pan de mesa Bimbo','Facturas','Medialunas','Criollos','Bizcochos','Pan rallado','Prepizza','Tapas de empanada','Tapas de tarta','Budín','Magdalenas','Torta','Galleta marinera','Grisines','Pan lactal','Pan de hamburguesa','Pan de pancho','Churros','Palmeritas'];
  v_varios    text[] := array['Pilas AA','Pilas AAA','Encendedor','Fósforos','Preservativos','Curitas','Aspirina','Ibuprofeno','Paracetamol','Cargador USB','Auriculares','Cuaderno','Birome','Lápiz','Goma','Regla','Tijera','Cinta scotch','Sobres','Tarjeta SUBE'];

  v_variantes text[] := array['500ml','1L','1.5L','2.25L','237ml','354ml','600ml','x6','x12','x24','200g','500g','1kg','250g','100g','chico','grande','familiar','pack','individual','light','zero','original','clásico','x3','x10','doble','simple'];
begin
  -- Idempotencia gruesa: si el kiosco ya tiene su catálogo, no duplicar.
  if (select count(*) from public.products where store_id = v_store) >= 2000 then
    raise notice 'Kiosco Escala ya tiene su catálogo; nada que hacer.';
    return;
  end if;

  for i in 1..2000 loop
    v_cat_ix := 1 + (i % 8);
    select id into v_cat_id from public.categories
     where store_id = v_store and name = v_cats[v_cat_ix] limit 1;

    case v_cat_ix
      when 1 then v_base := v_bebidas[1 + (i % array_length(v_bebidas,1))];   v_emoji := '🥤'; v_precio := 900 + (i % 40) * 120;
      when 2 then v_base := v_golo[1 + (i % array_length(v_golo,1))];         v_emoji := '🍬'; v_precio := 350 + (i % 25) * 90;
      when 3 then v_base := v_cigs[1 + (i % array_length(v_cigs,1))];         v_emoji := '🚬'; v_precio := 3200 + (i % 15) * 250;
      when 4 then v_base := v_almacen[1 + (i % array_length(v_almacen,1))];   v_emoji := '🛒'; v_precio := 1200 + (i % 30) * 180;
      when 5 then v_base := v_limpieza[1 + (i % array_length(v_limpieza,1))]; v_emoji := '🧼'; v_precio := 1500 + (i % 20) * 220;
      when 6 then v_base := v_fiambres[1 + (i % array_length(v_fiambres,1))]; v_emoji := '🧀'; v_precio := 2500 + (i % 18) * 300;
      when 7 then v_base := v_panaderia[1 + (i % array_length(v_panaderia,1))];v_emoji := '🥖'; v_precio := 800 + (i % 22) * 150;
      else        v_base := v_varios[1 + (i % array_length(v_varios,1))];     v_emoji := '📦'; v_precio := 1100 + (i % 28) * 200;
    end case;

    v_variante := v_variantes[1 + (i % array_length(v_variantes,1))];
    v_nombre := v_base || ' ' || v_variante;
    -- Desambiguar repetidos como un catálogo real (presentaciones que conviven).
    if exists (select 1 from public.products where store_id = v_store and lower(name) = lower(v_nombre)) then
      v_nombre := v_nombre || ' ' || (1 + (i % 9))::text;
    end if;

    -- Margen ~35%, salvo un 12% SIN costo cargado (deuda de datos realista).
    v_costo := case when i % 8 = 0 then null else round(v_precio * 0.65, 2) end;

    -- Stock: mayoría sana, ~9% bajo mínimo, ~3% en cero.
    v_stock := case
                 when i % 33 = 0 then 0
                 when i % 11 = 0 then 1 + (i % 3)
                 else 5 + (i % 60)
               end;

    insert into public.products (store_id, category_id, name, emoji, cost, price, stock, low_stock_threshold)
    values (v_store, v_cat_id, v_nombre, v_emoji, v_costo, v_precio, v_stock, 5)
    returning id into v_prod;

    -- EAN plausible para el 88% (el resto se vende por nombre: fraccionados, panadería).
    if i % 8 <> 3 then
      insert into public.product_barcodes (store_id, product_id, barcode)
      values (v_store, v_prod, '779' || lpad((1000000 + i * 7)::text, 10, '0'))
      on conflict (store_id, barcode) do nothing;
    end if;

    v_n := v_n + 1;
  end loop;

  raise notice 'Productos creados: %', v_n;
end $$;

-- ---------- Historial de ventas (14 días) para que el ranking por rotación sea real ----------
do $$
declare
  v_store  uuid := '33333333-3333-3333-3333-333333333333';
  v_member uuid;
  v_sale   uuid;
  v_prod   record;
  v_dia    int;
  v_qty    numeric;
  v_ventas int := 0;
begin
  select id into v_member from public.members where store_id = v_store limit 1;

  if exists (select 1 from public.sales where store_id = v_store) then
    raise notice 'Kiosco Escala ya tiene ventas; nada que hacer.';
    return;
  end if;

  -- 300 productos "que se mueven" (muestra pseudo-aleatoria pero determinista).
  for v_prod in
    select id, name, price, cost from public.products
     where store_id = v_store and status = 'active'
     order by md5(id::text)
     limit 300
  loop
    for v_dia in 1..(1 + (('x' || substr(md5(v_prod.id::text), 1, 2))::bit(8)::int % 8)) loop
      v_qty := 1 + (('x' || substr(md5(v_prod.id::text || v_dia::text), 1, 2))::bit(8)::int % 4);

      insert into public.sales (store_id, member_id, total, payment_method, status, idempotency_key, sold_at)
      values (v_store, v_member, v_prod.price * v_qty,
              (array['cash','card','qr','transfer'])[1 + (v_dia % 4)],
              'completed',
              'SEEDESCALA-' || v_prod.id::text || '-' || v_dia::text,
              now() - (v_dia || ' days')::interval - ((v_dia * 3) || ' hours')::interval)
      returning id into v_sale;

      insert into public.sale_items (sale_id, store_id, product_id, product_name, qty, unit_price, unit_cost, line_total)
      values (v_sale, v_store, v_prod.id, v_prod.name, v_qty, v_prod.price, v_prod.cost, v_prod.price * v_qty);

      v_ventas := v_ventas + 1;
    end loop;
  end loop;

  raise notice 'Ventas históricas creadas: %', v_ventas;
end $$;

commit;

\echo ''
\echo '=== Kiosco Escala listo (dueno@escala.test / stockflow123) ==='
select 'productos activos' as que, count(*)::text as cuanto from public.products where store_id = '33333333-3333-3333-3333-333333333333' and status = 'active'
union all select 'con código de barras', count(*)::text from public.product_barcodes where store_id = '33333333-3333-3333-3333-333333333333'
union all select 'bajo mínimo (low_stock)', count(*)::text from public.low_stock_products where store_id = '33333333-3333-3333-3333-333333333333'
union all select 'sin costo cargado', count(*)::text from public.products where store_id = '33333333-3333-3333-3333-333333333333' and status='active' and cost is null
union all select 'ventas últimos 14 días', count(*)::text from public.sales where store_id = '33333333-3333-3333-3333-333333333333' and sold_at > now() - interval '14 days';
