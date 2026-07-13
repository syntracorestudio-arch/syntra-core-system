import { ChevronRight, GraduationCap, Headset } from "lucide-react";
import { FinancialBadge, type FinancialStatus } from "@/components/admin/financial-badge";

export type FinRow = {
  member_id: string;
  credits_available: number;
  has_active_membership: boolean;
  financial_status: FinancialStatus;
};

export type Person = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isStaff: boolean;
  fin: FinRow | undefined;
};

export function saldoText(f: FinRow | undefined) {
  if (!f) return "—";
  if (f.has_active_membership) return "Abono activo";
  if (f.credits_available > 0) return `${f.credits_available} ${f.credits_available === 1 ? "clase" : "clases"}`;
  return "Sin saldo";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

/** Fila densa de persona (alumno o staff) para listas del panel. */
export function PersonRow({ p }: { p: Person }) {
  return (
    <a
      href={`/admin/alumnos/${p.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary-ink">
        {initials(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
        {p.email ? <span className="block truncate text-xs text-muted-foreground">{p.email}</span> : null}
        {!p.isStaff ? (
          <span className="mt-0.5 block text-xs font-medium text-foreground sm:hidden">{saldoText(p.fin)}</span>
        ) : null}
      </span>
      {p.isStaff ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-ink">
          {p.role === "reception" ? (
            <Headset className="size-3.5" aria-hidden />
          ) : (
            <GraduationCap className="size-3.5" aria-hidden />
          )}
          {p.role === "reception" ? "Recepción" : "Instructor"}
        </span>
      ) : (
        <>
          <span className="hidden w-28 shrink-0 text-right text-sm font-medium tabular-nums text-foreground sm:block">
            {saldoText(p.fin)}
          </span>
          <span className="hidden w-36 shrink-0 justify-end sm:flex">
            {p.fin ? <FinancialBadge status={p.fin.financial_status} /> : null}
          </span>
        </>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}
