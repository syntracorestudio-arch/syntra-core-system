import { z } from "zod";

/**
 * SYNTRA CORE — Schema de validación de leads.
 * Fuente única de verdad para cliente Y servidor (nunca confiar solo en el frontend).
 */
export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre")
    .max(80, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "Ingresá tu email")
    .email("Ingresá un email válido")
    .max(120, "El email es demasiado largo"),
  company: z
    .string()
    .trim()
    .max(120, "El nombre de empresa es demasiado largo")
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "Contanos un poco más (mínimo 10 caracteres)")
    .max(2000, "El mensaje es demasiado largo"),
});

export type LeadInput = z.infer<typeof leadSchema>;

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

export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** Validación de la mutación de status (Server Action del panel). */
export const updateLeadStatusSchema = z.object({
  id: z.uuid("ID de lead inválido"),
  status: leadStatusSchema,
});
