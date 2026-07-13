/**
 * Estado del formulario de leads (compartido cliente/servidor).
 *
 * Vive FUERA del archivo "use server": un módulo "use server" solo puede
 * exportar funciones async, nunca objetos o constantes.
 */
/** Valores tipeados, tal como llegaron (sin validar). */
export interface LeadFormValues {
  name: string;
  email: string;
  company: string;
  message: string;
  projectTypes: string[];
}

export interface LeadFormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Errores por campo (primer mensaje de cada uno) */
  errors?: Partial<
    Record<"name" | "email" | "company" | "projectTypes" | "message", string>
  >;
  /**
   * Eco de los valores enviados cuando status === "error": React 19 resetea el
   * form al volver la action, y sin esto el usuario pierde TODO lo tipeado ante
   * un error de validación o rate-limit (los campos los usan como defaultValue).
   */
  values?: LeadFormValues;
}

export const initialLeadState: LeadFormState = { status: "idle" };
