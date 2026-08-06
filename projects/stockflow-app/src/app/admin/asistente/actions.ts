"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTz, startOfMonth } from "@/lib/date";
import { construirReporte } from "@/lib/asistente/composer";
import { armarEntradas } from "@/lib/asistente/entradas";
import { contextoDeMercado } from "@/lib/asistente/mercado";
import { narrarMes } from "@/lib/asistente/narrativa";

/* Un claim 'generando' más viejo que esto se considera huérfano (proceso caído a
   mitad de camino) y se puede tomar: el timeout del modelo es 20s + un reintento,
   así que 5 minutos es holgado. Sin esto, un crash te bloquearía hasta mañana. */
const CLAIM_HUERFANO_MIN = 5;

export type ResultadoActualizar = { ok: true } | { ok: false; error: string };

/**
 * Genera un análisis nuevo a pedido del dueño. La cota de costo NO es este
 * código: es el índice único parcial de 043 — una actualización manual por día
 * y por negocio, decidida por la base. El claim se inserta ANTES de llamar al
 * modelo: de dos requests simultáneos, uno gana el insert y el otro recibe
 * 23505 sin haber gastado nada.
 *
 * Los datos salen de las RPCs del lado del DUEÑO (gateadas por RLS): el análisis
 * ve exactamente lo que el dueño puede ver, ni una fila más.
 */
export async function actualizarAnalisis(): Promise<ResultadoActualizar> {
  const session = await requireOwner();
  if (!session.store.ai_assistant_enabled) {
    return { ok: false, error: "El asistente no está activo en tu plan." };
  }

  const hoy = todayInTz(session.store.timezone);
  const desde = startOfMonth(hoy);
  const admin = createAdminClient();

  // ── El claim: reservar el turno del día ANTES de gastar la llamada ──────────
  let claimId: string | null = null;
  const { data: claim, error: errClaim } = await admin
    .from("asistente_analisis")
    .insert({
      store_id: session.store.id,
      origen: "manual",
      dia: hoy,
      period_from: desde,
      period_to: hoy,
      estado: "generando",
    })
    .select("id")
    .single();

  if (errClaim) {
    if (errClaim.code !== "23505") {
      return { ok: false, error: "No pudimos iniciar la actualización. Probá de nuevo." };
    }
    /* Ya hay un turno hoy. Si es un claim huérfano (proceso caído), se toma;
       si es de verdad, el mensaje distingue "en curso" de "ya actualizaste". */
    const corte = new Date(Date.now() - CLAIM_HUERFANO_MIN * 60_000).toISOString();
    const { data: tomado } = await admin
      .from("asistente_analisis")
      .update({ created_at: new Date().toISOString() })
      .eq("store_id", session.store.id)
      .eq("origen", "manual")
      .eq("dia", hoy)
      .eq("estado", "generando")
      .lt("created_at", corte)
      .select("id");

    if (!tomado || tomado.length === 0) {
      const { data: hoyRow } = await admin
        .from("asistente_analisis")
        .select("estado")
        .eq("store_id", session.store.id)
        .eq("origen", "manual")
        .eq("dia", hoy)
        .in("estado", ["generando", "ok"])
        .maybeSingle();
      return {
        ok: false,
        error:
          hoyRow?.estado === "generando"
            ? "Ya hay una actualización en curso. Esperá unos segundos y recargá."
            : "Ya actualizaste el análisis hoy. Mañana podés generar otro.",
      };
    }
    claimId = tomado[0].id;
  } else {
    claimId = claim.id;
  }

  const marcarFallido = async () => {
    await admin.from("asistente_analisis").update({ estado: "fallido" }).eq("id", claimId);
  };

  try {
    // ── Los datos, con los permisos del dueño ─────────────────────────────────
    const supabase = await createSupabaseServer();
    const rango = { p_store_id: session.store.id, p_from: desde, p_to: hoy };
    const [{ data: resumen }, { data: medios }, { data: gastos }, { data: margenes }, { data: dash }] =
      await Promise.all([
        supabase.rpc("reportes_summary", rango),
        supabase.rpc("reportes_medios", rango),
        supabase.rpc("reportes_expenses", rango),
        supabase.rpc("margenes_erosionados", { p_store_id: session.store.id }),
        supabase.rpc("dashboard_summary", { p_store_id: session.store.id }),
      ]);

    const entradas = armarEntradas({
      resumen,
      medios,
      gastos,
      margenes,
      alertas: dash as { low_stock?: unknown; expiring?: unknown } | null,
    });
    if (!entradas) {
      await marcarFallido();
      return { ok: false, error: "No pudimos leer los datos del negocio. Probá de nuevo." };
    }

    const reporte = construirReporte(entradas.datos, entradas.alertas, entradas.margenes, {
      storeName: session.store.name,
      vertical: session.store.vertical,
      from: desde,
    });
    const mercado = await contextoDeMercado(session.store.vertical);
    const r = await narrarMes(reporte, { crudos: entradas.crudos, mercado });

    if (r.estado !== "ok" || !r.analisis) {
      await marcarFallido();
      return {
        ok: false,
        error:
          r.estado === "desactivada"
            ? "El asistente no está configurado en este entorno."
            : "El análisis no pasó la verificación de esta pasada. Probá de nuevo en un rato.",
      };
    }

    const { error: errOk } = await admin
      .from("asistente_analisis")
      .update({
        estado: "ok",
        analisis: r.analisis,
        modelo: r.modelo,
        tokens_in: r.tokensIn,
        tokens_out: r.tokensOut,
      })
      .eq("id", claimId);
    if (errOk) {
      await marcarFallido();
      return { ok: false, error: "El análisis se generó pero no se pudo guardar. Probá de nuevo." };
    }

    revalidatePath("/admin/asistente");
    return { ok: true };
  } catch {
    await marcarFallido();
    return { ok: false, error: "Algo falló generando el análisis. Probá de nuevo." };
  }
}
