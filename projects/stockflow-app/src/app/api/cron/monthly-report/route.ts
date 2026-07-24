import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, endOfMonth, startOfMonth, todayInTz } from "@/lib/date";
import {
  construirReporte,
  type Alertas,
  type DatosMensuales,
  type Margenes,
} from "@/lib/asistente/composer";
import { asuntoReporte, renderReporteHTML } from "@/lib/asistente/email";
import { destinatario, enviarReporte } from "@/lib/asistente/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron mensual del Asistente IA (Vercel Cron, 1° de cada mes ~08:00 ART).
 *
 * Manda por email el reporte del MES CERRADO anterior a cada negocio con
 * `ai_assistant_enabled = true` (add-on pago, flag de 019). Determinista, sin LLM.
 *
 * Idempotencia RETRY-SAFE (report_deliveries, 020): se marca 'sent' con `sent_at`
 * SOLO cuando el email salió bien. Si Resend falla, la fila queda 'failed' y el
 * próximo run REINTENTA — nunca se saltea el mes en silencio. El unique
 * (store_id, period) evita doble-envío del mismo mes.
 *
 * Los datos salen de las RPCs existentes vía `asistente_datos_mensuales` (que
 * impersona al dueño porque el cron corre como service_role): los números son
 * idénticos a la página de Reportes. store_alerts y margenes_erosionados_core son
 * service-role y se llaman directo.
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
    .select("id, name, timezone, branding, vertical")
    .eq("status", "active")
    .eq("ai_assistant_enabled", true)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "stores_query_failed" }, { status: 500 });
  }

  let enviados = 0;
  let fallados = 0;
  let salteados = 0;

  for (const store of stores ?? []) {
    // Mes cerrado anterior, en la zona del negocio.
    const mesActual = startOfMonth(todayInTz(store.timezone));
    const anchor = addMonths(mesActual, -1);
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    const period = from.slice(0, 7); // YYYY-MM

    // ¿Ya se entregó este mes? (retry-safe: solo 'sent' saltea; 'failed' reintenta)
    const { data: previa } = await admin
      .from("report_deliveries")
      .select("status, attempts")
      .eq("store_id", store.id)
      .eq("period", period)
      .maybeSingle();

    if (previa?.status === "sent") {
      salteados++;
      continue;
    }
    const intentos = (previa?.attempts ?? 0) + 1;

    async function registrar(fields: { status: string; last_error: string | null; sent_at: string | null }) {
      const { error: errLedger } = await admin.from("report_deliveries").upsert(
        {
          store_id: store.id,
          period,
          attempts: intentos,
          updated_at: new Date().toISOString(),
          ...fields,
        },
        { onConflict: "store_id,period" },
      );
      // Si el libro no se puede escribir, el dedupe deja de funcionar (se re-enviaría
      // el mes). No es silencioso: se loguea para que salte en los logs del cron.
      if (errLedger) console.error("[monthly-report] no se pudo registrar la entrega:", errLedger.message);
    }

    try {
      const [{ data: datos }, { data: alerts }, { data: margenes }] = await Promise.all([
        admin.rpc("asistente_datos_mensuales", { p_store_id: store.id, p_from: from, p_to: to }),
        admin.rpc("store_alerts", { p_store_id: store.id }),
        admin.rpc("margenes_erosionados_core", { p_store_id: store.id }),
      ]);

      const d = datos as DatosMensuales | null;
      const para = destinatario(d?.owner?.email ?? null);
      if (!d || !para) {
        fallados++;
        await registrar({ status: "failed", last_error: "sin_destinatario", sent_at: null });
        continue;
      }

      const reporte = construirReporte(
        d,
        (alerts as Alertas | null) ?? { low_stock: [], expiring: [] },
        (margenes as Margenes | null) ?? { productos: [], total_por_mes: 0 },
        {
          storeName: store.name,
          vertical: store.vertical ?? "kiosco",
          from,
        },
      );

      const accent = (store.branding as { accent?: string } | null)?.accent ?? "#2E6BFF";
      const res = await enviarReporte({
        to: para,
        subject: asuntoReporte(reporte),
        html: renderReporteHTML(reporte, accent),
      });

      if (res.ok) {
        enviados++;
        await registrar({ status: "sent", last_error: null, sent_at: new Date().toISOString() });
      } else {
        fallados++;
        await registrar({ status: "failed", last_error: res.error ?? "envio_fallido", sent_at: null });
      }
    } catch (e) {
      fallados++;
      await registrar({ status: "failed", last_error: (e as Error).message, sent_at: null });
    }
  }

  return NextResponse.json({
    ok: true,
    stores: stores?.length ?? 0,
    sent: enviados,
    failed: fallados,
    skipped: salteados,
  });
}
