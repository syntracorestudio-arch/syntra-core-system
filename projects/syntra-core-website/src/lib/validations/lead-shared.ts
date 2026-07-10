/**
 * SYNTRA CORE — Constantes y tipos del dominio lead SIN dependencia de zod.
 *
 * Existe por performance: `contact-form.tsx` (cliente, Home) necesita
 * HONEYPOT_FIELD, y si lo importa de `lead.ts` arrastra zod entero (~64KiB gz)
 * al critical path de la Home. Los componentes de CLIENTE importan de acá;
 * los schemas de `lead.ts` (servidor/panel) construyen sobre estas constantes.
 */

/**
 * Tipo de proyecto (WEB-013B) — calificación opcional del lead. Keys estables
 * para DB/panel/payload; los labels en español viven en `config/site.ts`.
 */
export const PROJECT_TYPES = ["web", "automation", "ai", "panel", "unsure"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Nombre del campo honeypot anti-spam (debe llegar vacío). */
export const HONEYPOT_FIELD = "website";

/** Pipeline de estados de un lead (orden lógico). */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Eje de notificación (TASK-020) — SEPARADO del status comercial.
 * - pending: lead creado, notificación a n8n aún no confirmada.
 * - sent: n8n respondió OK tras el flujo de email.
 * - failed: se agotaron los intentos hacia n8n o faltó la config en prod.
 * - unknown: leads legacy creados antes de la migración 0002.
 */
export const NOTIFICATION_STATUSES = [
  "pending",
  "sent",
  "failed",
  "unknown",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Códigos de error controlados (nunca texto libre, PII ni secretos). */
export const NOTIFICATION_ERROR_CODES = [
  "timeout",
  "network_error",
  "http_error",
  "unexpected_error",
  "missing_webhook_url",
] as const;
export type NotificationErrorCode = (typeof NOTIFICATION_ERROR_CODES)[number];
