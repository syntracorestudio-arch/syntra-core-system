import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStore } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diario de alertas (Vercel Cron, 09:00 ART).
 *
 * Es el corazón del "el sistema trabaja solo": recorre los negocios activos y
 * avisa por push lo que requiere acción HOY — stock bajo y mercadería por vencer.
 *
 * Por qué acá y no en pg_cron: enviar Web Push exige firmar con la clave privada
 * VAPID y cifrar el payload. Hacerlo desde Postgres implicaría meter la clave en
 * la base y usar pg_net. Este route corre server-side, donde la clave ya vive.
 *
 * El dedupe vive en `notifications.dedupe_key` (único por negocio): si el cron se
 * ejecuta dos veces el mismo día, el segundo envío no sale.
 */
export async function GET(request: NextRequest) {
  // Autenticación del cron por secreto en header. Sin esto, cualquiera puede
  // disparar notificaciones a todos los negocios.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stores, error } = await admin
    .from("stores")
    .select("id, name")
    .eq("status", "active")
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "stores_query_failed" }, { status: 500 });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  let avisados = 0;

  for (const store of stores ?? []) {
    const { data: alerts } = await admin.rpc("store_alerts", { p_store_id: store.id });
    if (!alerts) continue;

    const low = (alerts.low_stock ?? []) as { name: string; stock: number }[];
    const exp = (alerts.expiring ?? []) as { name: string; days_left: number }[];

    if (low.length > 0) {
      const primero = low[0];
      const resto = low.length - 1;
      const stock = Number(primero.stock);

      // El stock negativo es válido (se vendió más de lo cargado), pero decir
      // "quedan -2" no le dice nada a nadie. Se traduce a lo que significa.
      const cuanto =
        stock <= 0
          ? "Ya no te queda ninguno según el sistema"
          : `Quedan ${stock}`;
      const titulo = stock <= 0 ? `Te quedaste sin ${primero.name}` : `Te estás quedando sin ${primero.name}`;

      const ok = await notifyStore(store.id, {
        type: "low_stock",
        title: titulo,
        body:
          resto > 0
            ? `${cuanto}. Y otros ${resto} producto${resto === 1 ? "" : "s"} bajo mínimo.`
            : `${cuanto}. Conviene reponer.`,
        url: "/admin/productos",
        tag: "low-stock",
        dedupeKey: `low_stock:${hoy}`,
      });
      if (ok) avisados++;
    }

    if (exp.length > 0) {
      const urgente = exp[0];
      const cuando =
        urgente.days_left <= 0
          ? "ya venció"
          : urgente.days_left === 1
            ? "vence mañana"
            : `vence en ${urgente.days_left} días`;
      const resto = exp.length - 1;
      const ok = await notifyStore(store.id, {
        type: "expiring",
        title: `${urgente.name} ${cuando}`,
        body:
          resto > 0
            ? `Y otros ${resto} producto${resto === 1 ? "" : "s"} por vencer. Sacalos antes de perderlos.`
            : "Sacalo antes de perderlo.",
        url: "/admin/vencimientos",
        tag: "expiring",
        dedupeKey: `expiring:${hoy}`,
      });
      if (ok) avisados++;
    }
  }

  return NextResponse.json({
    ok: true,
    stores: stores?.length ?? 0,
    notified: avisados,
  });
}
