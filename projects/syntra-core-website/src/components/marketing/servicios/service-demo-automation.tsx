import { ArrowDown, ArrowRight, Check, Inbox, ListChecks } from "lucide-react";

/**
 * ServiceDemoAutomation — blueprint estático de 3 nodos conectados.
 * Server Component, sin estado ni animación (los loops/motion son WEB-009B).
 * Lenguaje del conector reusado del repo (gradiente from-border to-brand-electric/40).
 * El último nodo es el "resultado": acento sutil. Labels en lenguaje de cliente,
 * sin jerga técnica. Decorativo: aria-hidden.
 */
const nodes = [
  { icon: Inbox, label: "Entra", result: false },
  { icon: ListChecks, label: "Se ordena", result: false },
  { icon: Check, label: "Avisa", result: true },
] as const;

function ServiceDemoAutomation() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === nodes.length - 1;
          return (
            <div
              key={node.label}
              className="flex flex-col items-center gap-3 lg:flex-1 lg:flex-row lg:gap-0"
            >
              {/* Nodo */}
              <div className="flex flex-1 flex-col items-center gap-2 lg:flex-none">
                <span
                  className={
                    node.result
                      ? "relative flex size-12 items-center justify-center rounded-xl border border-brand-electric/30 bg-surface-2 text-accent-secondary"
                      : "flex size-12 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-muted-foreground"
                  }
                >
                  <Icon className="size-5" />
                  {node.result ? (
                    <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-brand-cyan" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{node.label}</span>
              </div>

              {/* Conector (no después del último nodo) */}
              {!isLast ? (
                <>
                  {/* Mobile: vertical */}
                  <div className="flex flex-col items-center lg:hidden">
                    <span className="h-5 w-px bg-gradient-to-b from-border to-brand-electric/40" />
                    <ArrowDown className="size-4 text-brand-electric/60" />
                  </div>
                  {/* Desktop: horizontal */}
                  <div className="hidden items-center lg:flex">
                    <span className="h-px w-6 bg-gradient-to-r from-border to-brand-electric/40 xl:w-10" />
                    <ArrowRight className="size-4 text-brand-electric/60" />
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ServiceDemoAutomation };
