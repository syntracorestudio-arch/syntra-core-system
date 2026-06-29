import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Ticket, ChevronRight } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { SettingsForm, type SettingsInitial } from "@/components/admin/settings-form";

export const metadata = { title: "Configuración — Panel" };
export const dynamic = "force-dynamic";

const DEFAULT_ACCENT = "#C8775A";

type StudioRel = { name: string; timezone: string | null; branding: Record<string, unknown> | null };

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("role, studio_id, studios(name, timezone, branding)")
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/app");
  if (member.role !== "admin") redirect("/admin"); // reception no edita configuración

  const studioRel = (member.studios ?? null) as StudioRel | StudioRel[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;

  const { data: settings } = await supabase
    .from("studio_settings")
    .select(
      "cancellation_window_hours, reservation_policy, grace_n, refund_on_late_cancel, default_capacity, waitlist_enabled, expiry_warning_days",
    )
    .eq("studio_id", member.studio_id)
    .maybeSingle();

  const accent =
    (studio?.branding && typeof studio.branding === "object" && "accent" in studio.branding
      ? String((studio.branding as Record<string, unknown>).accent)
      : "") || DEFAULT_ACCENT;

  const initial: SettingsInitial = {
    name: studio?.name ?? "",
    accent,
    timezone: studio?.timezone ?? "America/Argentina/Buenos_Aires",
    cancellationWindowHours: settings?.cancellation_window_hours ?? 24,
    reservationPolicy: settings?.reservation_policy ?? "require_credit_or_membership",
    graceN: settings?.grace_n ?? 0,
    refundOnLateCancel: settings?.refund_on_late_cancel ?? false,
    defaultCapacity: settings?.default_capacity ?? 8,
    waitlistEnabled: settings?.waitlist_enabled ?? true,
    expiryWarningDays: settings?.expiry_warning_days ?? 7,
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-5 pb-16 pt-8 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{studio?.name ?? "Tu estudio"}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
        </div>
        <a
          href="/logout"
          aria-label="Cerrar sesión"
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="size-3.5" aria-hidden />
          Salir
        </a>
      </header>

      <AdminTabs active="configuracion" />

      {notice ? (
        <p className="mt-5 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <SettingsForm initial={initial} />
      </div>

      <Link
        href="/admin/packs"
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-base hover:-translate-y-px hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Ticket className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Packs y precios</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Definí los packs que vendés y sus precios.</p>
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>
    </main>
  );
}
