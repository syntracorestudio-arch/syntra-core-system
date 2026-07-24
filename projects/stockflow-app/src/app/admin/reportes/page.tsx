import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { clampAnchor, isYMD, rangeFor, todayInTz } from "@/lib/date";
import {
  ReportesClient,
  type ReportesData,
  type MediosData,
  type ExpensesData,
  type Periodo,
} from "./reportes-client";

export const dynamic = "force-dynamic";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const periodo: Periodo =
    sp.p === "semana" || sp.p === "anio" ? sp.p : "mes"; // default mes: es como el kiosquero piensa el negocio

  const session = await requireOwner();
  const supabase = await createSupabaseServer();

  /* El período viaja como fecha ABSOLUTA (?d=YYYY-MM-DD), no como offset relativo:
     el link queda estable y mapea 1:1 al picker. "Hoy" se calcula en la zona del
     negocio (no del server) y el anchor se encajona al piso de 24 meses / sin futuro
     — así ninguna lectura se sale de la cota (scale-security-baseline). */
  const hoy = todayInTz(session.store.timezone);
  const anchor = clampAnchor(isYMD(sp.d) ? sp.d : hoy, hoy);
  const { from, to } = rangeFor(periodo, anchor);

  /* Dos RPC en paralelo y no una: sumarle los medios de pago a
     `reportes_summary` obligaba a redefinir sus ~300 líneas en la migración,
     y de ahí en más conviven dos copias del mismo cuerpo. */
  const [{ data }, { data: medios }, { data: gastos }] = await Promise.all([
    supabase.rpc("reportes_summary", {
      p_store_id: session.store.id,
      p_from: from,
      p_to: to,
    }),
    supabase.rpc("reportes_medios", {
      p_store_id: session.store.id,
      p_from: from,
      p_to: to,
    }),
    /* Aditiva y aparte (patrón 017): sumarle los gastos a `reportes_summary`
       obligaba a redefinir su cuerpo en la migración. El neto lo computa el
       cliente (bruto de summary − gastos). */
    supabase.rpc("reportes_expenses", {
      p_store_id: session.store.id,
      p_from: from,
      p_to: to,
    }),
  ]);

  return (
    <AppShell
      current="/admin/reportes"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <ReportesClient
        data={data as ReportesData}
        medios={medios as MediosData}
        gastos={gastos as ExpensesData}
        periodo={periodo}
        anchor={anchor}
        today={hoy}
        from={from}
        to={to}
      />
    </AppShell>
  );
}
