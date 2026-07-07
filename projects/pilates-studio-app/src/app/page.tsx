import Link from "next/link";
import {
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Reservas y cobranza · white-label
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
            note="Tus alumnos reservan solos, sin sobrecupo."
          />
          <FeatureRow
            icon={<CreditCard className="size-5 text-primary" aria-hidden />}
            title="Packs, créditos y cobranza"
            note="Saldos, deuda y pagos, siempre al día."
          />
          <FeatureRow
            icon={<LayoutDashboard className="size-5 text-primary" aria-hidden />}
            title="Panel del estudio"
            note="Agenda, alumnos y métricas en un solo lugar."
          />
        </div>

        <Link
          href="/login"
          className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          Ingresar
          <ArrowRight className="size-4" aria-hidden />
        </Link>

        <p className="mt-8 text-xs text-muted-foreground">
          Provisto y mantenido por SYNTRA · con la marca de tu estudio
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
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </span>
    </div>
  );
}
