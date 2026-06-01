import { ArrowDown, ArrowRight } from "lucide-react";

/**
 * TransformConnector — conector decorativo "antes → después".
 * Desktop: horizontal. Mobile: vertical (apunta hacia abajo). aria-hidden.
 * CSS puro, sin interacción.
 */
function TransformConnector() {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
    >
      {/* Mobile: flecha vertical */}
      <div className="flex flex-col items-center md:hidden">
        <span className="h-6 w-px bg-gradient-to-b from-transparent to-brand-electric/40" />
        <ArrowDown className="size-4 text-brand-electric/70" />
      </div>
      {/* Desktop: flecha horizontal */}
      <div className="hidden items-center md:flex">
        <span className="h-px w-8 bg-gradient-to-r from-border to-brand-electric/40" />
        <ArrowRight className="size-4 text-brand-electric/70" />
      </div>
    </div>
  );
}

export { TransformConnector };
