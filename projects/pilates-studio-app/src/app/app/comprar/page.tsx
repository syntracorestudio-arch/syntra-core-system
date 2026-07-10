import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ticket,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Infinity as InfinityIcon,
  CalendarClock,
} from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startCheckout } from "./actions";
import { BuyButton } from "./buy-button";
import { SuspendedScreen } from "@/components/suspended-screen";

export const metadata = { title: "Comprar" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}

type StudioRel = { name: string; status: string };
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
    .select("studio_id, studios(name, status)")
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

  const { data: passesRaw } = await supabase
    .from("passes")
    .select("id, name, credits, validity_days, price")
    .eq("active", true)
    .order("price", { ascending: true });
  const passes = (passesRaw ?? []) as Pass[];

  const { data: plansRaw } = await supabase
    .from("sale_products")
    .select("id, name, concept, price, duration_days")
    .eq("active", true)
    .order("price", { ascending: true });
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
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-16 pt-8 lg:px-8">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>
      <header className="mt-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Comprar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{studio?.name ?? "Tu estudio"}</p>
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
          Tu pago quedó pendiente. Te avisamos cuando se acredite.
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
              <ul className="mt-3 grid gap-3">
                {passes.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
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
              <ul className="mt-3 grid gap-3">
                {plans.map((p) => {
                  const meta = PLAN_META[p.concept];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
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
