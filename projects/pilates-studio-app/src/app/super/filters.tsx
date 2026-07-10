"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

/** Filtros del panel superadmin: período (mes/histórico) + estudio. Navegan por GET. */
export function SuperFilters({
  period,
  periodOptions,
  studio,
  studioOptions,
}: {
  period: string;
  periodOptions: Option[];
  studio: string;
  studioOptions: Option[];
}) {
  const router = useRouter();
  const go = (p: string, s: string) => {
    const qs = new URLSearchParams();
    if (p) qs.set("p", p);
    if (s && s !== "todos") qs.set("studio", s);
    router.push(`/super${qs.size > 0 ? `?${qs.toString()}` : ""}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select label="Estudio" value={studio} options={studioOptions} onChange={(v) => go(period, v)} />
      <Select label="Período" value={period} options={periodOptions} onChange={(v) => go(v, studio)} />
    </div>
  );
}
