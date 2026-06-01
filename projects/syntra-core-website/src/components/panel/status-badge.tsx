import type { LeadStatus } from "@/lib/validations/lead";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, STATUS_LABELS } from "@/components/panel/status-meta";

/** Badge de status (Server Component). Reutiliza el Badge del design system. */
function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className={STATUS_BADGE[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export { StatusBadge };
