#!/usr/bin/env bash
# =============================================================================
# StockFlow — test de concurrencia de register_sale (tanda 1C)
#
# El invariante de negocio: con stock N y modo estricto, M cajeros vendiendo el
# MISMO producto al mismo tiempo deben cerrar exactamente N ventas — ni una más.
# Es el equivalente al "no sobrevender cupo" de StudioFlow, y es lo único que
# prueba de verdad que el lockeo funciona: los tests de una sola conexión no
# pueden detectar una carrera.
#
# Uso: bash supabase/tests/concurrency.sh [clientes] [stock]
# Requiere: supabase start + db reset ya corridos.
# =============================================================================
set -uo pipefail

CONTAINER="supabase_db_stockflow-app"
CLIENTS="${1:-20}"
STOCK="${2:-10}"

STORE='11111111-1111-1111-1111-111111111111'
DUENO='aaaaaaaa-0000-0000-0000-000000000001'
PROD='d1000000-0000-0000-0000-000000000001'   # Coca-Cola

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -qtAX -c "$1" 2>&1; }

echo ""
echo "=== Concurrencia: $CLIENTS cajeros vendiendo 1 unidad, stock inicial $STOCK ==="

# --- Preparar: stock exacto y modo estricto ---------------------------------
psql_run "update public.store_settings set allow_negative_stock = false where store_id = '$STORE';" >/dev/null
psql_run "delete from public.sales where idempotency_key like 'conc-%';" >/dev/null
psql_run "
  insert into public.stock_ledger (store_id, product_id, delta, reason, note)
  select '$STORE', '$PROD', $STOCK - stock, 'adjust', 'setup test concurrencia'
    from public.products where id = '$PROD' and stock <> $STOCK;" >/dev/null

INICIAL=$(psql_run "select stock::int from public.products where id = '$PROD';")
echo "Stock preparado: $INICIAL"

# --- Disparar N ventas simultáneas ------------------------------------------
TMP=$(mktemp -d)
for i in $(seq 1 "$CLIENTS"); do
  (
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -qtAX \
      -c "set role authenticated;
          set request.jwt.claims = '{\"sub\":\"$DUENO\",\"role\":\"authenticated\"}';
          select public.register_sale('$STORE',
            '[{\"product_id\":\"$PROD\",\"qty\":1}]'::jsonb,
            'cash', 'conc-$i');" >"$TMP/$i.out" 2>&1
    echo $? >"$TMP/$i.code"
  ) &
done
wait

# --- Contar resultados -------------------------------------------------------
OK=0; FAIL=0; OTRO=0
for i in $(seq 1 "$CLIENTS"); do
  if [ "$(cat "$TMP/$i.code")" = "0" ]; then
    OK=$((OK+1))
  elif grep -q "insufficient_stock" "$TMP/$i.out"; then
    FAIL=$((FAIL+1))
  else
    OTRO=$((OTRO+1))
    echo "  error inesperado en cliente $i: $(head -3 "$TMP/$i.out" | tr '\n' ' ')"
  fi
done

VENTAS=$(psql_run "select count(*)::int from public.sales where idempotency_key like 'conc-%' and status = 'completed';")
FINAL=$(psql_run "select stock::int from public.products where id = '$PROD';")
LEDGER=$(psql_run "select coalesce(sum(delta),0)::int from public.stock_ledger where product_id = '$PROD';")
rm -rf "$TMP"

echo ""
echo "Ventas OK          : $OK"
echo "Rechazadas (sin stock): $FAIL"
echo "Errores inesperados: $OTRO"
echo "Ventas en la base  : $VENTAS"
echo "Stock final        : $FINAL  (esperado 0)"
echo "Suma del ledger    : $LEDGER  (debe coincidir con el stock)"
echo ""

STATUS=0
[ "$OTRO" -ne 0 ]            && { echo "FALLA: hubo errores inesperados";                    STATUS=1; }
[ "$VENTAS" -ne "$STOCK" ]   && { echo "FALLA: se cerraron $VENTAS ventas y el stock era $STOCK — SOBREVENTA"; STATUS=1; }
[ "$FINAL" -ne 0 ]           && { echo "FALLA: el stock final es $FINAL, deberia ser 0";     STATUS=1; }
[ "$LEDGER" -ne "$FINAL" ]   && { echo "FALLA: el cache ($FINAL) no coincide con el ledger ($LEDGER)"; STATUS=1; }

if [ "$STATUS" -eq 0 ]; then
  echo "=== VERDE: $CLIENTS cajeros simultaneos, exactamente $STOCK ventas, cero sobreventa ==="
fi

# Restaurar el default del negocio
psql_run "update public.store_settings set allow_negative_stock = true where store_id = '$STORE';" >/dev/null
exit $STATUS
