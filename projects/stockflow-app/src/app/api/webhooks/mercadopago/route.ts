import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStoreMpAuth,
  mpLeerOrden,
  ordenAprobada,
  ordenTerminada,
  idDePago,
  montoPagado,
} from "@/lib/mercadopago";

export const dynamic = "force-dynamic";
// Cota explícita del baseline para webhooks: le preguntamos a MP por la orden y
// escribimos en la base, nada más. 15 s alcanzan de sobra; sin el tope, un MP
// lento dejaría la función colgada hasta el default de la plataforma.
export const maxDuration = 15;

/**
 * Webhook de MercadoPago — el respaldo, no el camino principal.
 *
 * La caja consulta el estado de la orden directamente contra MP mientras el
 * cliente paga, así que el cobro se resuelve solo. Este webhook existe para el
 * caso feo: el navegador de la caja se cerró, se cortó internet del lado del
 * kiosco justo después de que el cliente pagó. Marca el cobro como aprobado para
 * que la venta se pueda recuperar desde la pantalla de Caja.
 *
 * Nunca confiamos en el body: MP dice "pasó algo con la orden X" y nosotros le
 * volvemos a preguntar a MP qué pasó, con el token del negocio.
 */

function verificarFirma(
  secret: string,
  dataId: string | null,
  xRequestId: string | null,
  xSignature: string | null,
): boolean {
  if (!xSignature || !dataId) return false;
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of xSignature.split(",")) {
    const [k, ...resto] = parte.split("=");
    const val = resto.join("=").trim();
    if (k.trim() === "ts") ts = val;
    else if (k.trim() === "v1") v1 = val;
  }
  if (!ts || !v1) return false;

  // MP: si el id trae letras va en minúscula (los ids de orden son alfanuméricos).
  const id = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${xRequestId ?? ""};ts:${ts};`;
  const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(esperado, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const storeId = url.searchParams.get("store");
  const dataIdParam = url.searchParams.get("data.id");
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  let recursoId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  let topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  try {
    const body = (await req.json()) as {
      type?: string;
      action?: string;
      data?: { id?: string };
      id?: string;
    };
    recursoId = recursoId ?? body?.data?.id ?? body?.id ?? null;
    topic = topic ?? body?.type ?? (body?.action ? body.action.split(".")[0] : null);
  } catch {
    /* sin body JSON */
  }

  if (!storeId || !recursoId) {
    return NextResponse.json({ ok: true, skipped: "sin-datos" });
  }

  const auth = await getStoreMpAuth(storeId);
  if (!auth) return NextResponse.json({ ok: true, skipped: "sin-token" });

  // Con clave de firma configurada, la notificación DEBE venir firmada.
  if (auth.webhookSecret && !verificarFirma(auth.webhookSecret, dataIdParam ?? recursoId, xRequestId, xSignature)) {
    return NextResponse.json({ ok: false, error: "firma-invalida" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Log del evento, best-effort y NO bloqueante. La idempotencia REAL es la UPDATE
  // condicional de más abajo (aplicar "aprobado" dos veces es un no-op). Antes esto
  // hacía `insert` y devolvía early en el conflicto: una notificación "pending"
  // quemaba el slot por-recurso y la de "approved" —la que importa— se descartaba,
  // justo en el caso del navegador cerrado que este webhook existe para cubrir (H3b).
  await admin.from("mp_webhook_events").upsert(
    { event_id: `${storeId}:${recursoId}:${topic ?? "?"}`, store_id: storeId, type: topic },
    { onConflict: "event_id", ignoreDuplicates: true },
  );

  // Buscamos el intento por el id de orden que ya guardamos al crear el QR.
  const { data: intento } = await admin
    .from("payment_intents")
    .select("id, store_id, amount, status")
    .eq("store_id", storeId)
    .eq("mp_order_id", String(recursoId))
    .maybeSingle();

  if (!intento) return NextResponse.json({ ok: true, skipped: "sin-intento" });
  // Converge con el poll y con la cancelación (H2): un pago que aterriza DESPUÉS de
  // que la caja canceló también debe reconciliarse a aprobado, para que la plata
  // capturada no quede enterrada. Solo se saltea lo ya resuelto de verdad.
  if (!["pending", "cancelled"].includes(intento.status)) {
    return NextResponse.json({ ok: true, skipped: "ya-resuelto" });
  }

  // Fuente de verdad: preguntarle a MP.
  const res = await mpLeerOrden(auth.token, String(recursoId));
  if (!res.ok) return NextResponse.json({ ok: true, skipped: "mp-error" });
  const orden = res.orden;

  if (!ordenAprobada(orden)) {
    if (ordenTerminada(orden)) {
      await admin.from("payment_intents").update({ status: "expired" }).eq("id", intento.id);
    }
    return NextResponse.json({ ok: true, status: orden.status });
  }

  // Binding de monto REAL: se compara lo ACREDITADO en MP (no `total_amount`, que
  // es el monto que nosotros pedimos y siempre coincide — un no-op) contra el intento.
  const pagado = montoPagado(orden);
  if (pagado !== null && Math.abs(pagado - Number(intento.amount)) > 0.01) {
    return NextResponse.json({ ok: true, skipped: "monto-no-coincide" });
  }

  // Idempotente y convergente: aprueba tanto un intento pendiente como uno que la
  // caja canceló pero MP terminó cobrando. Aplicarlo dos veces no hace nada.
  await admin
    .from("payment_intents")
    .update({ status: "approved", mp_payment_id: idDePago(orden) })
    .eq("id", intento.id)
    .in("status", ["pending", "cancelled"]);

  return NextResponse.json({ ok: true, applied: true });
}

// MP hace un GET de verificación al dar de alta la URL.
export async function GET() {
  return NextResponse.json({ ok: true });
}
