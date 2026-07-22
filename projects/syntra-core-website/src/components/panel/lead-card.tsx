import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Lead } from "@/types";
import { formatDateTime } from "@/lib/format";
import { projectTypeLabel } from "@/config/site";
import { Card } from "@/components/ui/card";
import { StatusSelect } from "@/components/panel/status-select";
import { NotificationBadge } from "@/components/panel/notification-badge";
import { DuplicateLeadBadge } from "@/components/panel/duplicate-lead-badge";

/** Card de lead (mobile). Server Component. */
function LeadCard({
  lead,
  isPossibleDuplicate = false,
}: {
  lead: Lead;
  isPossibleDuplicate?: boolean;
}) {
  return (
    <Card className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-medium text-foreground">{lead.name}</span>
          <span className="text-xs break-all text-muted-foreground">
            {lead.email}
          </span>
          {isPossibleDuplicate ? <DuplicateLeadBadge /> : null}
        </div>
        <Link
          href={`/panel/${lead.id}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-cyan"
          aria-label={`Ver detalle de ${lead.name}`}
        >
          Ver <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Empresa</dt>
          <dd className="text-right">{lead.company ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="text-right">{projectTypeLabel(lead.project_types)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Origen</dt>
          <dd className="text-right">{lead.source}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="text-right">{formatDateTime(lead.created_at)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Notificación</dt>
          <dd className="text-right">
            <NotificationBadge status={lead.notification_status} />
          </dd>
        </div>
      </dl>

      <StatusSelect id={lead.id} status={lead.status} />
    </Card>
  );
}

export { LeadCard };
