-- ===========================================================================
-- 053 · `can_apply_discount` vuelve a false en todos lados
--
-- Auditoría: docs/permisos-audit.md §A.3.
--
-- La 052 sacó el toggle "Cambiar precios en la venta" porque estaba DORMIDO:
-- ocho RPCs validan el flag y ninguna pantalla manda `unit_price` — ni para el
-- dueño. Pero sacar el interruptor no apaga lo que ya estaba encendido: quedaron
-- miembros con el permiso en `true`, otorgado cuando el toggle existía.
--
-- POR QUÉ AHORA Y NO "CUANDO LLEGUE LA FUNCIÓN".
--
-- Hoy es inofensivo: nadie lee el flag. La tentación es dejarlo y arreglarlo en
-- la migración que traiga el descuento de mostrador. Eso es un acordate-después,
-- y en este proyecto los acordate-después tienen un historial propio: el
-- fallback del límite de 500 que nunca se construyó, el encabezado desactualizado
-- del plan de onboarding, el "drift conocido" que volvió tres veces.
--
-- El costo de hacerlo ahora es esta línea. El costo de no hacerlo es que el día
-- que la función exista, dos empleados la tengan **sin que nadie se la haya dado
-- a conciencia**, en un contexto distinto y meses después — que es exactamente
-- la concesión silenciosa que esta auditoría vino a eliminar. Mínimo privilegio.
--
-- `actualizar_permisos` (052) ya escribe `false` siempre, así que esto no se
-- revierte solo: es un piso, no un parche temporal.
--
-- No toca el camino de cobro ni ninguna otra columna.
-- ===========================================================================

update public.members
   set can_apply_discount = false
 where can_apply_discount;

-- El default de la columna ya era false (001); se re-declara para que quede
-- explícito que el estado deseado es "apagado hasta que exista la función".
alter table public.members
  alter column can_apply_discount set default false;
