"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

/** Selector de período (mes específico o histórico). Navega al cambiar. */
export function PeriodSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Período</span>
      <select
        value={value}
        onChange={(e) => router.push(`/admin/reportes?p=${e.target.value}`)}
        className="appearance-none rounded-lg border border-input bg-card py-2 pl-3 pr-9 text-sm font-medium text-foreground outline-none transition-colors hover:bg-secondary focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" aria-hidden />
    </label>
  );
}
