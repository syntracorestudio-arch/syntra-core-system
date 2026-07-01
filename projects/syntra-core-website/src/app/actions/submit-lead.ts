"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { HONEYPOT_FIELD, leadSchema } from "@/lib/validations/lead";
import { rateLimit } from "@/lib/rate-limit";
import { createLead } from "@/services/lead-service";
import { notifyNewLead } from "@/services/lead-notifications";
import type { LeadFormState } from "@/app/actions/lead-form-state";

/** Obtiene la IP del cliente desde los headers de proxy (Vercel/Cloudflare). */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/**
 * Server Action de envío de lead — firma compatible con useActionState.
 * Valida en el servidor (nunca confiar solo en el frontend) y persiste vía
 * el lead service. Incluye honeypot anti-spam.
 */
export async function submitLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  // Honeypot: si viene relleno, es un bot. Fingimos éxito sin persistir.
  if (formData.get(HONEYPOT_FIELD)) {
    return { status: "success", message: "¡Gracias! Te contactaremos pronto." };
  }

  // Rate limiting por IP (anti-abuso). 5 envíos cada 10 minutos.
  const ip = await getClientIp();
  const rl = rateLimit(`lead:${ip}`);
  if (!rl.ok) {
    return {
      status: "error",
      message: `Demasiados intentos. Probá de nuevo en ${rl.retryAfterSec} segundos.`,
    };
  }

  // Checkboxes MULTI (0005): el form envía 0..N valores con name="projectType".
  // Leemos todos, normalizamos a string y descartamos vacíos. Ausente = undefined.
  const projectTypes = formData
    .getAll("projectType")
    .map(String)
    .filter(Boolean);

  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    projectTypes: projectTypes.length ? projectTypes : undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const errors: LeadFormState["errors"] = {};
    for (const key of [
      "name",
      "email",
      "company",
      "projectTypes",
      "message",
    ] as const) {
      const msg = fieldErrors[key]?.[0];
      if (msg) errors[key] = msg;
    }
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      errors,
    };
  }

  const result = await createLead(parsed.data, { source: "website-home" });

  if (!result.ok) {
    return {
      status: "error",
      message: `${result.error} Probá de nuevo o escribinos por email.`,
    };
  }

  // Notificación NO bloqueante: corre después de responder al usuario.
  // Si falla, el lead ya está persistido en Supabase (fuente de verdad).
  if (result.lead) {
    const lead = result.lead;
    after(() => notifyNewLead(lead));
  }

  return {
    status: "success",
    message: "¡Gracias! Recibimos tu mensaje y te contactaremos pronto.",
  };
}
