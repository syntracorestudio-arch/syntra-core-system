import type { ReactNode } from "react";

/**
 * Hero de bienvenida con la foto del estudio — el mismo patrón aprobado del
 * dashboard del admin, extraído para los homes de alumno/instructor/recepción:
 * foto panorámica al 66% derecho fundida hacia el panel del texto (overlay cálido
 * → AA), anim-hero-settle y altura fija (CLS 0). Server-safe, sin assets nuevos.
 */
export function RoleHero({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** fila de chips/acciones bajo el texto (queda sobre el panel, nunca sobre la foto) */
  children?: ReactNode;
}) {
  return (
    <header className="relative flex min-h-44 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-3xl border border-border p-6 shadow-md sm:min-h-56">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-accent/60 via-card to-card" />
      {/* 66% = máximo ancho donde la camilla del primer plano entra completa */}
      <div className="absolute inset-y-0 right-0 w-[68%] overflow-hidden sm:w-[66%]" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-bg.jpg"
          alt=""
          className="anim-hero-settle absolute inset-0 size-full object-cover object-[62%_74%]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--card) 100%, transparent) 0%, transparent 34%)",
          }}
        />
      </div>
      <div className="relative max-w-[70%] sm:max-w-[55%]">
        {kicker ? <p className="text-sm text-muted-foreground">{kicker}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
