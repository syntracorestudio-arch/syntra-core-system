-- =============================================================================
-- StockFlow — seed_demo.sql  (tanda 1I)
--
-- El kiosco de la DEMO COMERCIAL: "Kiosco El Trébol" con catálogo completo,
-- 90 días de ventas con curva creíble, fiado vivo, vencimientos y mermas.
--
-- Se corre DESPUÉS de seed.sql. Está separado a propósito:
--   · seed.sql        = mínimo para desarrollar y probar aislamiento (2 negocios)
--   · seed_demo.sql   = el volumen que hace que la demo brille
-- Así el `db reset` del día a día sigue siendo rápido y la demo se carga cuando
-- hace falta.
--
-- Reglas que respeta:
--   · IDEMPOTENTE: si ya corrió, no duplica nada.
--   · Determinista: sin random, para que la demo sea siempre igual.
--   · Los movimientos van por las tablas reales con sus snapshots de costo, así
--     que los reportes y los márgenes salen de datos verdaderos, no maquillados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dígito verificador EAN-13. Los códigos son REPRESENTATIVOS (prefijo 779 =
-- Argentina) y matemáticamente válidos, pero NO están escaneados de productos
-- reales: para una demo con productos en la mano, escaneá los tuyos y usá el
-- alta rápida — que además es el momento más vendedor de la demo.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.ean13(p_base text) returns text
language plpgsql immutable as $$
declare
  v_sum integer := 0;
  v_dig integer;
begin
  for i in 1..12 loop
    v_dig := substring(p_base from i for 1)::integer;
    v_sum := v_sum + v_dig * (case when i % 2 = 0 then 3 else 1 end);
  end loop;
  return p_base || ((10 - (v_sum % 10)) % 10)::text;
end;
$$;

do $$
declare
  v_store    uuid := '11111111-1111-1111-1111-111111111111';
  v_dueno    uuid := 'aaaa1111-0000-0000-0000-000000000001';
  v_cajera   uuid := 'aaaa1111-0000-0000-0000-000000000002';
  v_cat      record;
  v_prod     record;
  v_pid      uuid;
  v_dia      integer;
  v_venta    integer;
  v_ventas   integer;
  v_sale     uuid;
  v_total    numeric;
  v_ts       timestamptz;
  v_dow      integer;
  v_medio    text;
  v_qty      numeric;
  v_cli      uuid;
  v_seq      integer := 0;
  v_hora     integer;
  v_catalogo integer;
begin
  -- Idempotencia: si la demo ya está cargada, salir.
  if exists (select 1 from public.products where store_id = v_store and name = 'Fernet Branca 750ml') then
    raise notice 'La demo ya estaba cargada. Nada que hacer.';
    return;
  end if;

  -- ==========================================================================
  -- 1. Categorías (las 8 del kiosco, con los colores de la paleta)
  -- ==========================================================================
  insert into public.categories (store_id, name, emoji, color, sort) values
    (v_store, 'Bebidas',     '🥤', '#3b82f6', 1),
    (v_store, 'Golosinas',   '🍫', '#ec4899', 2),
    (v_store, 'Cigarrillos', '🚬', '#f59e0b', 3),
    (v_store, 'Almacén',     '🥫', '#10b981', 4),
    (v_store, 'Limpieza',    '🧼', '#06b6d4', 5),
    (v_store, 'Fiambres',    '🧀', '#f43f5e', 6),
    (v_store, 'Panadería',   '🍞', '#84cc16', 7),
    (v_store, 'Varios',      '📦', '#8b5cf6', 8)
  on conflict do nothing;

  -- ==========================================================================
  -- 2. Catálogo. Precio y costo pensados para que los MÁRGENES sean realistas:
  --    cigarrillos ~10% (rota mucho, deja poco), golosinas ~45%, bebidas ~35%.
  --    Esa diferencia es lo que hace que el reporte "lo que más te deja"
  --    cuente una historia verdadera en la demo.
  -- ==========================================================================
  for v_prod in
    select * from (values
      -- Bebidas
      ('Coca-Cola 500ml',        '🥤','Bebidas',    1800, 1250, '779089500099'),
      ('Coca-Cola 2.25L',        '🥤','Bebidas',    3900, 2750, '779089500100'),
      ('Coca-Cola Zero 500ml',   '🥤','Bebidas',    1800, 1250, '779089500101'),
      ('Sprite 500ml',           '🥤','Bebidas',    1750, 1200, '779089500102'),
      ('Fanta 500ml',            '🥤','Bebidas',    1750, 1200, '779089500103'),
      ('Pepsi 500ml',            '🥤','Bebidas',    1650, 1150, '779089500104'),
      ('Agua Villa del Sur 1.5L','💧','Bebidas',    1500,  950, '779003600012'),
      ('Agua Villa del Sur 500ml','💧','Bebidas',   1100,  700, '779003600013'),
      ('Agua con gas 1.5L',      '💧','Bebidas',    1600, 1050, '779003600014'),
      ('Levité Pera 1.5L',       '🧃','Bebidas',    2100, 1450, '779003600015'),
      ('Cepita Naranja 1L',      '🧃','Bebidas',    2400, 1700, '779003600016'),
      ('Baggio Multifruta 1L',   '🧃','Bebidas',    1900, 1300, '779003600017'),
      ('Quilmes 1L',             '🍺','Bebidas',    3200, 2400, '779007700011'),
      ('Quilmes lata 473ml',     '🍺','Bebidas',    2100, 1550, '779007700012'),
      ('Brahma lata 473ml',      '🍺','Bebidas',    2000, 1480, '779007700013'),
      ('Stella Artois 1L',       '🍺','Bebidas',    4200, 3200, '779007700014'),
      ('Fernet Branca 750ml',    '🍷','Bebidas',   14500,11200, '779007700015'),
      ('Vino Toro tinto 1L',     '🍷','Bebidas',    3400, 2400, '779007700016'),
      ('Gatorade 500ml',         '🥤','Bebidas',    2300, 1600, '779089500105'),
      ('Speed lata 250ml',       '🥤','Bebidas',    2600, 1850, '779089500106'),
      -- Golosinas
      ('Alfajor Jorgito',        '🍫','Golosinas',   900,  520, '779004099901'),
      ('Alfajor Guaymallén',     '🍫','Golosinas',   600,  330, '779004099902'),
      ('Alfajor Milka',          '🍫','Golosinas',  1800, 1150, '779004099903'),
      ('Alfajor Águila triple',  '🍫','Golosinas',  2100, 1350, '779004099904'),
      ('Chocolate Milka 100g',   '🍫','Golosinas',  3200, 2100, '779004099905'),
      ('Block Águila 100g',      '🍫','Golosinas',  2800, 1800, '779004099906'),
      ('Rocklets 40g',           '🍬','Golosinas',  1200,  700, '779004099907'),
      ('Bon o Bon',              '🍫','Golosinas',   500,  280, '779004099908'),
      ('Tita',                   '🍫','Golosinas',   550,  310, '779004099909'),
      ('Rhodesia',               '🍫','Golosinas',   550,  310, '779004099910'),
      ('Chupetín Pico Dulce',    '🍭','Golosinas',   350,  180, '779004099911'),
      ('Beldent menta',          '🍬','Golosinas',   700,  400, '779004099912'),
      ('Topline frutilla',       '🍬','Golosinas',   700,  400, '779004099913'),
      ('Menthoplus',             '🍬','Golosinas',   600,  330, '779004099914'),
      ('Sugus x 5',              '🍬','Golosinas',   450,  240, '779004099915'),
      ('Galletitas Oreo',        '🍪','Golosinas',  2200, 1450, '779004099916'),
      ('Pepitos',                '🍪','Golosinas',  1900, 1250, '779004099917'),
      ('Bizcochos Don Satur',    '🍪','Golosinas',  1700, 1100, '779004099918'),
      ('Criollitas',             '🍪','Golosinas',  1500,  980, '779004099919'),
      ('Chocolinas',             '🍪','Golosinas',  2400, 1600, '779004099920'),
      -- Cigarrillos (margen bajo a propósito: es la realidad del rubro)
      ('Marlboro box 20',        '🚬','Cigarrillos',4500, 4050, '779001100011'),
      ('Marlboro Gold 20',       '🚬','Cigarrillos',4500, 4050, '779001100012'),
      ('Philip Morris 20',       '🚬','Cigarrillos',4200, 3800, '779001100013'),
      ('Lucky Strike 20',        '🚬','Cigarrillos',4300, 3880, '779001100014'),
      ('Camel 20',               '🚬','Cigarrillos',4400, 3960, '779001100015'),
      ('Chesterfield 20',        '🚬','Cigarrillos',4100, 3700, '779001100016'),
      ('Encendedor',             '🔥','Cigarrillos', 900,  450, '779001100017'),
      ('Papelillo Smoking',      '🍃','Cigarrillos', 800,  420, '779001100018'),
      -- Almacén
      ('Yerba Playadito 1kg',    '🧉','Almacén',    5200, 3900, '779002200011'),
      ('Yerba Rosamonte 1kg',    '🧉','Almacén',    5400, 4050, '779002200012'),
      ('Yerba Taragüi 500g',     '🧉','Almacén',    3100, 2300, '779002200013'),
      ('Azúcar Ledesma 1kg',     '🥣','Almacén',    1900, 1400, '779002200014'),
      ('Café La Virginia 250g',  '☕','Almacén',    4800, 3600, '779002200015'),
      ('Té Taragüi x25',         '☕','Almacén',    1600, 1100, '779002200016'),
      ('Arroz Gallo 1kg',        '🍚','Almacén',    2300, 1700, '779002200017'),
      ('Fideos Matarazzo 500g',  '🍝','Almacén',    1500, 1050, '779002200018'),
      ('Fideos Lucchetti 500g',  '🍝','Almacén',    1400,  980, '779002200019'),
      ('Aceite Natura 900ml',    '🫒','Almacén',    3600, 2700, '779002200020'),
      ('Puré de tomate Arcor',   '🥫','Almacén',    1300,  900, '779002200021'),
      ('Atún La Campagnola',     '🥫','Almacén',    3400, 2500, '779002200022'),
      ('Arvejas Marolio',        '🥫','Almacén',     950,  650, '779002200023'),
      ('Mayonesa Hellmanns 475g','🥫','Almacén',    2800, 2000, '779002200024'),
      ('Ketchup Hellmanns',      '🥫','Almacén',    2500, 1800, '779002200025'),
      ('Sal fina Celusal 500g',  '🧂','Almacén',     900,  600, '779002200026'),
      ('Harina 0000 Blancaflor', '🥣','Almacén',    1600, 1150, '779002200027'),
      ('Papas Lays 85g',         '🥔','Almacén',    2400, 1550, '779002200028'),
      ('Doritos 77g',            '🥔','Almacén',    2300, 1500, '779002200029'),
      ('Palitos Pehuamar',       '🥜','Almacén',    1800, 1150, '779002200030'),
      ('Maní salado 100g',       '🥜','Almacén',    1400,  900, '779002200031'),
      ('Pochoclo para microondas','🍿','Almacén',   1700, 1150, '779002200032'),
      -- Limpieza
      ('Jabón Ala líquido 800ml','🧼','Limpieza',   3100, 2250, '779005500011'),
      ('Detergente Magistral',   '🧼','Limpieza',   2600, 1850, '779005500012'),
      ('Lavandina Ayudín 1L',    '🧼','Limpieza',   1500, 1050, '779005500013'),
      ('Papel higiénico x4',     '🧻','Limpieza',   2900, 2100, '779005500014'),
      ('Rollo de cocina x2',     '🧻','Limpieza',   2200, 1600, '779005500015'),
      ('Servilletas x100',       '🧻','Limpieza',   1300,  900, '779005500016'),
      ('Esponja multiuso',       '🧽','Limpieza',    800,  480, '779005500017'),
      ('Shampoo Sedal 340ml',    '🧴','Limpieza',   4200, 3100, '779005500018'),
      ('Jabón de tocador Lux',   '🧼','Limpieza',    950,  620, '779005500019'),
      -- Fiambres
      ('Jamón cocido 100g',      '🥓','Fiambres',   2800, 2000, '779006600011'),
      ('Salame milán 100g',      '🍖','Fiambres',   3200, 2350, '779006600012'),
      ('Queso cremoso 500g',     '🧀','Fiambres',   6800, 5100, '779006600013'),
      ('Queso rallado 100g',     '🧀','Fiambres',   2400, 1750, '779006600014'),
      ('Mortadela 100g',         '🥓','Fiambres',   1900, 1350, '779006600015'),
      ('Salchichas Vienissima',  '🌭','Fiambres',   3600, 2650, '779006600016'),
      ('Huevos x6',              '🥚','Fiambres',   3200, 2400, '779006600017'),
      ('Leche La Serenísima 1L', '🥛','Fiambres',   2100, 1600, '779006600018'),
      ('Yogur bebible 900ml',    '🥛','Fiambres',   3400, 2500, '779006600019'),
      ('Manteca 200g',           '🧈','Fiambres',   3800, 2850, '779006600020'),
      -- Panadería
      ('Pan lactal Bimbo',       '🍞','Panadería',  2600, 1900, '779008800011'),
      ('Pan de mesa 500g',       '🍞','Panadería',  1800, 1250, '779008800012'),
      ('Medialunas x6',          '🥐','Panadería',  3200, 2100, '779008800013'),
      ('Facturas surtidas x6',   '🥐','Panadería',  3600, 2400, '779008800014'),
      ('Budín inglés',           '🧁','Panadería',  2900, 2000, '779008800015'),
      -- Varios
      ('Pilas AA x2',            '🔋','Varios',     3400, 2300, '779009900011'),
      ('Pilas AAA x2',           '🔋','Varios',     3400, 2300, '779009900012'),
      ('Curitas x10',            '🩹','Varios',     1600, 1050, '779009900013'),
      ('Preservativos x3',       '📦','Varios',     3800, 2600, '779009900014'),
      ('Birome azul',            '✏️','Varios',      700,  400, '779009900015'),
      ('Alimento perro 1kg',     '🐕','Varios',     4200, 3200, '779009900016')
    ) as t(nombre, emoji, categoria, precio, costo, ean)
  loop
    -- El seed base ya dejó 5 productos con su historial. La demo EXTIENDE, no
    -- duplica: si el nombre o el código ya existen, se saltea (que es la misma
    -- regla de deduplicación que aplica la app en el alta).
    if exists (
      select 1 from public.products
       where store_id = v_store and lower(name) = lower(v_prod.nombre)
    ) or exists (
      select 1 from public.product_barcodes
       where store_id = v_store and barcode = pg_temp.ean13(v_prod.ean)
    ) then
      continue;
    end if;

    select id into v_cat from public.categories
     where store_id = v_store and name = v_prod.categoria;

    insert into public.products (store_id, category_id, name, emoji, price, cost,
                                 low_stock_threshold)
    values (v_store, v_cat.id, v_prod.nombre, v_prod.emoji,
            v_prod.precio, v_prod.costo,
            case when v_prod.categoria = 'Cigarrillos' then 5 else 4 end)
    returning id into v_pid;

    insert into public.product_barcodes (store_id, product_id, barcode)
    values (v_store, v_pid, pg_temp.ean13(v_prod.ean));

    -- Stock inicial variado: la mayoría con buen stock, algunos al límite para
    -- que las alertas de la demo sean REALES y no un cartel decorativo.
    v_seq := v_seq + 1;
    insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost, note)
    values (v_store, v_pid,
            case
              when v_seq % 17 = 0 then 2      -- se está por acabar
              when v_seq % 11 = 0 then 4
              when v_seq % 3  = 0 then 36
              else 18 + (v_seq % 25)
            end,
            'initial', v_prod.costo, 'stock inicial');
  end loop;

  raise notice 'Catálogo cargado.';

  -- ==========================================================================
  -- 3. Clientes de fiado con historias distintas
  -- ==========================================================================
  insert into public.clients (store_id, name, phone, credit_limit) values
    (v_store, 'Marta González',  '1150001111', 20000),
    (v_store, 'Rubén Pérez',     '1150002222', null),
    (v_store, 'Ana Lucero',      '1150003333', 15000),
    (v_store, 'Don Carlos',      '1150004444', 30000),
    (v_store, 'Sofía Ramírez',   null,          10000),
    (v_store, 'El Flaco (taller)','1150005555', 50000)
  on conflict do nothing;

  -- ==========================================================================
  -- 4. Compras de reposición (para que "Compraste mercadería" no dé $0 y el
  --    reporte pueda contar la historia de la plata)
  -- ==========================================================================
  for v_dia in 0..2 loop
    for v_prod in
      select id, cost from public.products
       where store_id = v_store and cost is not null
       order by id offset (v_dia * 12) limit 12
    loop
      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       unit_cost, note, created_at)
      values (v_store, v_prod.id, 12, 'purchase', v_prod.cost, 'reposición',
              now() - ((v_dia * 9 + 3) || ' days')::interval);
    end loop;
  end loop;

  -- ==========================================================================
  -- 5. NOVENTA días de ventas.
  --    Curva: viernes y sábado fuertes, lunes flojo. Horarios concentrados en
  --    mañana y tarde, como un kiosco de barrio.
  -- ==========================================================================
  select count(*) into v_catalogo from public.products
   where store_id = v_store and status = 'active';

  for v_dia in 0..89 loop
    v_ts := date_trunc('day', now()) - (v_dia || ' days')::interval;
    v_dow := extract(dow from v_ts);
    v_ventas := case when v_dow in (5,6) then 26 when v_dow = 1 then 12 else 18 end;

    for v_venta in 1..v_ventas loop
      v_seq := v_seq + 1;
      v_sale := gen_random_uuid();
      v_total := 0;

      -- Mix de medios realista: el efectivo manda, el QR crece, algo de fiado.
      -- El fiado es 1 de cada 70 ventas: en un kiosco de barrio son unos pocos
      -- vecinos de confianza, no una modalidad de cobro. Con 1/23 la deuda daba
      -- $600.000, que no le pasa a ningún kiosco real.
      v_medio := case
        when v_seq % 70 = 0 then 'account'
        when v_seq % 7  = 0 then 'card'
        when v_seq % 3  = 0 then 'qr'
        else 'cash'
      end;

      v_cli := null;
      if v_medio = 'account' then
        select id into v_cli from public.clients
         where store_id = v_store order by id offset (v_seq % 6) limit 1;
      end if;

      -- Horas con sentido: pico de mañana (8-12) y de tarde (16-21).
      v_hora := case when v_venta % 2 = 0
                     then 8 + (v_venta % 5)
                     else 16 + (v_venta % 6) end;

      insert into public.sales (id, store_id, member_id, client_id, total,
                                payment_method, idempotency_key, sold_at, status)
      values (v_sale, v_store,
              case when v_venta % 3 = 0 then v_cajera else v_dueno end,
              v_cli, 0, v_medio,
              format('demo-%s-%s', v_dia, v_venta),
              v_ts + (v_hora || ' hours')::interval + ((v_venta * 7 % 60) || ' minutes')::interval,
              'completed');

      -- 1 a 4 productos por venta, ROTANDO por todo el catálogo con un salto
      -- primo. Ordenar por nombre sesgaba todo hacia la "A" y hacía que los dos
      -- rankings (unidades vs. ganancia) salieran idénticos — justo el contraste
      -- que la demo tiene que mostrar.
      for v_prod in
        select p.id, p.name, p.price, p.cost
          from public.products p
         where p.store_id = v_store and p.status = 'active'
         order by p.id
         offset ((v_seq * 13) % greatest(v_catalogo - 4, 1))
         limit (1 + (v_seq % 4))
      loop
        v_qty := 1 + (v_seq % 3);
        insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                       qty, unit_price, unit_cost, line_total)
        values (v_sale, v_store, v_prod.id, v_prod.name, v_qty,
                v_prod.price, v_prod.cost, v_prod.price * v_qty);

        -- El asiento NO es opcional: el ledger es la verdad y el stock su cache.
        -- Una demo con ventas que no mueven stock tendría alertas y "plata en la
        -- góndola" mintiendo, y no sobreviviría a que alguien la audite.
        insert into public.stock_ledger (store_id, product_id, delta, reason,
                                         sale_id, created_at)
        values (v_store, v_prod.id, -v_qty, 'sale', v_sale,
                v_ts + (v_hora || ' hours')::interval);

        v_total := v_total + (v_prod.price * v_qty);
      end loop;

      update public.sales set total = v_total where id = v_sale;

      if v_medio = 'account' and v_cli is not null then
        insert into public.client_ledger (store_id, client_id, delta, reason, sale_id)
        values (v_store, v_cli, -v_total, 'sale', v_sale);
      end if;
    end loop;
  end loop;

  raise notice '90 días de ventas cargados.';

  -- ==========================================================================
  -- 5b. Reposición que acompaña a las ventas.
  --
  -- Un kiosco repone todo el tiempo; si no, después de 90 días el stock queda
  -- en cero absoluto. Se calcula por producto cuánto se vendió y se carga una
  -- compra que deja un stock final realista: la mayoría con mercadería, unos
  -- pocos al límite para que las alertas de la demo sean VERDADERAS.
  -- Así el ledger cierra con el stock y la demo resiste una auditoría.
  -- ==========================================================================
  v_seq := 0;
  for v_prod in
    select p.id, p.cost, p.stock as actual
      from public.products p
     where p.store_id = v_store and p.status = 'active'
     order by p.id   -- determinista: la demo tiene que ser siempre igual
  loop
    v_seq := v_seq + 1;
    -- Stock final buscado. Unos pocos quedan BAJO el umbral a propósito: sin eso
    -- las alertas de la demo serían un cartel decorativo en vez de una señal real.
    v_qty := case
               when v_seq % 23 = 0 then 1
               when v_seq % 17 = 0 then 2
               when v_seq % 11 = 0 then 3
               else 14 + (v_seq % 32)
             end;

    -- Se ajusta en las DOS direcciones. Subir es una compra; bajar es un conteo
    -- de góndola, que es exactamente lo que hace un kiosquero cuando arranca a
    -- usar el sistema y descubre que tenía menos de lo que creía.
    -- Las compras se REPARTEN en los 90 días. Cargarlas todas juntas hacía que
    -- el mes en curso mostrara "compraste 3 veces lo que vendiste", que no le
    -- pasa a ningún kiosco: se repone de a poco, todas las semanas.
    if (v_qty - v_prod.actual) > 0 then
      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       unit_cost, note, created_at)
      values (v_store, v_prod.id, (v_qty - v_prod.actual), 'purchase', v_prod.cost,
              'reposición', now() - (((v_seq * 7) % 88) || ' days')::interval);
    elsif (v_qty - v_prod.actual) < 0 then
      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       note, created_at)
      values (v_store, v_prod.id, (v_qty - v_prod.actual), 'adjust',
              'conteo de góndola', now() - interval '4 days');
    end if;
  end loop;

  raise notice 'Reposición y conteo cargados: el ledger cierra con el stock.';

  -- ==========================================================================
  -- 6. Pagos de fiado (para que los saldos no sean solo deuda acumulada)
  -- ==========================================================================
  for v_prod in select id from public.clients where store_id = v_store order by id limit 4
  loop
    insert into public.client_ledger (store_id, client_id, delta, reason,
                                      payment_method, created_at)
    select v_store, v_prod.id,
           least(-coalesce(sum(delta), 0) * 0.6, 90000), 'payment', 'cash',
           now() - interval '9 days'
      from public.client_ledger
     where client_id = v_prod.id
    having coalesce(sum(delta), 0) < 0;
  end loop;

  -- ==========================================================================
  -- 7. Vencimientos: algunos críticos, uno ya vencido, y mermas reales para que
  --    el reporte "perdiste por vencimientos" tenga qué mostrar.
  -- ==========================================================================
  insert into public.stock_expiries (store_id, product_id, expiry_date, qty, note)
  select v_store, p.id,
         (current_date + (case p.name
            when 'Yogur bebible 900ml' then 2
            when 'Leche La Serenísima 1L' then 4
            when 'Jamón cocido 100g' then 3
            when 'Medialunas x6' then 1
            when 'Queso cremoso 500g' then 9
            when 'Manteca 200g' then 21
            else 40 end)),
         6, 'ingreso'
    from public.products p
   where p.store_id = v_store
     and p.name in ('Yogur bebible 900ml','Leche La Serenísima 1L','Jamón cocido 100g',
                    'Medialunas x6','Queso cremoso 500g','Manteca 200g');

  -- Mermas del mes pasado, ya resueltas: plata perdida que el reporte muestra.
  insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                   note, created_at)
  select v_store, p.id, -4, 'waste', p.cost, 'vencido',
         now() - interval '12 days'
    from public.products p
   where p.store_id = v_store
     and p.name in ('Yogur bebible 900ml','Facturas surtidas x6','Mortadela 100g');

  raise notice 'Demo lista: vencimientos, mermas y fiado cargados.';
end $$;
