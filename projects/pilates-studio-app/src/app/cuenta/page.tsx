import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, CheckCircle2, AlertCircle, UserRound, Wallet, Clock3 } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword, updateProfile } from "./actions";
import { SaveButton } from "./save-button";

export const metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring";

const CONCEPT_LABEL: Record<string, string> = {
  drop_in: "Clase suelta",
  pack: "Pack",
  membership: "Membresía",
  abono: "Abono",
};
const METHOD_LABEL: Record<string, string> = {
  cash: "efectivo",
  transfer: "transferencia",
  card_manual: "tarjeta",
  mercadopago: "MercadoPago",
};

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}
function fmtDate(iso: string, tz: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "numeric", month: "short", year: "numeric" })
    .format(new Date(iso))
    .replace(/\./g, "");
}

/** Mi cuenta: datos editables + pagos propios + cambio de contraseña. Cualquier rol. */
export default async function CuentaPage({
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

  // Volver al panel que corresponda según el perfil.
  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, is_superadmin").eq("id", user.id).maybeSingle(),
    supabase.from("members").select("role, studios(timezone)").eq("profile_id", user.id).limit(1).maybeSingle(),
  ]);
  const backHref = profile?.is_superadmin
    ? "/super"
    : member?.role === "instructor"
      ? "/instructor"
      : member?.role === "admin" || member?.role === "reception"
        ? "/admin"
        : "/app";
  const studioRel = (member?.studios ?? null) as { timezone: string | null } | { timezone: string | null }[] | null;
  const tz = (Array.isArray(studioRel) ? studioRel[0] : studioRel)?.timezone || DEFAULT_TZ;

  // Mis pagos (RLS payments_select_own) + intentos online en proceso (attempts_select_own).
  const [{ data: payRows }, { data: attRows }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, concept, method, status, paid_at")
      .order("paid_at", { ascending: false })
      .limit(10),
    supabase
      .from("payment_attempts")
      .select("id, amount, concept, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const payments = (payRows ?? []) as {
    id: string;
    amount: number;
    concept: string;
    method: string;
    status: string;
    paid_at: string;
  }[];
  const pendingAttempts = (attRows ?? []) as { id: string; amount: number; concept: string; created_at: string }[];

  return (
    <main className="canvas-aurora mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      <header className="mt-3 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary-ink">
          <UserRound className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi cuenta</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name ?? ""} · {user.email}
          </p>
        </div>
      </header>

      {notice ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* Mis datos */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
          <UserRound className="size-4 text-muted-foreground" aria-hidden />
          Mis datos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tu estudio usa estos datos para contactarte.
        </p>
        <form action={updateProfile} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Nombre y apellido</span>
            <input
              name="full_name"
              defaultValue={profile?.full_name ?? ""}
              required
              minLength={2}
              maxLength={80}
              className={inputCls}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Teléfono</span>
            <input
              name="phone"
              type="tel"
              defaultValue={(profile as { phone?: string | null } | null)?.phone ?? ""}
              placeholder="+54 9 11 ..."
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">Opcional.</span>
          </label>
          <SaveButton label="Guardar mis datos" icon="check" />
        </form>
      </section>

      {/* Mis pagos (solo si hay algo que mostrar) */}
      {payments.length > 0 || pendingAttempts.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Wallet className="size-4 text-muted-foreground" aria-hidden />
            Mis pagos
          </h2>
          {pendingAttempts.map((a) => (
            <p
              key={a.id}
              className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"
            >
              <Clock3 className="size-3.5 shrink-0 text-warning" aria-hidden />
              Pago online de {money(a.amount)} ({CONCEPT_LABEL[a.concept] ?? a.concept}) en proceso — cuando se
              acredite lo vas a ver acá.
            </p>
          ))}
          {payments.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {CONCEPT_LABEL[p.concept] ?? p.concept}
                      <span className="font-normal text-muted-foreground"> · {METHOD_LABEL[p.method] ?? p.method}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(p.paid_at, tz)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{money(p.amount)}</p>
                    {p.status !== "confirmed" ? (
                      <p className={`text-[11px] ${p.status === "pending" ? "text-warning" : "text-destructive"}`}>
                        {p.status === "pending" ? "pendiente" : "rechazado"}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            ¿Ves algo que no cierra? Hablá con tu estudio.
          </p>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          Cambiar contraseña
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Si te dieron una clave temporal, cambiala acá por una tuya.
        </p>
        <form action={changePassword} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Contraseña nueva</span>
            <PasswordInput name="password" minLength={8} autoComplete="new-password" inputClassName={`${inputCls} pr-11`} />
            <span className="text-xs text-muted-foreground">Mínimo 8 caracteres.</span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Repetir contraseña</span>
            <PasswordInput name="confirm" minLength={8} autoComplete="new-password" inputClassName={`${inputCls} pr-11`} />
          </label>
          <SaveButton />
        </form>
      </section>
    </main>
  );
}
