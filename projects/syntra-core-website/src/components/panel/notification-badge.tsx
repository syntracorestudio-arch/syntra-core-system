import type { NotificationStatus } from "@/lib/validations/lead";
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_BADGE,
  NOTIFICATION_LABELS,
} from "@/components/panel/status-meta";

/**
 * Badge del eje de notificación (TASK-020). Server Component, read-only.
 * Deliberadamente separado de StatusBadge (status comercial): son dos ejes
 * distintos y no deben mezclarse visualmente.
 */
function NotificationBadge({ status }: { status: NotificationStatus }) {
  return (
    <Badge variant="outline" className={NOTIFICATION_BADGE[status]}>
      {NOTIFICATION_LABELS[status]}
    </Badge>
  );
}

export { NotificationBadge };
