/**
 * ARQUETIPO: lista densa — cola de trabajo (design-layer-plan.md §2.A).
 * PROTAGONISTA: la plata en juego de cada lote (cantidad × precio de venta).
 * DOS GRUPOS: "por vencer" (todavía se puede hacer algo) arriba, "vencido"
 * (papeleo que además falsea el stock) colapsado abajo.
 */
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/date";
import {
  VencimientosClient,
  type ExpiryRow,
  type SugerenciaPromo,
} from "./vencimientos-client";

export const dynamic = "force-dynamic";

export default async function VencimientosPage() {
  const session = await requireSession();
  const supabase = await createSupabaseServer();

  // Cota explícita: sólo lo pendiente y hasta 180 días adelante. Un vencimiento
  // a dos años no es una alerta, es ruido (baseline: nada sin techo).
  /* Las sugerencias de promo se piden acá para que la fila pueda ofrecer
     "ponerlo en promo" sin sacar al dueño de la pantalla donde estaba
     decidiendo. Owner-only en SQL: para un empleado la RPC levanta
     `not_allowed`, así que ni se llama — Vencimientos no puede romperse por
     una feature del dueño. */
  const esOwner = session.member.role === "owner";
  /* 070 · quién puede resolver. Es EXACTAMENTE el permiso de `resolve_expiry`
     (006:31) y de `addExpiry`: se pasa al cliente para no dibujar botones que
     el servidor va a rechazar. Antes se mostraban a todos y un empleado sin el
     flag recibía "no tenés permiso" después de tocar. */
  const puedeResolver = esOwner || session.member.can_receive_stock;

  const [{ data }, { data: settings }, sugeridas] = await Promise.all([
    supabase
      .from("pending_expiries")
      /* 070 · `valor_venta` viene de la vista y NO se calcula acá: es la
         columna por la que se ordena el grupo de vencidos, y ordenar en memoria
         sólo funciona mientras la lista entre entera en la página. */
      .select("id, product_name, product_emoji, expiry_date, qty, days_left, valor_venta")
      .lte("days_left", 180)
      .order("expiry_date")
      .limit(200),
    supabase
      .from("store_settings")
      .select("expiry_warning_days")
      .eq("store_id", session.store.id)
      .maybeSingle(),
    esOwner
      ? supabase
          .rpc("promos_sugeridas", { p_store_id: session.store.id })
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  /* 070 · se fue la consulta de 500 productos que existía SÓLO para poblar un
     `<select>` nativo. Con 2007 productos en el catálogo, ese select dejaba
     1507 (75%) inalcanzables desde esta pantalla: no era lentitud, era que no
     se podía cargar el vencimiento de tres cuartos del stock. Ahora el
     producto se resuelve escaneando o buscando server-side, igual que en
     Recibir mercadería. */

  const rows: ExpiryRow[] = (data ?? []).map((e) => ({
    id: e.id,
    productName: e.product_name,
    productEmoji: e.product_emoji,
    expiryDate: e.expiry_date,
    qty: Number(e.qty),
    daysLeft: e.days_left,
    valorVenta: Number(e.valor_venta ?? 0),
  }));

  return (
    <AppShell
      current="/admin/vencimientos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      <VencimientosClient
        expiries={rows}
        sugerencias={(sugeridas as SugerenciaPromo[]).filter((s) => s.aplicable)}
        hoy={todayInTz(session.store.timezone)}
        warningDays={settings?.expiry_warning_days ?? 7}
        canEdit={puedeResolver}
        /* El límite de la consulta viaja para que el total de plata pueda decir
           que está truncado. Un total que miente por paginación es peor que no
           tenerlo. */
        truncado={(data ?? []).length >= 200}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      />
    </AppShell>
  );
}
