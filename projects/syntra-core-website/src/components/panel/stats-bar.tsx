import Link from "next/link";

import type { LeadStatus } from "@/lib/validations/lead";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { Card } from "@/components/ui/card";
import { STATUS_LABELS } from "@/components/panel/status-meta";

interface StatsBarProps {
  counts: Record<LeadStatus, number>;
  total: number;
}

/** StatsBar — contadores por status (Server Component). Cada uno filtra al click. */
function StatsBar({ counts, total }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Link href="/panel">
        <Card className="gap-1 p-4 transition-colors hover:border-brand-cyan/30">
          <span className="text-2xl font-bold tracking-tight">{total}</span>
          <span className="text-xs text-muted-foreground">Todos</span>
        </Card>
      </Link>
      {LEAD_STATUSES.map((s) => (
        <Link key={s} href={`/panel?status=${s}`}>
          <Card className="gap-1 p-4 transition-colors hover:border-brand-cyan/30">
            <span className="text-2xl font-bold tracking-tight">
              {counts[s]}
            </span>
            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[s]}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export { StatsBar };
