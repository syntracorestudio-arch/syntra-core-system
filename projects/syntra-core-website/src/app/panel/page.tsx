import { Inbox } from "lucide-react";

import {
  LEAD_STATUSES,
  NOTIFICATION_STATUSES,
  type LeadStatus,
  type NotificationStatus,
} from "@/lib/validations/lead";
import { getLeadCounts, listLeads } from "@/services/lead-service";
import { Container } from "@/components/layout/container";
import { PanelHeader } from "@/components/panel/panel-header";
import { StatsBar } from "@/components/panel/stats-bar";
import { PanelToolbar } from "@/components/panel/panel-toolbar";
import { LeadsTable } from "@/components/panel/leads-table";
import { LeadCard } from "@/components/panel/lead-card";

// Lee searchParams + DB → siempre dinámico (interno, no afecta el landing).
export const dynamic = "force-dynamic";

interface PanelPageProps {
  searchParams: Promise<{ status?: string; notif?: string; sort?: string }>;
}

function parseStatus(value: string | undefined): LeadStatus | undefined {
  return (LEAD_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as LeadStatus)
    : undefined;
}

function parseNotification(
  value: string | undefined,
): NotificationStatus | undefined {
  return (NOTIFICATION_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as NotificationStatus)
    : undefined;
}

export default async function PanelPage({ searchParams }: PanelPageProps) {
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const notification = parseNotification(sp.notif);
  const sort = sp.sort === "oldest" ? "oldest" : "recent";

  const [listRes, countsRes] = await Promise.all([
    listLeads({ status, notification, sort }),
    getLeadCounts(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-8">
      <PanelHeader />

      {countsRes.ok ? (
        <StatsBar counts={countsRes.counts} total={countsRes.total} />
      ) : null}

      <div className="flex flex-col gap-5">
        <PanelToolbar
          currentStatus={status}
          currentNotification={notification}
          currentSort={sort}
        />

        {!listRes.ok ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {listRes.error}
          </p>
        ) : listRes.leads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="font-medium">No hay leads para mostrar</p>
            <p className="text-sm text-muted-foreground">
              {status
                ? "Probá con otro filtro de estado."
                : "Cuando lleguen leads del formulario, aparecerán acá."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <LeadsTable leads={listRes.leads} />
            </div>
            {/* Mobile */}
            <div className="flex flex-col gap-3 md:hidden">
              {listRes.leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
