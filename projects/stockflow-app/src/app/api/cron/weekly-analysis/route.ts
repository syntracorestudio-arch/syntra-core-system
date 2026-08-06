import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayOf, startOfMonth, todayInTz } from "@/lib/date";
import { construirReporte, type Margenes } from "@/lib/asistente/composer";
import { armarEntradas } from "@/lib/asistente/entradas";
import { contextoDeMercado } from "@/lib/asistente/mercado";
import { narrarMes } from "@/lib/asistente/narrativa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron semanal del asistente (lunes ~08:00 ART): refresca el análisis del mes en
 * curso para que la página no muestre uno viejo sin que el dueño tenga que tocar
 * nada. El del email mensual analiza el mes CERRADO; este mira cómo viene el
 * actual.
 *
 * Cotas (por diseño, no por promesa):
 *   · Salta los primeros días del mes: el email del 1° acaba de cubrir el mes
 *     cerrado y "el mes en curso" con 2 días de datos no diagnostica nada.
 *   · Salta si ya hay un análisis fresco (<3 días): si el dueño actualizó a mano
 *     el viernes, el lunes no hay nada nuevo que decir ni que pagar.
 *   · Con eso, el total estructural queda en ≤31 manuales + ~4 semanales + 1
 *     mensual por negocio/mes — ~USD 0,22 en el peor caso con Haiku.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stores, error } = await admin
    .from("stores")
    .select("id, name, timezone, vertical")
    .eq("status", "active")
    .eq("ai_assistant_enabled", true)
    .limit(500);
  if (error) {
    return NextResponse.json({ error: "stores_query_failed" }, { status: 500 });
  }

  let generados = 0;
  let salteados = 0;
  let fallados = 0;

  for (const store of stores ?? []) {
    const hoy = todayInTz(store.timezone);
    // El email del 1° acaba de salir; con 2-3 días de mes no hay diagnóstico.
    if (dayOf(hoy) <= 3) {
      salteados++;
      continue;
    }

    // ¿Ya hay un análisis fresco? No hay nada nuevo que decir ni que pagar.
    const hace3dias = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const { data: fresco } = await admin
      .from("asistente_analisis")
      .select("id")
      .eq("store_id", store.id)
      .eq("estado", "ok")
      .gte("created_at", hace3dias)
      .limit(1)
      .maybeSingle();
    if (fresco) {
      salteados++;
      continue;
    }

    try {
      const desde = startOfMonth(hoy);
      /* Las mismas RPCs service-role del email mensual: `asistente_datos_mensuales`
         impersona al dueño (solo a él, solo para SU negocio) porque el cron no
         tiene auth.uid(). */
      const [{ data: datos }, { data: alerts }, { data: margenes }] = await Promise.all([
        admin.rpc("asistente_datos_mensuales", { p_store_id: store.id, p_from: desde, p_to: hoy }),
        admin.rpc("store_alerts", { p_store_id: store.id }),
        admin.rpc("margenes_erosionados_core", { p_store_id: store.id }),
      ]);

      const d = datos as { resumen?: unknown; medios?: unknown; gastos?: unknown } | null;
      const entradas = armarEntradas({
        resumen: d?.resumen,
        medios: d?.medios,
        gastos: d?.gastos,
        margenes: (margenes as Margenes | null) ?? undefined,
        alertas: alerts as { low_stock?: unknown; expiring?: unknown } | null,
      });
      if (!entradas) {
        fallados++;
        continue;
      }

      const reporte = construirReporte(entradas.datos, entradas.alertas, entradas.margenes, {
        storeName: store.name,
        vertical: store.vertical ?? "kiosco",
        from: desde,
      });
      const mercado = await contextoDeMercado(store.vertical);
      const r = await narrarMes(reporte, { crudos: entradas.crudos, mercado });

      if (r.estado !== "ok" || !r.analisis) {
        fallados++;
        continue;
      }

      // Sin claim: el cron no compite consigo mismo y 'semanal' no entra en la
      // cota diaria de 'manual'. Se inserta directamente confirmado.
      const { error: errInsert } = await admin.from("asistente_analisis").insert({
        store_id: store.id,
        origen: "semanal",
        dia: hoy,
        period_from: desde,
        period_to: hoy,
        estado: "ok",
        analisis: r.analisis,
        modelo: r.modelo,
        tokens_in: r.tokensIn,
        tokens_out: r.tokensOut,
      });
      if (errInsert) {
        fallados++;
        continue;
      }
      generados++;
    } catch {
      fallados++;
    }
  }

  return NextResponse.json({
    ok: true,
    stores: stores?.length ?? 0,
    generated: generados,
    skipped: salteados,
    failed: fallados,
  });
}
