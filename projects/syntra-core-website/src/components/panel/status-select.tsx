"use client";

import { updateLeadStatusAction } from "@/app/actions/update-lead-status";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations/lead";
import { STATUS_LABELS } from "@/components/panel/status-meta";

/**
 * StatusSelect — única isla client del panel.
 * <select> nativo que auto-envía un form al cambiar (sin estado client).
 * La mutación ocurre 100% server-side vía updateLeadStatusAction.
 */
function StatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  return (
    <form action={updateLeadStatusAction}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        aria-label="Cambiar estado del lead"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-9 rounded-lg border border-input bg-secondary/40 px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-brand-electric focus-visible:ring-2 focus-visible:ring-brand-electric/30"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-background text-foreground">
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}

export { StatusSelect };
