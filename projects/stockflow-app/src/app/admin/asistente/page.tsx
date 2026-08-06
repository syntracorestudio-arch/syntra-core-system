import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/date";
import { AsistenteClient, type AnalisisGuardado, type Pendientes } from "./asistente-client";

export const dynamic = "force-dynamic";

/**
 * La página del asistente. El principio de costo: acá se LEE lo guardado —
 * generar un análisis nuevo es la excepción (botón con cota de 1/día, impuesta
 * por la base en 043, más el cron semanal). La lectura es una query con RLS:
 * el dueño ve solo los análisis de su negocio.
 */
export default async function AsistentePage() {
  const session = await requireOwner();
  const supabase = await createSupabaseServer();
  const hoy = todayInTz(session.store.timezone);

  const [{ data: pendientes }, { data: filas }, { data: turnoHoy }] = await Promise.all([
    // Los pendientes operativos: una RPC, un round-trip, cero costo de modelo.
    supabase.rpc("asistente_pendientes", { p_store_id: session.store.id }),
    supabase
      .from("asistente_analisis")
      .select("id, origen, period_from, period_to, analisis, created_at")
      .eq("store_id", session.store.id)
      .eq("estado", "ok")
      .order("created_at", { ascending: false })
      .limit(6),
    // ¿El turno manual de hoy ya está usado? (para pintar el botón sin probar suerte)
    supabase
      .from("asistente_analisis")
      .select("estado")
      .eq("store_id", session.store.id)
      .eq("origen", "manual")
      .eq("dia", hoy)
      .in("estado", ["generando", "ok"])
      .maybeSingle(),
  ]);

  return (
    <AppShell
      current="/admin/asistente"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <AsistenteClient
        analisis={(filas ?? []) as AnalisisGuardado[]}
        pendientes={(pendientes as Pendientes | null) ?? null}
        activo={session.store.ai_assistant_enabled}
        turnoDeHoyUsado={Boolean(turnoHoy)}
      />
    </AppShell>
  );
}
