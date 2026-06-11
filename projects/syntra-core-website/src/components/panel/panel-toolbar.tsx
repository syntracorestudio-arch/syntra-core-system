import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type NotificationStatus,
} from "@/lib/validations/lead";
import {
  STATUS_LABELS,
  NOTIFICATION_LABELS,
} from "@/components/panel/status-meta";

type SortOrder = "recent" | "oldest";

interface PanelToolbarProps {
  currentStatus?: LeadStatus;
  currentNotification?: NotificationStatus;
  currentSort: SortOrder;
}

interface HrefParams {
  status?: LeadStatus;
  notification?: NotificationStatus;
  sort: SortOrder;
}

function buildHref({ status, notification, sort }: HrefParams): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (notification) params.set("notif", notification);
  if (sort === "oldest") params.set("sort", "oldest");
  const qs = params.toString();
  return qs ? `/panel?${qs}` : "/panel";
}

const tabBase =
  "rounded-lg px-3 py-1.5 text-sm transition-colors whitespace-nowrap";

/** Filtros de notificación (TASK-020) — eje separado del status comercial. */
const NOTIFICATION_FILTERS: { value?: NotificationStatus; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "pending", label: NOTIFICATION_LABELS.pending },
  { value: "failed", label: NOTIFICATION_LABELS.failed },
  { value: "unknown", label: NOTIFICATION_LABELS.unknown },
];

/** Filtros por status + notificación + orden. Server Component (links, sin JS). */
function PanelToolbar({
  currentStatus,
  currentNotification,
  currentSort,
}: PanelToolbarProps) {
  const nextSort: SortOrder = currentSort === "recent" ? "oldest" : "recent";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Eje comercial */}
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
          <Link
            href={buildHref({
              notification: currentNotification,
              sort: currentSort,
            })}
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
              href={buildHref({
                status: s,
                notification: currentNotification,
                sort: currentSort,
              })}
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
          href={buildHref({
            status: currentStatus,
            notification: currentNotification,
            sort: nextSort,
          })}
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

      {/* Eje de notificación (TASK-020), separado del comercial */}
      <nav
        className="flex flex-wrap items-center gap-1.5"
        aria-label="Filtrar por notificación"
      >
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          Notificación
        </span>
        {NOTIFICATION_FILTERS.map((f) => {
          const active = currentNotification === f.value;
          return (
            <Link
              key={f.label}
              href={buildHref({
                status: currentStatus,
                notification: f.value,
                sort: currentSort,
              })}
              className={cn(
                tabBase,
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export { PanelToolbar };
