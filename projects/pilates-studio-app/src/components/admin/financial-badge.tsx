/** Estado financiero del alumno (derivado de member_financial_status): color + texto. */
export type FinancialStatus = "al_dia" | "pack_sin_saldo" | "membresia_vencida" | "debe_pago";

const MAP: Record<FinancialStatus, { text: string; tint: string; dot: string }> = {
  al_dia: { text: "Al día", tint: "bg-success/10", dot: "bg-success" },
  pack_sin_saldo: { text: "Sin saldo", tint: "bg-warning/10", dot: "bg-warning" },
  membresia_vencida: { text: "Membresía vencida", tint: "bg-warning/10", dot: "bg-warning" },
  debe_pago: { text: "Debe", tint: "bg-destructive/10", dot: "bg-destructive" },
};

export function FinancialBadge({ status }: { status: FinancialStatus }) {
  const b = MAP[status] ?? MAP.debe_pago;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground ${b.tint}`}
    >
      <span className={`size-1.5 rounded-full ${b.dot}`} aria-hidden />
      {b.text}
    </span>
  );
}
