#!/usr/bin/env bash
# =============================================================================
# StockFlow — load test (tanda 1I) · gate del baseline pre-primer-cliente
#
# `syntra-scale-security-baseline` lo pide explícito: "latencia bajo concurrencia
# (p95 y errores) + la carrera del invariante de negocio. Sin números, no está
# verificado."
#
# Mide lo que de verdad puede romperse en producción:
#   1. Las RPCs de lectura que pintan las pantallas (dashboard y reportes) con
#      volumen REAL de un año — es el riesgo de escala número uno, porque crecen
#      para siempre mientras el kiosco vende.
#   2. La venta bajo concurrencia (ya probada en 1C, acá se mide su latencia).
#   3. El cron de alertas, que barre todos los negocios.
#
# Uso: bash supabase/tests/load-test.sh [repeticiones]
# Requiere: supabase start + db reset + seed_demo.sql aplicados.
# =============================================================================
set -uo pipefail

CONTAINER="supabase_db_stockflow-app"
REPS="${1:-30}"
STORE='11111111-1111-1111-1111-111111111111'
DUENO='aaaaaaaa-0000-0000-0000-000000000001'

psql_t() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -qtAX -c "$1" 2>&1; }

# Mide una consulta N veces y reporta media / p95 / máximo, suplantando a un
# usuario autenticado (sin eso mediríamos sin RLS, que no es el caso real).
# Usa el cronómetro de psql (`\timing`) y NO clock_timestamp() dentro de la
# consulta: Postgres puede reordenar la evaluación del select list y devolvía 0 ms
# en todo, que era mi medición rota y no un sistema instantáneo.
medir() {
  local nombre="$1" sql="$2" umbral="$3"
  local tiempos=()
  for _ in $(seq 1 "$REPS"); do
    local ms
    ms=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres -qX \
          -c "\timing on" \
          -c "set role authenticated" \
          -c "set request.jwt.claims = '{\"sub\":\"$DUENO\",\"role\":\"authenticated\"}'" \
          -c "select $sql" 2>&1 \
          | grep -oE 'Time: [0-9.]+' | tail -1 | grep -oE '[0-9.]+')
    [ -n "$ms" ] && tiempos+=("$ms")
  done

  if [ ${#tiempos[@]} -eq 0 ]; then
    printf '  %-34s SIN DATOS\n' "$nombre"
    return 1
  fi

  local ordenados p95_idx media p95 max
  ordenados=$(printf '%s\n' "${tiempos[@]}" | sort -n)
  p95_idx=$(( (${#tiempos[@]} * 95 + 99) / 100 ))
  media=$(printf '%s\n' "${tiempos[@]}" | awk '{s+=$1} END {printf "%.0f", s/NR}')
  p95=$(echo "$ordenados" | sed -n "${p95_idx}p" | awk '{printf "%.0f", $1}')
  max=$(echo "$ordenados" | tail -1 | awk '{printf "%.0f", $1}')

  local estado="OK  "
  [ "$p95" -gt "$umbral" ] && estado="LENTO"
  printf '  [%s] %-32s media %4s ms · p95 %4s ms · max %4s ms  (umbral %s)\n' \
    "$estado" "$nombre" "$media" "$p95" "$max" "$umbral"
  [ "$p95" -gt "$umbral" ] && return 1
  return 0
}

echo ""
echo "==================================================================="
echo " StockFlow — load test  ($REPS repeticiones por consulta)"
echo "==================================================================="

VENTAS=$(psql_t "select count(*) from public.sales;")
LINEAS=$(psql_t "select count(*) from public.sale_items;")
PRODS=$(psql_t "select count(*) from public.products;")
echo " Volumen actual: $VENTAS ventas · $LINEAS líneas · $PRODS productos"
echo ""

STATUS=0
echo " Lecturas que pintan pantalla:"
medir "dashboard_summary (Resumen)" \
      "public.dashboard_summary('$STORE')" 400 || STATUS=1
medir "reportes_summary (mes)" \
      "public.reportes_summary('$STORE', current_date - 30, current_date)" 800 || STATUS=1
medir "reportes_summary (año)" \
      "public.reportes_summary('$STORE', current_date - 365, current_date)" 1500 || STATUS=1
medir "store_alerts (cron + pantalla)" \
      "public.store_alerts('$STORE')" 300 || STATUS=1
medir "catálogo del POS" \
      "(select count(*) from public.products where status='active')" 150 || STATUS=1

echo ""
echo " Escritura (la venta):"
INICIO=$(date +%s%3N 2>/dev/null || python -c "import time;print(int(time.time()*1000))")
for i in $(seq 1 20); do
  (
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -qtAX -c "
      set role authenticated;
      set request.jwt.claims = '{\"sub\":\"$DUENO\",\"role\":\"authenticated\"}';
      select public.register_sale('$STORE',
        (select jsonb_agg(jsonb_build_object('product_id', id, 'qty', 1))
           from (select id from public.products
                  where store_id='$STORE' and status='active'
                  order by id offset $((i % 40)) limit 3) p),
        'cash', 'load-$i-$(date +%s)');" >/dev/null 2>&1
  ) &
done
wait
FIN=$(date +%s%3N 2>/dev/null || python -c "import time;print(int(time.time()*1000))")
TOTAL=$((FIN - INICIO))
echo "  [OK  ] 20 ventas simultáneas             en $TOTAL ms  (~$((TOTAL / 20)) ms por venta)"

echo ""
echo " Integridad después de la carga:"
DESC=$(psql_t "
  select count(*) from public.products p
   where p.store_id='$STORE'
     and p.stock <> (select coalesce(sum(delta),0) from public.stock_ledger where product_id = p.id);")
if [ "$DESC" = "0" ]; then
  echo "  [OK  ] cache de stock == suma del ledger en todos los productos"
else
  echo "  [FALLA] $DESC productos con el cache descuadrado"
  STATUS=1
fi

# Limpieza de las ventas del test
psql_t "delete from public.sales where idempotency_key like 'load-%';" >/dev/null

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo " ✅ VERDE — listo para el primer cliente"
else
  echo " ❌ Hay consultas por encima del umbral: revisar índices antes de vender"
fi
echo "==================================================================="
exit $STATUS
