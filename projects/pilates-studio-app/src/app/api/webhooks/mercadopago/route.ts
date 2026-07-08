import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioMpToken } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const CONCEPT_LABEL: Record<string, string> = {
  pack: "Pack",
  drop_in: "Clase suelta",
  membership: "Membresía",
  abono: "Abono",
};

function money(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

/**
 * Webhook de MercadoPago. La FUENTE DE VERDAD es la API de MP: no confiamos en el body,
 * re-consultamos el pago con el token del estudio. Idempotente (mercadopago_webhook_events).
 * Aplica el beneficio SOLO al estado 'approved'. Responde 200 siempre (MP reintenta si no).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const studioId = url.searchParams.get("studio");

  // id del pago: puede venir en query (?data.id / ?id) o en el body JSON.
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  let topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  try {
    const body = (await req.json()) as { type?: string; action?: string; data?: { id?: string } };
    paymentId = paymentId ?? body?.data?.id ?? null;
    topic = topic ?? body?.type ?? (body?.action ? body.action.split(".")[0] : null);
  } catch {
    /* sin body JSON */
  }

  // Solo nos interesan notificaciones de pago con estudio resoluble.
  if (!studioId || !paymentId || (topic && topic !== "payment")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const token = await getStudioMpToken(studioId);
  if (!token) return NextResponse.json({ ok: true, skipped: "no-token" });

  // Fuente de verdad: consultar el pago en MP.
  let pay: { status?: string; external_reference?: string; transaction_amount?: number } | null = null;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ ok: true, skipped: "mp-fetch" });
    pay = await r.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: "mp-error" });
  }

  const attemptId = pay?.external_reference ?? null;
  const status = pay?.status ?? null;
  if (!attemptId) return NextResponse.json({ ok: true, skipped: "no-ref" });

  const admin = createAdminClient();

  // Estados no aprobados: reflejar en el intento (sin aplicar beneficio).
  if (status === "rejected") {
    await admin.from("payment_attempts").update({ status: "rejected" }).eq("id", attemptId).eq("studio_id", studioId);
    return NextResponse.json({ ok: true, status });
  }
  if (status !== "approved") {
    return NextResponse.json({ ok: true, status });
  }

  // Idempotencia a nivel evento: primer 'approved' de este pago procesa; repetidos se ignoran.
  const { error: dupErr } = await admin
    .from("mercadopago_webhook_events")
    .insert({ event_id: String(paymentId), studio_id: studioId, type: "payment", processed_at: new Date().toISOString() });
  if (dupErr) return NextResponse.json({ ok: true, duplicate: true });

  // Aplicar (idempotente también a nivel intento).
  const { data: applied } = await admin.rpc("apply_online_payment", {
    p_attempt_id: attemptId,
    p_provider_payment_id: String(paymentId),
  });

  if (applied === true) {
    // Datos para el aviso in-app al dueño.
    const { data: att } = await admin
      .from("payment_attempts")
      .select("member_id, amount, concept")
      .eq("id", attemptId)
      .maybeSingle();
    let memberName = "Un alumno";
    if (att?.member_id) {
      const { data: m } = await admin
        .from("members")
        .select("profiles(full_name)")
        .eq("id", att.member_id)
        .maybeSingle();
      const prof = Array.isArray(m?.profiles) ? m?.profiles[0] : m?.profiles;
      memberName = (prof?.full_name as string) ?? memberName;
    }
    const label = att ? (CONCEPT_LABEL[att.concept] ?? att.concept) : "pago";
    await createNotification(studioId, {
      type: "payment",
      title: "Pago recibido",
      body: att ? `${memberName} pagó ${money(Number(att.amount))} · ${label}` : `${memberName} realizó un pago`,
      link: att?.member_id ? `/admin/alumnos/${att.member_id}` : "/admin",
    });
  }

  return NextResponse.json({ ok: true, applied: applied === true });
}

// MP a veces hace GET de verificación.
export async function GET() {
  return NextResponse.json({ ok: true });
}
