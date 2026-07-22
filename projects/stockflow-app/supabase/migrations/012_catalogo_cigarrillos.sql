-- =============================================================================
-- StockFlow — 012_catalogo_cigarrillos.sql
--
-- SEPA no publica cigarrillos: el régimen de precios no los incluye (verificado:
-- 0 resultados para "marlboro" y "cigarrill" sobre 83.730 productos). Y en un
-- kiosco son de lo que más rota, así que es el hueco más caro del catálogo.
--
-- POR QUÉ ESTAS FILAS NO TIENEN CÓDIGO DE BARRAS:
-- no tenemos los EAN reales de estos productos y no hay forma de verificarlos.
-- Inventar códigos con dígito verificador válido sería peor que no tenerlos: el
-- kiosquero escanearía un Marlboro real, no coincidiría, y el sistema fallaría
-- justo en el producto que más vende — además de contaminar el catálogo
-- compartido de todos los clientes con datos falsos.
--
-- En su lugar, el nombre queda buscable y el código REAL lo aporta el primer
-- cliente que lo escanee (ver `catalogo_vincular_ean`). Los códigos verdaderos
-- solo pueden venir de un escáner apuntando a un paquete de verdad.
-- =============================================================================

-- El EAN es la PK de catalogo_publico, así que estas filas usan una clave
-- reservada con prefijo 'n:' (name-only). El chequeo de formato de
-- `catalogo_aportar` ya rechaza cualquier cosa que no sean dígitos, así que
-- estas entradas nunca colisionan con un EAN real.
alter table public.catalogo_publico drop constraint if exists catalogo_ean_formato;
alter table public.catalogo_publico add constraint catalogo_ean_formato
  check (ean ~ '^[0-9]{8,14}$' or ean ~ '^n:[a-z0-9-]+$');

insert into public.catalogo_publico (ean, nombre, marca, fuente, confirmaciones) values
  ('n:marlboro-box-20',        'Marlboro Box 20',            'Marlboro',       'sepa', 1),
  ('n:marlboro-gold-20',       'Marlboro Gold Box 20',       'Marlboro',       'sepa', 1),
  ('n:marlboro-red-10',        'Marlboro Box 10',            'Marlboro',       'sepa', 1),
  ('n:marlboro-fusion-20',     'Marlboro Fusion Box 20',     'Marlboro',       'sepa', 1),
  ('n:philip-morris-box-20',   'Philip Morris Box 20',       'Philip Morris',  'sepa', 1),
  ('n:philip-morris-kss-20',   'Philip Morris KS 20',        'Philip Morris',  'sepa', 1),
  ('n:philip-morris-10',       'Philip Morris Box 10',       'Philip Morris',  'sepa', 1),
  ('n:chesterfield-box-20',    'Chesterfield Box 20',        'Chesterfield',   'sepa', 1),
  ('n:chesterfield-10',        'Chesterfield Box 10',        'Chesterfield',   'sepa', 1),
  ('n:lucky-strike-box-20',    'Lucky Strike Box 20',        'Lucky Strike',   'sepa', 1),
  ('n:lucky-strike-click-20',  'Lucky Strike Click Box 20',  'Lucky Strike',   'sepa', 1),
  ('n:camel-box-20',           'Camel Box 20',               'Camel',          'sepa', 1),
  ('n:camel-activate-20',      'Camel Activate Box 20',      'Camel',          'sepa', 1),
  ('n:pall-mall-box-20',       'Pall Mall Box 20',           'Pall Mall',      'sepa', 1),
  ('n:pall-mall-click-20',     'Pall Mall Click Box 20',     'Pall Mall',      'sepa', 1),
  ('n:parliament-box-20',      'Parliament Box 20',          'Parliament',     'sepa', 1),
  ('n:rothmans-box-20',        'Rothmans Box 20',            'Rothmans',       'sepa', 1),
  ('n:rothmans-10',            'Rothmans Box 10',            'Rothmans',       'sepa', 1),
  ('n:viceroy-box-20',         'Viceroy Box 20',             'Viceroy',        'sepa', 1),
  ('n:jockey-club-box-20',     'Jockey Club Box 20',         'Jockey Club',    'sepa', 1),
  ('n:derby-box-20',           'Derby Box 20',               'Derby',          'sepa', 1),
  ('n:melbourne-box-20',       'Melbourne Box 20',           'Melbourne',      'sepa', 1),
  ('n:next-box-20',            'Next Box 20',                'Next',           'sepa', 1),
  ('n:red-point-box-20',       'Red Point Box 20',           'Red Point',      'sepa', 1),
  ('n:gauloises-box-20',       'Gauloises Box 20',           'Gauloises',      'sepa', 1),
  ('n:kent-box-20',            'Kent Box 20',                'Kent',           'sepa', 1),
  ('n:dunhill-box-20',         'Dunhill Box 20',             'Dunhill',        'sepa', 1),
  ('n:l-and-m-box-20',         'L&M Box 20',                 'L&M',            'sepa', 1),
  -- Lo que se vende al lado del mostrador junto con los cigarrillos
  ('n:tabaco-armar-30g',       'Tabaco para armar 30 g',     null,             'sepa', 1),
  ('n:tabaco-armar-50g',       'Tabaco para armar 50 g',     null,             'sepa', 1),
  ('n:papelillo-smoking',      'Papelillo Smoking',          'Smoking',        'sepa', 1),
  ('n:papelillo-rizla',        'Papelillo Rizla',            'Rizla',          'sepa', 1),
  ('n:filtros-armar',          'Filtros para armar',         null,             'sepa', 1),
  ('n:encendedor-comun',       'Encendedor',                 null,             'sepa', 1),
  ('n:encendedor-bic',         'Encendedor Bic',             'Bic',            'sepa', 1),
  ('n:fosforos',               'Caja de fósforos',           null,             'sepa', 1)
on conflict (ean) do nothing;

-- =============================================================================
-- catalogo_buscar_nombre — para cuando el código no está en el catálogo.
-- El kiosquero escribe "marl" y elige de la lista, en vez de tipear el nombre
-- completo en el teclado del teléfono.
-- =============================================================================
create or replace function public.catalogo_buscar_nombre(p_texto text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.prioridad, x.nombre), '[]'::jsonb)
    from (
      select ean, nombre, marca,
             -- Los que empiezan con lo tipeado van primero: buscar "coca" tiene
             -- que traer "Coca Cola" antes que "Gaseosa sabor Coca".
             case when unaccent_simple(nombre) ilike unaccent_simple(p_texto) || '%'
                  then 0 else 1 end as prioridad
        from public.catalogo_publico
       where unaccent_simple(nombre) ilike '%' || unaccent_simple(p_texto) || '%'
       order by prioridad, confirmaciones desc, nombre
       limit 12
    ) x;
$$;

grant execute on function public.catalogo_buscar_nombre(text) to authenticated;

-- =============================================================================
-- catalogo_vincular_ean — el momento en que un código real entra al sistema.
--
-- Cuando el kiosquero escanea un producto sin código conocido y elige una
-- entrada por nombre, ese escaneo ES el dato que faltaba. Se crea la fila con el
-- EAN verdadero heredando el nombre curado.
--
-- Así los códigos de los cigarrillos los aportan los propios clientes con su
-- escáner, que es la única fuente confiable que existe: nadie los publica.
-- =============================================================================
create or replace function public.catalogo_vincular_ean(
  p_ean          text,
  p_ean_o_nombre text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_origen public.catalogo_publico;
begin
  if p_ean !~ '^[0-9]{8,14}$' then return; end if;

  select * into v_origen from public.catalogo_publico where ean = p_ean_o_nombre;
  if not found then return; end if;

  insert into public.catalogo_publico (ean, nombre, marca, fuente)
  values (p_ean, v_origen.nombre, v_origen.marca, 'comunidad')
  on conflict (ean) do update
     set confirmaciones = public.catalogo_publico.confirmaciones + 1,
         actualizado_at = now();
end;
$$;

grant execute on function public.catalogo_vincular_ean(text, text) to authenticated;