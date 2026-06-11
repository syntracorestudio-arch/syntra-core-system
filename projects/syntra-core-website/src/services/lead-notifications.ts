import "server-only";

import { createHmac } from "node:crypto";

import { siteConfig } from "@/config/site";
import { updateLeadNotification } from "@/services/lead-service";
import type { NotificationErrorCode } from "@/lib/validations/lead";
import type { Lead } from "@/types";

/**
 * SYNTRA CORE — Notificación de nuevos leads (app → n8n).
 *
 * Se ejecuta vía `after()` (post-respuesta), nunca bloquea la UX.
 * Best-effort con reintentos acotados: si falla, el lead YA está persistido
 * en Supabase (fuente de verdad). La entrega final al canal (email) es
 * responsabilidad de n8n.
 *
 * Observabilidad (TASK-020): el resultado del salto app→n8n se registra en el
 * eje `notification_status` del lead (pending → sent | failed). La escritura del
 * estado es best-effort y nunca compromete el lead.
 */

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 3000;
const BACKOFF_MS = [500, 2000]; // espera entre intentos

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Firma HMAC-SHA256 del mensaje `${timestamp}.${body}` (TASK-023A).
 * Devuelve el valor versionado del header: `v1=<hmac hex>`. El secreto NUNCA
 * viaja en esta firma (solo su derivada). Reusa `LEAD_WEBHOOK_SECRET`.
 */
function signPayload(secret: string, timestamp: string, body: string): string {
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `v1=${hmac}`;
}

/** Mapea un error de transporte a un código controlado (sin PII/secretos). */
function toErrorCode(err: unknown): NotificationErrorCode {
  if (err instanceof Error || (typeof err === "object" && err !== null)) {
    const name = (err as { name?: string }).name;
    if (name === "TimeoutError" || name === "AbortError") return "timeout";
    if (name === "TypeError") return "network_error";
  }
  return "unexpected_error";
}

function buildPayload(lead: Lead) {
  return {
    event: "lead.created" as const,
    occurred_at: lead.created_at,
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      message: lead.message,
      source: lead.source,
      status: lead.status,
      created_at: lead.created_at,
    },
    links: {
      panel: `${siteConfig.url}/panel/${lead.id}`,
    },
  };
}

export async function notifyNewLead(lead: Lead): Promise<void> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    // En producción, no tener webhook es una misconfiguración real → failed.
    // Fuera de prod, NO marcar failed (sería falso positivo): queda 'pending'.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[notify] LEAD_WEBHOOK_URL no configurado en producción — lead no notificado.",
      );
      await updateLeadNotification(lead.id, {
        status: "failed",
        attempts: 0,
        errorCode: "missing_webhook_url",
      });
    } else {
      console.warn(
        "[notify] LEAD_WEBHOOK_URL no configurado (no-prod) — sin notificación, lead queda pending.",
      );
    }
    return;
  }

  const secret = process.env.LEAD_WEBHOOK_SECRET;
  const body = JSON.stringify(buildPayload(lead));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Clave de idempotencia: n8n deduplica por el id del lead.
    "x-idempotency-key": lead.id,
  };
  if (secret) {
    // Migración de firma (TASK-023A — headers duales, sin downtime):
    // 1) Legacy: secreto en claro. Se mantiene para que el n8n ACTUAL no rompa.
    headers["x-syntra-signature"] = secret;
    // 2) Nuevo: HMAC real + timestamp. Se calculan UNA sola vez por lead, fuera
    //    del loop de reintentos → la firma es estable durante los 3 intentos
    //    (no rompe idempotencia ni la futura ventana anti-replay de n8n).
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers["x-syntra-timestamp"] = timestamp;
    headers["x-syntra-hmac"] = signPayload(secret, timestamp, body);
  }

  let lastErrorCode: NotificationErrorCode = "unexpected_error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        if (attempt > 1) {
          console.info(`[notify] lead ${lead.id} notificado (intento ${attempt}).`);
        }
        await updateLeadNotification(lead.id, {
          status: "sent",
          attempts: attempt,
          notifiedAt: new Date().toISOString(),
          errorCode: null,
        });
        return;
      }
      lastErrorCode = "http_error";
      console.error(`[notify] intento ${attempt}: n8n respondió ${res.status}.`);
    } catch (err) {
      lastErrorCode = toErrorCode(err);
      console.error(
        `[notify] intento ${attempt} falló:`,
        err instanceof Error ? err.message : "error desconocido",
      );
    }
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1] ?? 2000);
  }

  console.error(
    `[notify] lead ${lead.id} NO notificado tras ${MAX_ATTEMPTS} intentos. ` +
      "El lead está persistido en Supabase (fuente de verdad).",
  );
  await updateLeadNotification(lead.id, {
    status: "failed",
    attempts: MAX_ATTEMPTS,
    errorCode: lastErrorCode,
  });
}
