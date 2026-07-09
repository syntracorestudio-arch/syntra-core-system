import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket, ChevronRight, Wallet, CalendarClock } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm, type SettingsInitial } from "@/components/admin/settings-form";
import { LogoUploader } from "@/components/admin/logo-uploader";
import { MpConnect } from "@/components/admin/mp-connect";

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
    .eq("profile_id", user.id)
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

  // Estado de la conexión de cobro (solo campos NO-secretos; el token nunca sale del server).
  const admin = createAdminClient();
  const { data: mp } = await admin
    .from("studio_payment_providers")
    .select("status, mp_nickname, webhook_secret")
    .eq("studio_id", member.studio_id)
    .maybeSingle();
  const mpConnected = mp?.status === "connected";
  const mpNickname = (mp?.mp_nickname as string | null) ?? null;
  const mpHasSecret = Boolean(mp?.webhook_secret); // solo presencia, nunca el valor
  const webhookBase = process.env.MP_WEBHOOK_URL ?? null;
  const mpWebhookUrl = webhookBase ? `${webhookBase}?studio=${member.studio_id}` : null;

  const b =
    studio?.branding && typeof studio.branding === "object" ? (studio.branding as Record<string, unknown>) : {};
  const bstr = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  const accent = bstr("accent") || DEFAULT_ACCENT;

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
    subtitle: bstr("subtitle"),
    whatsapp: bstr("whatsapp"),
    address: bstr("address"),
    instagram: bstr("instagram"),
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Configuración" subtitle={studio?.name ?? "Tu estudio"} />

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

      <div className="mt-4">
        <LogoUploader logoUrl={bstr("logo_url") || null} />
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

      <Link
        href="/admin/planes"
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-base hover:-translate-y-px hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Abonos y membresías</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Membresías, abonos y clases sueltas con su precio.</p>
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>

      {/* Cobro online — MercadoPago (cuenta propia del estudio) */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Cobro online (MercadoPago)</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Conectá tu cuenta para cobrar packs y abonos online. El dinero entra directo a tu MercadoPago.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <MpConnect
            connected={mpConnected}
            nickname={mpNickname}
            hasSecret={mpHasSecret}
            webhookUrl={mpWebhookUrl}
          />
        </div>
      </section>
    </main>
  );
}
