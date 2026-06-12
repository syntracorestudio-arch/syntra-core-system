/**
 * ServiceDemoWeb — wireframe estático "render completo" de una web lista.
 * Server Component, sin estado ni animación (los loops/motion son WEB-009B).
 * Bloques skeleton neutros + un único detalle de acento que sugiere "listo".
 * Decorativo: aria-hidden. Solo tokens existentes del sistema.
 */
function ServiceDemoWeb() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        {/* Barra superior (nav) */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <span className="size-2.5 rounded-full bg-brand-cyan/70" />
          <span className="h-2 w-16 rounded-full bg-border-strong" />
          <div className="ml-auto flex items-center gap-2">
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-8 rounded-full bg-border-strong" />
            <span className="h-2 w-12 rounded-full bg-brand-electric/30" />
          </div>
        </div>

        {/* Bloque hero */}
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-col gap-2.5">
            <span className="h-3 w-3/5 rounded-full bg-border-strong" />
            <span className="h-2 w-4/5 rounded-full bg-border-strong/70" />
            <span className="h-2 w-2/5 rounded-full bg-border-strong/70" />
            <span className="mt-1 h-6 w-24 rounded-md border border-brand-electric/30 bg-brand-electric/10" />
          </div>
        </div>

        {/* Grilla de contenido */}
        <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>
    </div>
  );
}

export { ServiceDemoWeb };
