import { redirect } from "next/navigation";
import {
  Ticket,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Infinity as InfinityIcon,
  CalendarClock,
  Sparkles,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startCheckout } from "./actions";
import { BuyButton } from "./buy-button";
import { SuspendedScreen } from "@/components/suspended-screen";

export const metadata = { title: "Mi saldo" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}

type StudioRel = { name: string; status: string; timezone: string | null };
type Pass = { id: string; name: string; credits: number; validity_days: number; price: number };
type PlanConcept = "membership" | "abono" | "drop_in";
type Plan = { id: string; name: string; concept: PlanConcept; price: number; duration_days: number | null };

const PLAN_META: Record<PlanConcept, { label: string; icon: typeof InfinityIcon; detail: (d: number | null) => string }> =
  {
    membership: { label: "Membresía", icon: InfinityIcon, detail: (d) => `Acceso ilimitado · ${d ?? "—"} días` },
    abono: { label: "Abono", icon: CalendarClock, detail: (d) => `${d ?? "—"} días` },
    drop_in: { label: "Clase suelta", icon: Ticket, detail: () => "1 clase · vence en 30 días" },
  };

export default async function ComprarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("studio_id, studios(name, status, timezone)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/login");
  const studioRel = (member.studios ?? null) as StudioRel | StudioRel[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;

  // Estudio suspendido (Fase 5): no se vende nada.
  if (studio?.status === "suspended") {
    return <SuspendedScreen studioName={studio.name} audience="member" />;
  }

  // ── Saldo actual (tablas base, RLS del alumno — mismo criterio que /app) ──
  const tz = studio?.timezone || "America/Argentina/Buenos_Aires";
  const nowIso = new Date().toISOString();
  const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  // Saldo + catálogos en paralelo (los catálogos no dependen del saldo)
  const [{ data: myPasses }, { data: myMships }, { data: passesRaw }, { data: plansRaw }] = await Promise.all([
    supabase.from("member_passes").select("id, expires_at").gt("expires_at", nowIso),
    supabase.from("memberships").select("valid_to").eq("status", "active").gte("valid_to", todayDate),
    supabase.from("passes").select("id, name, credits, validity_days, price").eq("active", true).order("price", { ascending: true }),
    supabase
      .from("sale_products")
      .select("id, name, concept, price, duration_days")
      .eq("active", true)
      .order("price", { ascending: true }),
  ]);
  const validPasses = (myPasses ?? []) as { id: string; expires_at: string }[];
  let credits = 0;
  let nearestExpiry: string | null = null;
  if (validPasses.length > 0) {
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("delta, member_pass_id")
      .in("member_pass_id", validPasses.map((p) => p.id));
    const byPass = new Map<string, number>();
    for (const l of (ledger ?? []) as { delta: number; member_pass_id: string }[]) {
      byPass.set(l.member_pass_id, (byPass.get(l.member_pass_id) ?? 0) + l.delta);
      credits += l.delta;
    }
    nearestExpiry =
      validPasses
        .filter((p) => (byPass.get(p.id) ?? 0) > 0)
        .map((p) => p.expires_at)
        .sort()[0] ?? null;
  }
  const membershipUntil = ((myMships ?? []) as { valid_to: string }[]).map((m) => m.valid_to).sort().at(-1) ?? null;
  const fmtDay = (isoOrDate: string) =>
    new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "long" }).format(
      new Date(isoOrDate.length === 10 ? `${isoOrDate}T12:00:00Z` : isoOrDate),
    );

  const passes = (passesRaw ?? []) as Pass[];
  const plans = (plansRaw ?? []) as Plan[];

  // Estado de cobro online del estudio (campo no-secreto vía service-role).
  const admin = createAdminClient();
  const { data: mp } = await admin
    .from("studio_payment_providers")
    .select("status")
    .eq("studio_id", member.studio_id)
    .maybeSingle();
  const mpConnected = mp?.status === "connected";
  const hasCatalog = passes.length > 0 || plans.length > 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      {/* hero de saldo — la respuesta a "¿cuántas clases me quedan?" antes de vender */}
      <header className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-raised duration-500 animate-in fade-in slide-in-from-bottom-2 sm:p-6">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          Mi saldo · {studio?.name ?? "Tu estudio"}
        </p>
        <p className={`mt-2 text-3xl font-bold ${membershipUntil || credits > 0 ? "text-foreground" : "text-destructive"}`}>
          {membershipUntil
            ? "Abono activo"
            : credits === 1
              ? "Te queda 1 clase"
              : credits > 0
                ? `Te quedan ${credits} clases`
                : "Sin créditos"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {membershipUntil
            ? `Válido hasta el ${fmtDay(membershipUntil)} · reservás sin consumir créditos.`
            : credits > 0 && nearestExpiry
              ? `Vencen el ${fmtDay(nearestExpiry)}.`
              : "Comprá un pack o abono para empezar a reservar."}
        </p>
        {/* si además del abono tiene créditos de pack, no se los escondemos */}
        {membershipUntil && credits > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Además tenés {credits} {credits === 1 ? "clase" : "clases"} de pack
            {nearestExpiry ? ` (vencen el ${fmtDay(nearestExpiry)})` : ""}.
          </p>
        ) : null}
      </header>

      {status === "ok" ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Recibimos tu pago. Apenas se acredite vas a verlo en tu saldo.
        </p>
      ) : null}
      {status === "pending" ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Clock3 className="size-4 shrink-0" aria-hidden />
          Tu pago quedó pendiente. Cuando se acredite lo vas a ver en tu saldo.
        </p>
      ) : null}
      {status === "fail" ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          El pago no se completó. Podés intentarlo de nuevo.
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {!mpConnected ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Wallet className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Este estudio todavía no tiene el pago online activo. Consultá en el mostrador para comprar.
          </p>
        </div>
      ) : !hasCatalog ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Ticket className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">El estudio todavía no publicó packs ni abonos.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {passes.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-foreground">Packs de clases</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {passes.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Ticket className="size-5" aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.credits} {p.credits === 1 ? "clase" : "clases"} · vence en {p.validity_days} días
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-lg font-bold tabular-nums text-foreground">{money(p.price)}</span>
                      <form action={startCheckout}>
                        <input type="hidden" name="passId" value={p.id} />
                        <BuyButton label="Comprar" />
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plans.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-foreground">Abonos y membresías</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => {
                  const meta = PLAN_META[p.concept];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-sm text-muted-foreground">{meta.detail(p.duration_days)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <span className="text-lg font-bold tabular-nums text-foreground">{money(p.price)}</span>
                        <form action={startCheckout}>
                          <input type="hidden" name="productId" value={p.id} />
                          <BuyButton label="Comprar" />
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Pago procesado por MercadoPago. El dinero va directo a la cuenta de tu estudio.
      </p>
    </main>
  );
}
