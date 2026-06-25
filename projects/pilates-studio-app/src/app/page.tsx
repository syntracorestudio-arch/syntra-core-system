import { CalendarCheck, CreditCard, Sparkles } from "lucide-react";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {siteConfig.phase}
        </span>

        <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {siteConfig.tagline}
        </p>

        <div className="mt-10 grid gap-3 text-left">
          <FeatureRow
            icon={<CalendarCheck className="size-5 text-primary" aria-hidden />}
            title="Reservas con cupo en vivo"
            note="Próximamente"
          />
          <FeatureRow
            icon={<CreditCard className="size-5 text-primary" aria-hidden />}
            title="Packs, créditos y cobranza"
            note="Próximamente"
          />
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Provisto y mantenido por SYNTRA · white-label para tu estudio
        </p>
      </div>
    </main>
  );
}

function FeatureRow({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-md bg-accent">
        {icon}
      </span>
      <span className="flex-1 font-medium text-foreground">{title}</span>
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
        {note}
      </span>
    </div>
  );
}
