import "server-only";

import { siteConfig } from "@/config/site";
import type { Lead } from "@/types";

/**
 * SYNTRA CORE — Notificación de nuevos leads (app → n8n).
 *
 * Se ejecuta vía `after()` (post-respuesta), nunca bloquea la UX.
 * Best-effort con reintentos acotados: si falla, el lead YA está persistido
 * en Supabase (fuente de verdad). La entrega final al canal (email) es
 * responsabilidad de n8n.
 */

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 3000;
const BACKOFF_MS = [500, 2000]; // espera entre intentos

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    console.warn("[notify] LEAD_WEBHOOK_URL no configurado — sin notificación.");
    return;
  }

  const secret = process.env.LEAD_WEBHOOK_SECRET;
  const body = JSON.stringify(buildPayload(lead));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Clave de idempotencia: n8n deduplica por el id del lead.
    "x-idempotency-key": lead.id,
  };
  if (secret) headers["x-syntra-signature"] = secret;

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
        return;
      }
      console.error(`[notify] intento ${attempt}: n8n respondió ${res.status}.`);
    } catch (err) {
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
}
