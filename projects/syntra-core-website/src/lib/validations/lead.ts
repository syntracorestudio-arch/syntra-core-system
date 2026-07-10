import { z } from "zod";

import {
  HONEYPOT_FIELD,
  LEAD_STATUSES,
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_STATUSES,
  PROJECT_TYPES,
} from "@/lib/validations/lead-shared";
import type {
  LeadStatus,
  NotificationErrorCode,
  NotificationStatus,
  ProjectType,
} from "@/lib/validations/lead-shared";

/**
 * SYNTRA CORE — Schema de validación de leads.
 * Fuente única de verdad para cliente Y servidor (nunca confiar solo en el frontend).
 *
 * Las constantes/tipos SIN zod viven en `lead-shared.ts` (los componentes de
 * cliente importan de allí para no arrastrar zod al bundle de la Home); acá se
 * re-exportan para que el resto del código siga teniendo una sola puerta.
 */
export {
  HONEYPOT_FIELD,
  LEAD_STATUSES,
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_STATUSES,
  PROJECT_TYPES,
};
export type { LeadStatus, NotificationErrorCode, NotificationStatus, ProjectType };

export const projectTypeSchema: z.ZodType<ProjectType> = z.enum(PROJECT_TYPES);

export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre")
    .max(80, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    // Normalización (TASK-022): el email se canoniza a minúsculas en la fuente
    // única de validación → fluye así a Supabase, panel y payload n8n.
    .toLowerCase()
    .min(1, "Ingresá tu email")
    .email("Ingresá un email válido")
    .max(120, "El email es demasiado largo"),
  company: z
    .string()
    .trim()
    .max(120, "El nombre de empresa es demasiado largo")
    .optional(),
  // Calificación opcional MULTI (0005): ausente = válido; el lead puede marcar
  // varios tipos. Solo valores controlados. Se deduplica para no persistir
  // repetidos (el front podría mandar el mismo value dos veces).
  projectTypes: z
    .array(projectTypeSchema)
    .transform((values) => Array.from(new Set(values)))
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "Contanos un poco más (mínimo 10 caracteres)")
    .max(2000, "El mensaje es demasiado largo"),
});

export type LeadInput = z.infer<typeof leadSchema>;

export const leadStatusSchema: z.ZodType<LeadStatus> = z.enum(LEAD_STATUSES);

export const notificationStatusSchema: z.ZodType<NotificationStatus> =
  z.enum(NOTIFICATION_STATUSES);

/** Validación de la mutación de status (Server Action del panel). */
export const updateLeadStatusSchema = z.object({
  id: z.uuid("ID de lead inválido"),
  status: leadStatusSchema,
});
