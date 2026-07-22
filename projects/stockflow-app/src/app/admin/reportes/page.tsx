import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ReportesClient, type ReportesData, type Periodo } from "./reportes-client";

export const dynamic = "force-dynamic";

/** Rango del período pedido, calculado en el server para que el link sea compartible. */
function rango(periodo: Periodo, offset: number): { from: string; to: string } {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  if (periodo === "semana") {
    // Semana argentina: arranca el lunes.
    const dow = (d.getUTCDay() + 6) % 7;
    const lunes = new Date(d);
    lunes.setUTCDate(d.getUTCDate() - dow + offset * 7);
    const domingo = new Date(lunes);
    domingo.setUTCDate(lunes.getUTCDate() + 6);
    return { from: iso(lunes), to: iso(domingo) };
  }

  if (periodo === "mes") {
    const desde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
    const hasta = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0));
    return { from: iso(desde), to: iso(hasta) };
  }

  const desde = new Date(Date.UTC(d.getUTCFullYear() + offset, 0, 1));
  const hasta = new Date(Date.UTC(d.getUTCFullYear() + offset, 11, 31));
  return { from: iso(desde), to: iso(hasta) };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; o?: string }>;
}) {
  const sp = await searchParams;
  const periodo: Periodo =
    sp.p === "semana" || sp.p === "anio" ? sp.p : "mes"; // default mes: es como el kiosquero piensa el negocio
  const offset = Math.max(-24, Math.min(0, Number(sp.o) || 0));

  const session = await requireOwner();
  const supabase = await createSupabaseServer();
  const { from, to } = rango(periodo, offset);

  const { data } = await supabase.rpc("reportes_summary", {
    p_store_id: session.store.id,
    p_from: from,
    p_to: to,
  });

  return (
    <AppShell
      current="/admin/reportes"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <ReportesClient
        data={data as ReportesData}
        periodo={periodo}
        offset={offset}
        from={from}
        to={to}
      />
    </AppShell>
  );
}
