import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/date";
import { PromosClient, type PromoRow, type Sugerencia } from "./promos-client";

export const dynamic = "force-dynamic";

export default async function PromosPage() {
  const session = await requireSession();

  /* Gate en la página y no en el nav: `create_promo` y `promos_sugeridas` son
     owner-only en SQL (045), así que un empleado que llegue por URL vería una
     pantalla que falla entera. El nav no tiene gate por rol y agregárselo por
     una sola sección sería mover un problema de acá para allá. */
  if (session.member.role !== "owner") redirect("/admin");

  const supabase = await createSupabaseServer();

  const [{ data: listado }, { data: sugeridas }, { data: settings }, { count: vencimientosCargados }] =
    await Promise.all([
      supabase.rpc("promos_listado", { p_store_id: session.store.id }),
      supabase.rpc("promos_sugeridas", { p_store_id: session.store.id }),
      supabase
        .from("store_settings")
        .select("min_margin_pct")
        .eq("store_id", session.store.id)
        .maybeSingle(),
      /* Sólo el CONTEO (head: no trae filas): distingue al dueño nuevo que
         todavía no cargó ningún vencimiento —donde la sección está
         estructuralmente muerta y hay que decírselo— del que sí cargó y no
         tiene nada para liquidar. Sin esa distinción el primero concluye que
         la pantalla no anda. */
      supabase
        .from("stock_expiries")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null),
    ]);

  return (
    <AppShell
      current="/admin/promos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <PromosClient
        promos={(listado ?? []) as PromoRow[]}
        sugerencias={(sugeridas ?? []) as Sugerencia[]}
        hoy={todayInTz(session.store.timezone)}
        margenMinimo={Number(settings?.min_margin_pct ?? 25)}
        tieneVencimientos={(vencimientosCargados ?? 0) > 0}
      />
    </AppShell>
  );
}
