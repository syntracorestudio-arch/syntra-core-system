import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Wallet, CreditCard, Ticket, CalendarClock, Phone, Mail, CheckCircle2, GraduationCap, Headset, UserCircle, MessageCircle, StickyNote } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { FinancialBadge, type FinancialStatus } from "@/components/admin/financial-badge";
import { PaymentForm, type PassOption } from "@/components/admin/payment-form";
import { setMemberRole, updateMemberNotes } from "./actions";
import { NotesSaveButton } from "./notes-save-button";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["admin", "reception"];

const ROLE_OPTIONS = [
  { key: "client", label: "Alumno" },
  { key: "instructor", label: "Instructor" },
  { key: "reception", label: "Recepción" },
] as const;

const CONCEPT_LABEL: Record<string, string> = {
  pack: "Pack",
  drop_in: "Clase suelta",
  membership: "Membresía",
  abono: "Abono",
};
const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card_manual: "Tarjeta",
  mercadopago: "MercadoPago",
};

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(d))
    .replace(/\./g, "");
}
function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}

type ProfileRel = { full_name: string; email: string | null; phone: string | null };

export default async function FichaAlumnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/app");
  const isAdmin = me.role === "admin";

  // alumno (RLS: admin ve members de su estudio; si no es de su estudio → null)
  const { data: target } = await supabase
    .from("members")
    .select("id, status, role, notes, profiles(full_name, email, phone)")
    .eq("id", id)
    .maybeSingle();
  if (!target) notFound();
  const targetRole = (target.role as string) ?? "client";
  const isStaff = targetRole === "instructor" || targetRole === "reception";
  const prof = (Array.isArray(target.profiles) ? target.profiles[0] : target.profiles) as ProfileRel | null;

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const [{ data: fin }, { data: passesRaw }, { data: ledger }, { data: mships }, { data: pays }, { data: catalog }, { data: res }] =
    await Promise.all([
      supabase
        .from("member_financial_status")
        .select("credits_available, has_active_membership, next_pass_expiry, next_membership_end, financial_status")
        .eq("member_id", id)
        .maybeSingle(),
      supabase
        .from("member_passes")
        .select("id, credits_total, expires_at, status, passes(name)")
        .eq("member_id", id)
        .order("expires_at", { ascending: false }),
      supabase.from("credit_ledger").select("member_pass_id, delta").eq("member_id", id),
      supabase
        .from("memberships")
        .select("type, valid_from, valid_to, status")
        .eq("member_id", id)
        .order("valid_to", { ascending: false }),
      supabase
        .from("payments")
        .select("amount, concept, method, paid_at")
        .eq("member_id", id)
        .order("paid_at", { ascending: false })
        .limit(20),
      supabase.from("passes").select("id, name, credits, validity_days, price").eq("active", true).order("price"),
      supabase
        .from("class_reservations")
        .select("status, class_occurrences(starts_at, classes(name))")
        .eq("member_id", id)
        .eq("status", "booked")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const financial = (fin?.financial_status ?? "debe_pago") as FinancialStatus;
  const credits = fin?.credits_available ?? 0;
  const hasMembership = fin?.has_active_membership ?? false;

  // créditos restantes por pass (suma de asientos del ledger)
  const remByPass = new Map<string, number>();
  for (const l of (ledger ?? []) as { member_pass_id: string | null; delta: number }[]) {
    if (l.member_pass_id) remByPass.set(l.member_pass_id, (remByPass.get(l.member_pass_id) ?? 0) + l.delta);
  }
  const passes = ((passesRaw ?? []) as unknown as {
    id: string;
    credits_total: number;
    expires_at: string;
    status: string;
    passes: { name: string } | { name: string }[] | null;
  }[]).map((p) => {
    const cat = Array.isArray(p.passes) ? p.passes[0] : p.passes;
    return {
      id: p.id,
      name: cat?.name ?? "Clase suelta",
      remaining: remByPass.get(p.id) ?? 0,
      total: p.credits_total,
      expiresAt: p.expires_at,
      active: p.expires_at > nowIso && p.status === "active",
    };
  });
  const catalogOpts: PassOption[] = ((catalog ?? []) as { id: string; name: string; credits: number; validity_days: number; price: number }[]).map(
    (c) => ({ id: c.id, name: c.name, credits: c.credits, validityDays: c.validity_days, price: Number(c.price) }),
  );
  const memberships = ((mships ?? []) as { type: string; valid_from: string; valid_to: string; status: string }[]).map((m) => ({
    ...m,
    active: m.status === "active" && m.valid_from <= today && m.valid_to >= today,
  }));
  const payments = (pays ?? []) as { amount: number; concept: string; method: string; paid_at: string }[];
  const reservas = ((res ?? []) as unknown as { class_occurrences: { starts_at: string; classes: { name: string } | { name: string }[] | null } | { starts_at: string; classes: { name: string } | { name: string }[] | null }[] | null }[])
    .map((r) => {
      const occ = Array.isArray(r.class_occurrences) ? r.class_occurrences[0] : r.class_occurrences;
      const cls = occ ? (Array.isArray(occ.classes) ? occ.classes[0] : occ.classes) : null;
      return occ ? { startsAt: occ.starts_at, name: cls?.name ?? "Clase" } : null;
    })
    .filter((x): x is { startsAt: string; name: string } => x !== null && x.startsAt > nowIso);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      {/* header */}
      <Link
        href="/admin/alumnos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alumnos
      </Link>
      <header className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{prof?.full_name ?? "Alumno"}</h1>
        {isStaff ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {targetRole === "reception" ? (
              <Headset className="size-3.5" aria-hidden />
            ) : (
              <GraduationCap className="size-3.5" aria-hidden />
            )}
            {targetRole === "reception" ? "Recepción" : "Instructor"}
          </span>
        ) : (
          <FinancialBadge status={financial} />
        )}
      </header>
      {(prof?.email || prof?.phone) && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {prof?.email ? (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3.5" aria-hidden />
              {prof.email}
            </span>
          ) : null}
          {prof?.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" aria-hidden />
              {prof.phone}
            </span>
          ) : null}
          {prof?.phone ? (
            <a
              href={`https://wa.me/${prof.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                `Hola ${(prof.full_name ?? "").split(" ")[0]}! Te escribimos del estudio 😊`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
        </div>
      )}

      {notice ? (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success duration-300 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="size-4 shrink-0 duration-500 animate-in zoom-in-50" aria-hidden />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* columna izquierda: saldo + membresía + registrar pago */}
        <div className="grid gap-4">
          {/* nota operativa (lesiones, acuerdos) — la ve el staff, incl. instructor en su roster */}
          <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <StickyNote className="size-4" aria-hidden />
              Nota del alumno
            </p>
            <form action={updateMemberNotes} className="mt-2 grid gap-2">
              <input type="hidden" name="memberId" value={target.id as string} />
              <textarea
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={(target.notes as string | null) ?? ""}
                placeholder="Ej: hernia lumbar — evitar springs fuertes. Prefiere reformer 3."
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">La ve el equipo (incl. instructor en su clase).</span>
                <NotesSaveButton />
              </div>
            </form>
          </div>

          {/* rol en el estudio: alumno / instructor / recepción (solo admin) */}
          {isAdmin ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <UserCircle className="size-4" aria-hidden />
                Rol en el estudio
              </p>
              <div className="mt-2 flex gap-1 rounded-xl bg-secondary p-1">
                {ROLE_OPTIONS.map((r) => {
                  const active = targetRole === r.key;
                  const cls =
                    "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-colors";
                  return active ? (
                    <span key={r.key} className={`${cls} bg-card text-foreground shadow-sm`} aria-current="true">
                      {r.label}
                    </span>
                  ) : (
                    <form key={r.key} action={setMemberRole} className="flex-1">
                      <input type="hidden" name="memberId" value={id} />
                      <input type="hidden" name="role" value={r.key} />
                      <button type="submit" className={`w-full text-muted-foreground hover:text-foreground ${cls}`}>
                        {r.label}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {/* saldo (créditos) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Ticket className="size-3.5" aria-hidden />
                Saldo
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{credits}</p>
              <p className="text-xs text-muted-foreground">{credits === 1 ? "clase" : "clases"}</p>
            </div>
            {/* membresía */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CreditCard className="size-3.5" aria-hidden />
                Membresía
              </p>
              <p className={`mt-1 text-base font-bold ${hasMembership ? "text-success" : "text-foreground"}`}>
                {hasMembership ? "Activa" : "—"}
              </p>
              {hasMembership && fin?.next_membership_end ? (
                <p className="text-xs text-muted-foreground">vence {fmtDate(fin.next_membership_end)}</p>
              ) : (
                <p className="text-xs text-muted-foreground">sin abono</p>
              )}
            </div>
          </div>

          {/* registrar pago */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="size-4" aria-hidden />
              </span>
              <h2 className="text-base font-semibold text-foreground">Registrar pago</h2>
            </div>
            <PaymentForm memberId={id} passes={catalogOpts} />
          </div>
        </div>

        {/* columna derecha: historial */}
        <div className="grid gap-4">
          {/* pagos */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Pagos</h2>
            {payments.length > 0 ? (
              <ul className="mt-3 divide-y divide-border">
                {payments.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{CONCEPT_LABEL[p.concept] ?? p.concept}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(p.paid_at)} · {METHOD_LABEL[p.method] ?? p.method}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Sin pagos registrados todavía.</p>
            )}
          </section>

          {/* packs / membresías */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Packs y membresías</h2>
            {passes.length === 0 && memberships.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sin pack activo.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {passes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Ticket className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-sm text-foreground">{p.name}</span>
                      {!p.active ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          vencido
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.remaining}/{p.total} · vence {fmtDate(p.expiresAt)}
                    </span>
                  </li>
                ))}
                {memberships.map((m, i) => (
                  <li
                    key={`m${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="inline-flex items-center gap-2">
                      <CreditCard className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-sm text-foreground capitalize">{m.type}</span>
                      {!m.active ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          vencida
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">vence {fmtDate(m.valid_to)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* reservas próximas */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Próximas reservas</h2>
            {reservas.length > 0 ? (
              <ul className="mt-3 grid gap-2">
                {reservas.map((r, i) => (
                  <li key={i} className="inline-flex items-center gap-2 text-sm text-foreground">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {r.name} — {fmtDate(r.startsAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Aún no reservó clases.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
