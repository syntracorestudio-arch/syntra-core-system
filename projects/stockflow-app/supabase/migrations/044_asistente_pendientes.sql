-- =============================================================================
-- StockFlow — 044_asistente_pendientes.sql  (Asistente · pendientes operativos)
--
-- Feedback del owner sobre la primera versión de la página: el asistente no
-- puede repetir lo que otra sección ya muestra. Lo que NINGUNA pantalla junta
-- es la DEUDA ADMINISTRATIVA del catálogo — lo que quedó a medio cargar y
-- degrada todo lo demás en silencio:
--
--   · sin costo        → el margen de ese producto es un misterio (y el análisis
--                        del asistente no puede recomendar precio sobre él)
--   · sin categoría    → no aparece en los drill-downs ni en el ritmo por rubro
--   · sin código       → no se puede escanear en el POS: se cobra buscándolo a mano
--   · stock sin confirmar → el "modo puesta en marcha" (038) lo marcó para revisar
--
-- Una sola función, una sola definición (scale-security-baseline): la página la
-- llama en un round-trip. Todos los conteos van por el índice de products
-- (store_id) y el de product_barcodes (product_id); cero agregación client-side.
-- Additiva. La corre el owner (local: psql del contenedor).
-- =============================================================================

create or replace function public.asistente_pendientes(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  -- Mismo gate que el resto de las RPCs de lectura: miembro activo del negocio.
  v_member := public.rpc_member(p_store_id);

  return (
    select jsonb_build_object(
      'sin_costo',           count(*) filter (where p.cost is null),
      'sin_categoria',       count(*) filter (where p.category_id is null),
      'stock_sin_confirmar', count(*) filter (where p.stock_confiable = false),
      'sin_codigo',          count(*) filter (where not exists (
                               select 1 from public.product_barcodes b where b.product_id = p.id
                             )),
      'total_activos',       count(*)
    )
    from public.products p
    where p.store_id = p_store_id
      and p.status = 'active'
  );
end $$;

revoke all on function public.asistente_pendientes(uuid) from public, anon;
grant execute on function public.asistente_pendientes(uuid) to authenticated, service_role;