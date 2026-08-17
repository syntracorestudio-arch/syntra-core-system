import { AppShell } from "@/components/shell/app-shell";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getStoreMpAuth } from "@/lib/mercadopago";
import { CajaClient, type CierreData } from "./caja-client";
import { CobrosHuerfanos, type CobroHuerfano } from "./cobros-huerfanos";
import { GruposMedioCobrar, type GrupoMedioCobrar } from "./grupos-medio-cobrar";

export const dynamic = "force-dynamic";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  /* 052 · la caja deja de ser owner-only, pero NO se abre: se PARTE.
     Quien tiene `can_close_register` entra a contar el cajón y `cierre_caja`
     le devuelve un payload recortado —efectivo esperado, ventas del turno y
     anuladas— sin facturado, sin desglose por medio y sin el detalle de
     ventas. El recorte vive en SQL, no acá: entrar por URL no alcanza para
     ver un peso de más. Ver docs/permisos-audit.md §D-1. */
  const session = await requireSession();
  const puedeCerrar =
    session.member.role === "owner" || session.member.can_close_register;
  if (!puedeCerrar) redirect("/pos");
  /* 054 · los bloques de plata colgada (grupos a medio cobrar, cobros sin
     venta) son del DUEÑO y no se piden para el empleado. Se escribieron cuando
     esta página era owner-only; 052 la partió y el merge del split los dejó
     alcanzables para quien sólo cuenta el cajón. El gate real está en SQL
     (054 los pasó a owner), esto evita además pedir algo que va a fallar. */
  const esOwner = session.member.role === "owner";
  const supabase = await createSupabaseServer();

  // Fecha explícita para poder revisar días anteriores; por defecto, hoy.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d : null;

  const [{ data }, { data: huerfanos }, { data: medioCobrar }, mpAuth, { data: settings }] =
    await Promise.all([
      supabase.rpc("cierre_caja", { p_store_id: session.store.id, p_fecha: fecha }),
      esOwner
        ? supabase.rpc("cobros_sin_venta", { p_store_id: session.store.id })
        : Promise.resolve({ data: [] }),
      esOwner
        ? supabase.rpc("grupos_a_medio_cobrar", { p_store_id: session.store.id })
        : Promise.resolve({ data: [] }),
      getStoreMpAuth(session.store.id),
      supabase
        .from("store_settings")
        .select("has_posnet")
        .eq("store_id", session.store.id)
        .maybeSingle(),
    ]);

  const cobros = (huerfanos ?? []) as CobroHuerfano[];
  const grupos = (medioCobrar ?? []) as GrupoMedioCobrar[];
  // La terminal Point se ofrece para resumir solo si el negocio la prendió y quedó una
  // terminal configurada (mismo criterio que el POS).
  const posnetActivo = !!mpAuth?.mpTerminalId && Boolean(settings?.has_posnet);

  return (
    <AppShell
      current="/admin/caja"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · ${
        session.member.role === "owner" ? "Dueño" : "Empleado"
      }`}
    >
      {(cobros.length > 0 || grupos.length > 0) && (
        <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-8 lg:pt-8">
          {grupos.length > 0 && (
            <GruposMedioCobrar
              grupos={grupos}
              posnetActivo={posnetActivo}
              reembolsoHabilitado={process.env.STOCKFLOW_REEMBOLSO_HABILITADO === "1"}
            />
          )}
          {cobros.length > 0 && <CobrosHuerfanos cobros={cobros} />}
        </div>
      )}
      <CajaClient
        data={data as CierreData}
        puedeAnular={session.member.role === "owner" || session.member.can_void_sale}
        timezone={session.store.timezone}
      />
    </AppShell>
  );
}
