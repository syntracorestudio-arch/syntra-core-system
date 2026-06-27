/**
 * Estado del formulario de leads (compartido cliente/servidor).
 *
 * Vive FUERA del archivo "use server": un módulo "use server" solo puede
 * exportar funciones async, nunca objetos o constantes.
 */
export interface LeadFormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Errores por campo (primer mensaje de cada uno) */
  errors?: Partial<
    Record<"name" | "email" | "company" | "projectTypes" | "message", string>
  >;
}

export const initialLeadState: LeadFormState = { status: "idle" };
