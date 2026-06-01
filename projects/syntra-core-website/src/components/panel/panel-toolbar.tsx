import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

import { cn } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/components/panel/status-meta";

type SortOrder = "recent" | "oldest";

interface PanelToolbarProps {
  currentStatus?: LeadStatus;
  currentSort: SortOrder;
}

function buildHref(status: LeadStatus | undefined, sort: SortOrder): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (sort === "oldest") params.set("sort", "oldest");
  const qs = params.toString();
  return qs ? `/panel?${qs}` : "/panel";
}

const tabBase =
  "rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap";

/** Filtros por status + toggle de orden. Server Component (links, sin JS). */
function PanelToolbar({ currentStatus, currentSort }: PanelToolbarProps) {
  const nextSort: SortOrder = currentSort === "recent" ? "oldest" : "recent";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
        <Link
          href={buildHref(undefined, currentSort)}
          className={cn(
            tabBase,
            !currentStatus
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          Todos
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref(s, currentSort)}
            className={cn(
              tabBase,
              currentStatus === s
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      <Link
        href={buildHref(currentStatus, nextSort)}
        className={cn(
          tabBase,
          "inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {currentSort === "recent" ? (
          <ArrowDownWideNarrow className="size-4" />
        ) : (
          <ArrowUpWideNarrow className="size-4" />
        )}
        {currentSort === "recent" ? "Más recientes" : "Más antiguos"}
      </Link>
    </div>
  );
}

export { PanelToolbar };
