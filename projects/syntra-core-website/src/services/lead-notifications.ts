import "server-only";

import { siteConfig, projectTypeOptions } from "@/config/site";
import { updateLeadNotification } from "@/services/lead-service";
import type { NotificationErrorCode } from "@/lib/validations/lead";
import type { Lead } from "@/types";

/**
 * SYNTRA CORE — Notificación de nuevos leads (app → email DIRECTO vía Resend).
 *
 * Reemplaza el salto por n8n (pedido owner 2026-07-14: sacar n8n del camino).
 * El transporte es la API REST de Resend por fetch — sin dependencias nuevas.
 * Se conserva la maquinaria probada del circuito anterior:
 *  - corre vía `after()` (post-respuesta), nunca bloquea la UX;
 *  - best-effort con 3 reintentos y backoff; el lead YA está en Supabase
 *    (fuente de verdad) pase lo que pase;
 *  - observabilidad en `notification_status` (pending → sent | failed).
 *
 * Config (env):
 *  - RESEND_API_KEY   — API key de Resend.
 *  - LEAD_NOTIFY_TO   — casilla que recibe los leads (el Gmail del estudio).
 *  - LEAD_EMAIL_FROM  — opcional; default sandbox de Resend. Cuando el dominio
 *    syntracore.dev esté verificado: "SYNTRA CORE <hola@syntracore.dev>".
 * El mail sale con reply-to = email del lead → se responde directo.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "SYNTRA CORE <onboarding@resend.dev>";

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 5000;
const BACKOFF_MS = [500, 2000]; // espera entre intentos

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mapea un error de transporte a un código controlado (sin PII/secretos). */
function toErrorCode(err: unknown): NotificationErrorCode {
  if (err instanceof Error || (typeof err === "object" && err !== null)) {
    const name = (err as { name?: string }).name;
    if (name === "TimeoutError" || name === "AbortError") return "timeout";
    if (name === "TypeError") return "network_error";
  }
  return "unexpected_error";
}

/** Escape mínimo para interpolar datos del usuario en el HTML del mail. */
function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Fila label/valor del template (tabla simple, compatible con clientes de mail). */
function row(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:12px 0 2px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:600;">${label}</td>
    </tr>
    <tr>
      <td style="padding:0 0 12px;font-size:15px;line-height:1.55;color:#0f172a;border-bottom:1px solid #e2e8f0;">${valueHtml}</td>
    </tr>`;
}

/** Chips de tipos de proyecto (pills — leen mejor que texto plano). */
function projectTypeChips(lead: Lead): string {
  const keys = lead.project_types ?? [];
  if (!keys.length) return `<span style="color:#94a3b8;">Sin especificar</span>`;
  return keys
    .map((k) => {
      const label = esc(
        projectTypeOptions.find((o) => o.value === k)?.label ?? k,
      );
      return `<span style="display:inline-block;margin:2px 6px 2px 0;padding:4px 12px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:600;">${label}</span>`;
    })
    .join("");
}

/**
 * Template HTML del mail (orden pedido por el owner: legible y con estilo).
 * Inline styles + tablas: máxima compatibilidad (Gmail/Outlook). Datos del
 * usuario SIEMPRE escapados.
 */
function buildEmailHtml(lead: Lead): string {
  const fecha = new Date(lead.created_at).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const mensaje = esc(lead.message).replaceAll("\n", "<br/>");
  const panelUrl = `${siteConfig.url}/panel/${lead.id}`;
  // Preheader: la vista previa que Gmail muestra junto al asunto (oculto en el
  // cuerpo). Sin él, el cliente agarra texto arbitrario del template.
  const preheader = esc(
    `${lead.name} — ${lead.message.slice(0, 90)}${lead.message.length > 90 ? "…" : ""}`,
  );

  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header de marca -->
          <tr>
            <td style="background:#0b1120;border-radius:12px 12px 0 0;padding:22px 28px;">
              <span style="font-size:16px;font-weight:bold;letter-spacing:3px;color:#f8fafc;">SYNTRA <span style="color:#60a5fa;">CORE</span></span>
              <div style="margin-top:6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Nueva consulta desde la web</div>
            </td>
          </tr>
          <!-- Hairline térmico de marca (electric → dorado) -->
          <tr>
            <td style="height:3px;background:#2563eb;background:linear-gradient(90deg,#2563eb,#60a5fa 45%,#e7c8a0);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Cuerpo: filas ordenadas (estructura v1 preferida por el owner)
               con los refuerzos de la v2 (chips, filete dorado, preheader) -->
          <tr>
            <td style="background:#ffffff;padding:14px 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row("Nombre", esc(lead.name))}
                ${row(
                  "Email",
                  `<a href="mailto:${esc(lead.email)}" style="color:#2563eb;text-decoration:none;">${esc(lead.email)}</a>`,
                )}
                ${row("Empresa", lead.company ? esc(lead.company) : "—")}
                ${row("Tipo de proyecto", projectTypeChips(lead))}
                ${row(
                  "Mensaje",
                  `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #e7c8a0;border-radius:8px;padding:14px 16px;">${mensaje}</div>`,
                )}
                ${row("Recibido", `${esc(fecha)} hs`)}
              </table>
              <!-- CTAs: responder (primario) + panel (secundario) -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;">
                    <a href="mailto:${esc(lead.email)}?subject=${encodeURIComponent(`Re: tu consulta a SYNTRA CORE`)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Responder a ${esc(lead.name.split(" ")[0])}</a>
                  </td>
                  <td style="padding-left:12px;">
                    <a href="${panelUrl}" style="display:inline-block;padding:11px 18px;font-size:14px;font-weight:bold;color:#2563eb;text-decoration:none;border:1px solid #bfdbfe;border-radius:8px;">Abrir en el panel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;padding:14px 28px;font-size:12px;color:#94a3b8;">
              También podés responder este mail directamente (reply-to configurado al lead).
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function notifyNewLead(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO;

  if (!apiKey || !to) {
    // En producción, no tener el transporte configurado es una misconfiguración
    // real → failed. Fuera de prod, NO marcar failed (falso positivo): queda
    // 'pending'. Se reusa el código 'missing_webhook_url' del enum existente
    // (semántica: "falta config de notificación") para no migrar la DB.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[notify] RESEND_API_KEY / LEAD_NOTIFY_TO no configurados en producción — lead no notificado.",
      );
      await updateLeadNotification(lead.id, {
        status: "failed",
        attempts: 0,
        errorCode: "missing_webhook_url",
      });
    } else {
      console.warn(
        "[notify] Resend no configurado (no-prod) — sin notificación, lead queda pending.",
      );
    }
    return;
  }

  const empresa = lead.company ? ` (${lead.company})` : "";
  const body = JSON.stringify({
    from: process.env.LEAD_EMAIL_FROM ?? DEFAULT_FROM,
    to: [to],
    reply_to: lead.email,
    subject: `Nueva consulta — ${lead.name}${empresa}`,
    html: buildEmailHtml(lead),
  });

  let lastErrorCode: NotificationErrorCode = "unexpected_error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          // Idempotencia (soportada por Resend): reintentos no duplican el mail.
          "idempotency-key": `lead/${lead.id}`,
        },
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
      console.error(`[notify] intento ${attempt}: Resend respondió ${res.status}.`);
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
