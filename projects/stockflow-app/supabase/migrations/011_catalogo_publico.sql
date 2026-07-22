-- =============================================================================
-- StockFlow — 011_catalogo_publico.sql
--
-- Catálogo compartido de identidad de productos: qué producto es cada código de
-- barras. Baja la barrera nº1 de adopción — un kiosco tiene 300-800 productos y
-- cargarlos a mano son horas de trabajo ANTES de que el sistema le sirva para
-- algo. Con esto, escanea y solo pone el precio.
--
-- REGLA DE PRIVACIDAD, GRABADA EN EL ESQUEMA:
-- acá va SOLO la identidad del producto (código, nombre, marca). NUNCA precio,
-- stock ni ventas. Eso es información comercial del kiosquero y no sale de su
-- cuenta. Por eso esta tabla no tiene `store_id`: no hay a quién atribuirle nada.
--
-- Fuentes:
--   · 'sepa'      — dataset del Estado argentino (datos.produccion.gob.ar),
--                   licencia CC-BY 4.0: solo exige atribución.
--   · 'comunidad' — lo que cargan los propios usuarios cuando el código no está.
--                   Es el efecto de red: cada cliente mejora el arranque del que
--                   viene después, y eso no se puede copiar sin tener clientes.
-- =============================================================================

create table if not exists public.catalogo_publico (
  ean            text primary key,
  nombre         text not null,
  marca          text,
  fuente         text not null check (fuente in ('sepa', 'comunidad')),
  -- Cuántos negocios distintos confirmaron este nombre. Ordena la confianza sin
  -- guardar quién fue: el conteo no identifica a nadie.
  confirmaciones integer not null default 1 check (confirmaciones > 0),
  actualizado_at timestamptz not null default now(),
  creado_at      timestamptz not null default now()
);

comment on table public.catalogo_publico is
  'Identidad de productos por código de barras. NUNCA precios, stock ni ventas.';

-- Búsqueda por nombre para el buscador del alta (además del lookup por EAN, que
-- usa la PK).
create index if not exists catalogo_nombre_idx
  on public.catalogo_publico using gin (to_tsvector('spanish', nombre));

alter table public.catalogo_publico enable row level security;
alter table public.catalogo_publico force row level security;

-- Lectura para cualquier usuario logueado: es identidad pública de producto, no
-- hay nada que aislar por negocio. La escritura NO tiene policy: entra solo por
-- la RPC de abajo o por el importador con service_role.
create policy catalogo_select on public.catalogo_publico for select
  using (auth.uid() is not null);

grant select on public.catalogo_publico to authenticated;
grant select, insert, update on public.catalogo_publico to service_role;

-- =============================================================================
-- catalogo_buscar — lo que consulta el POS al escanear un código desconocido.
-- =============================================================================
create or replace function public.catalogo_buscar(p_ean text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when c.ean is null then null else
    jsonb_build_object('ean', c.ean, 'nombre', c.nombre, 'marca', c.marca,
                       'fuente', c.fuente, 'confirmaciones', c.confirmaciones)
  end
    from (select 1) x
    left join public.catalogo_publico c on c.ean = p_ean;
$$;

-- =============================================================================
-- catalogo_aportar — el usuario cargó un producto que el catálogo no tenía.
--
-- Se llama al dar de alta un producto con código. Un nombre de producto no es
-- obra protegible y su uso es identificatorio, así que aportarlo es defendible;
-- igual va declarado en los términos, con la garantía de que los precios y las
-- ventas nunca salen del negocio.
--
-- No pisa lo que viene de SEPA: ese dato es de mejor calidad y está verificado
-- por varias cadenas. Un aporte de la comunidad solo suma confirmaciones.
-- =============================================================================
create or replace function public.catalogo_aportar(
  p_ean    text,
  p_nombre text,
  p_marca  text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_existente public.catalogo_publico;
begin
  -- Sanidad: sin esto entra basura al catálogo de todos.
  if p_ean !~ '^[0-9]{8,14}$' then return; end if;
  if coalesce(length(trim(p_nombre)), 0) < 3 then return; end if;

  select * into v_existente from public.catalogo_publico where ean = p_ean;

  if not found then
    insert into public.catalogo_publico (ean, nombre, marca, fuente)
    values (p_ean, trim(p_nombre), nullif(trim(coalesce(p_marca, '')), ''), 'comunidad');
    return;
  end if;

  -- Ya existe: si el nombre coincide en lo esencial, cuenta como confirmación.
  -- Si difiere, NO se pisa —el primero puede ser el correcto— pero tampoco se
  -- descarta: el conteo de confirmaciones es lo que ordena la confianza.
  if lower(unaccent_simple(v_existente.nombre)) = lower(unaccent_simple(trim(p_nombre))) then
    update public.catalogo_publico
       set confirmaciones = confirmaciones + 1, actualizado_at = now()
     where ean = p_ean;
  end if;
end;
$$;

-- Comparación laxa de nombres, sin depender de la extensión `unaccent` (que en
-- Supabase vive en otro schema y complica el search_path de las funciones).
create or replace function public.unaccent_simple(p_texto text)
returns text
language sql immutable strict as $$
  select translate(lower(p_texto),
                   'áàäâãéèëêíìïîóòöôõúùüûñç',
                   'aaaaaeeeeiiiiooooouuuunc');
$$;

grant execute on function public.unaccent_simple(text) to authenticated, service_role;
grant execute on function public.catalogo_buscar(text) to authenticated;
grant execute on function public.catalogo_aportar(text, text, text) to authenticated;
