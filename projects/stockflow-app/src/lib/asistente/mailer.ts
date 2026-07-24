/**
 * mailer.ts — envío del reporte por Resend. ÚNICO archivo que importa `resend`,
 * server-only (la API key nunca toca el browser).
 */

import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Destinatario efectivo. En DEV, RESEND_DEV_TO redirige TODOS los reportes a tu
 * casilla (el remitente compartido de Resend rechaza los emails de prueba). En
 * prod se deja vacío → va al email real del dueño.
 */
export function destinatario(ownerEmail: string | null): string | null {
  return process.env.RESEND_DEV_TO || ownerEmail || null;
}

export async function enviarReporte(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = getClient();
  if (!c) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const from = process.env.RESEND_FROM || "StockFlow <onboarding@resend.dev>";

  try {
    const { data, error } = await c.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) return { ok: false, error: `${error.name ?? "resend"}: ${error.message ?? "error"}` };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
