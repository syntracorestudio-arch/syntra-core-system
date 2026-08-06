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
import { narrarMes } from "@/lib/asistente/narrativa";
import type { Analisis } from "@/lib/asistente/analisis";
import { contextoDeMercado } from "@/lib/asistente/mercado";
import { baseEfimera } from "@/lib/asistente/enlaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tope de intentos con narrativa por (negocio, mes). Es una cota de COSTO, no de
 * entrega: pasado esto el reporte se sigue mandando, pero con la plantilla
 * determinista. Si algo del envío está roto, el modelo deja de cobrarse.
 */
const MAX_INTENTOS_NARRATIVA = 3;

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

  /* Un túnel de desarrollo o localhost en la URL base manda botones que mueren en
     horas. No se bloquea el envío —puede ser una prueba a propósito— pero tiene
     que gritar en los logs: si no, los links rotos se descubren cuando un cliente
     hace clic. */
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (baseEfimera(base)) {
    console.warn(`[monthly-report] NEXT_PUBLIC_APP_URL es un entorno pasajero (${base}): los botones del email van a morir con él.`);
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

    /* La auditoría de la narrativa (qué se dijo, con qué modelo, cuántos tokens)
       va en un UPDATE aparte y NO fatal: es el libro de costos del add-on, no la
       entrega. Si 042 todavía no corrió en el entorno, esto falla solo y el
       reporte igual sale. */
    async function registrarNarrativa(fields: Record<string, unknown>) {
      const { error: errNarr } = await admin
        .from("report_deliveries")
        .update(fields)
        .eq("store_id", store.id)
        .eq("period", period);
      if (errNarr) console.error("[monthly-report] no se pudo registrar la narrativa:", errNarr.message);
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

      /* Fase 2: el párrafo que lee el mes. Nunca bloquea el envío — si no hay API
         key, si la API falla o si inventó una cifra, el email sale con la plantilla
         determinista.

         COTA DE COSTO (el add-on se paga por token): como máximo UNA llamada al
         modelo por negocio y por mes, pase lo que pase.
           · Si ya hay narrativa guardada de este período, se reusa: un reintento
             por email fallido no vuelve a pagar el párrafo (y encima manda el
             mismo texto, no uno nuevo).
           · Después de MAX_INTENTOS entregas fallidas se deja de generar: si algo
             está roto en el envío, que no siga costando plata.
         El select va aparte y NO es fatal: la columna es de 042 y si no se corrió,
         el reporte tiene que salir igual. */
      const { data: guardada } = await admin
        .from("report_deliveries")
        .select("narrativa")
        .eq("store_id", store.id)
        .eq("period", period)
        .maybeSingle();

      const guardadoPrevio = (guardada as { narrativa?: string | null } | null)?.narrativa ?? null;
      let analisis: Analisis | null = guardadoPrevio ? (JSON.parse(guardadoPrevio) as Analisis) : null;
      let narrativa: Awaited<ReturnType<typeof narrarMes>> | null = null;
      if (!analisis && intentos <= MAX_INTENTOS_NARRATIVA) {
        /* La inflación oficial del rubro. Cacheada por rubro dentro de la
           corrida: 500 negocios NO son 500 llamadas a INDEC. Si no responde, el
           análisis sale sin la comparación contra el mercado, nunca con una
           estimación. */
        const mercado = await contextoDeMercado(store.vertical);
        narrativa = await narrarMes(reporte, {
          mercado,
          /* Sin los crudos el análisis solo puede repetir lo que el email ya
             muestra: acá viajan el precio sugerido por producto, la salud del
             dato, las categorías y las franjas. */
          crudos: {
            datos: d,
            margenes: (margenes as Margenes | null) ?? { productos: [], total_por_mes: 0 },
          },
        });
        analisis = narrativa.analisis;
      }

      const accent = (store.branding as { accent?: string } | null)?.accent ?? "#2E6BFF";
      const res = await enviarReporte({
        to: para,
        subject: asuntoReporte(reporte),
        html: renderReporteHTML(reporte, accent, process.env.NEXT_PUBLIC_APP_URL, analisis),
      });

      if (res.ok) {
        enviados++;
        await registrar({ status: "sent", last_error: null, sent_at: new Date().toISOString() });
        // Solo se registra lo que se GENERÓ en este run (si se reusó, ya está en la fila).
        if (narrativa && narrativa.estado !== "desactivada") {
          await registrarNarrativa({
            narrativa: narrativa.analisis ? JSON.stringify(narrativa.analisis) : null,
            narrativa_estado: narrativa.estado,
            narrativa_motivo: narrativa.motivo,
            narrativa_modelo: narrativa.modelo,
            narrativa_tokens_in: narrativa.tokensIn,
            narrativa_tokens_out: narrativa.tokensOut,
          });
        }
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
