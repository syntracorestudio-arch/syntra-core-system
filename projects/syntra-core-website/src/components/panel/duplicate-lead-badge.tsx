import { Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Señal NO bloqueante de posible duplicado (TASK-022). Discreta e informativa,
 * no alarmista. Se muestra cuando un email aparece en más de un lead.
 * No oculta, no fusiona, no borra, no afecta status comercial ni notificación.
 */
function DuplicateLeadBadge() {
  return (
    <Badge
      variant="outline"
      title="Este email aparece en más de un lead."
      className="border-border bg-secondary/40 text-muted-foreground"
    >
      <Copy className="size-3" aria-hidden="true" />
      Posible duplicado
    </Badge>
  );
}

export { DuplicateLeadBadge };
