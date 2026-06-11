import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";

import { getLead, countLeadsByEmail } from "@/services/lead-service";
import { formatDateTime } from "@/lib/format";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/panel/status-badge";
import { StatusSelect } from "@/components/panel/status-select";
import { NotificationBadge } from "@/components/panel/notification-badge";
import { DuplicateLeadBadge } from "@/components/panel/duplicate-lead-badge";

export const dynamic = "force-dynamic";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const res = await getLead(id);

  if (!res.ok) {
    return (
      <Container className="py-8">
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {res.error}
        </p>
      </Container>
    );
  }

  if (!res.lead) {
    notFound();
  }

  const lead = res.lead;
  // TASK-022: ¿este email aparece en más de un lead? Señal no bloqueante.
  const isPossibleDuplicate = (await countLeadsByEmail(lead.email)) > 1;

  return (
    <Container className="flex flex-col gap-6 py-8">
      <Link
        href="/panel"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al panel
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {lead.name}
          </h1>
          <StatusBadge status={lead.status} />
          {isPossibleDuplicate ? <DuplicateLeadBadge /> : null}
        </div>
        <a
          href={`mailto:${lead.email}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-brand-cyan hover:underline"
        >
          <Mail className="size-4" /> {lead.email}
        </a>
      </div>

      <Card className="gap-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa" value={lead.company ?? "—"} />
          <Field label="Origen" value={lead.source} />
          <Field label="Recibido" value={formatDateTime(lead.created_at)} />
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Estado
            </dt>
            <dd>
              <StatusSelect id={lead.id} status={lead.status} />
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              Notificación
            </dt>
            <dd className="flex flex-wrap items-center gap-2">
              <NotificationBadge status={lead.notification_status} />
              {lead.notified_at ? (
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(lead.notified_at)}
                </span>
              ) : null}
              {lead.notification_status === "failed" ? (
                <span className="text-xs text-muted-foreground">
                  {lead.notification_attempts} intento(s)
                  {lead.last_notification_error_code
                    ? ` · ${lead.last_notification_error_code}`
                    : ""}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Mensaje
          </span>
          <p className="leading-relaxed whitespace-pre-wrap text-foreground">
            {lead.message}
          </p>
        </div>
      </Card>
    </Container>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
