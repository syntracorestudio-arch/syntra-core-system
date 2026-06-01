import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Lead } from "@/types";
import { formatDateTime } from "@/lib/format";
import { StatusSelect } from "@/components/panel/status-select";

/** Tabla de leads (desktop). Server Component, <table> nativa (sin librerías). */
function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Origen</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/30"
            >
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {lead.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lead.email}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {lead.company ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusSelect id={lead.id} status={lead.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">{lead.source}</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {formatDateTime(lead.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/panel/${lead.id}`}
                  className="inline-flex items-center gap-1 text-sm text-brand-cyan transition-opacity hover:opacity-80"
                  aria-label={`Ver detalle de ${lead.name}`}
                >
                  Ver <ArrowUpRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { LeadsTable };
