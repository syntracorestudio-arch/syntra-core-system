import { Stagger, StaggerItem } from "@/components/animations/stagger";

/**
 * ServiceDemoWeb — wireframe "render completo" de una web lista.
 * WEB-009B: ensamble one-shot al entrar en viewport (sin loop). Los bloques
 * (nav, hero, grilla) entran con opacity + y escalonados vía <Stagger>; el
 * chip/botón de acento entra ÚLTIMO como cue de "render completo".
 * Solo se anima opacity/transform (translateY) — herencia de staggerItem.
 * Reduced-motion: los wrappers colapsan al estado final (wireframe armado).
 * Decorativo: aria-hidden. Solo tokens existentes del sistema.
 */
function ServiceDemoWeb() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <Stagger className="flex flex-col gap-4">
        {/* Barra superior (nav) */}
        <StaggerItem className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <span className="size-2.5 rounded-full bg-brand-cyan/70" />
          <span className="h-2 w-16 rounded-full bg-border-strong" />
          <div className="ml-auto flex items-center gap-2">
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-12 rounded-full bg-brand-electric/30" />
          </div>
        </StaggerItem>

        {/* Bloque hero */}
        <StaggerItem className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-col gap-2.5">
            <span className="h-3 w-3/5 rounded-full bg-border-strong" />
            <span className="h-2 w-4/5 rounded-full bg-border-strong/70" />
            <span className="h-2 w-2/5 rounded-full bg-border-strong/70" />
            {/* Chip/botón de acento — entra ÚLTIMO (cue "render completo").
                Delay explícito para asegurar que aparezca tras nav+hero+grilla. */}
            <StaggerItem
              transition={{ delay: 0.5 }}
              className="mt-1 h-6 w-24 rounded-md border border-brand-electric/30 bg-brand-electric/10"
            />
          </div>
        </StaggerItem>

        {/* Grilla de contenido */}
        <StaggerItem className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <span className="size-6 rounded-md bg-border-strong" />
            <span className="h-2 w-3/4 rounded-full bg-border-strong" />
            <span className="h-2 w-1/2 rounded-full bg-border-strong/70" />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <span className="size-6 rounded-md bg-border-strong" />
            <span className="h-2 w-3/4 rounded-full bg-border-strong" />
            <span className="h-2 w-1/2 rounded-full bg-border-strong/70" />
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  );
}

export { ServiceDemoWeb };
