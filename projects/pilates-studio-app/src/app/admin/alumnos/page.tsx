import { redirect } from "next/navigation";
import { Users, ChevronRight, GraduationCap, Headset, Search } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { FinancialBadge, type FinancialStatus } from "@/components/admin/financial-badge";

export const metadata = { title: "Alumnos — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];

type ProfileRel = { full_name: string; email: string | null; phone: string | null };
type MemberRow = { id: string; status: string; role: string; profiles: ProfileRel | ProfileRel[] | null };
type FinRow = {
  member_id: string;
  credits_available: number;
  has_active_membership: boolean;
  financial_status: FinancialStatus;
};

function saldoText(f: FinRow | undefined) {
  if (!f) return "—";
  if (f.has_active_membership) return "Abono activo";
  if (f.credits_available > 0) return `${f.credits_available} ${f.credits_available === 1 ? "clase" : "clases"}`;
  return "Sin saldo";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

type Person = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isStaff: boolean;
  fin: FinRow | undefined;
};

function PersonRow({ p }: { p: Person }) {
  return (
    <a
      href={`/admin/alumnos/${p.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary-ink">
        {initials(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
        {p.email ? <span className="block truncate text-xs text-muted-foreground">{p.email}</span> : null}
        {!p.isStaff ? (
          <span className="mt-0.5 block text-xs font-medium text-foreground sm:hidden">{saldoText(p.fin)}</span>
        ) : null}
      </span>
      {p.isStaff ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-ink">
          {p.role === "reception" ? (
            <Headset className="size-3.5" aria-hidden />
          ) : (
            <GraduationCap className="size-3.5" aria-hidden />
          )}
          {p.role === "reception" ? "Recepción" : "Instructor"}
        </span>
      ) : (
        <>
          <span className="hidden w-28 shrink-0 text-right text-sm font-medium tabular-nums text-foreground sm:block">
            {saldoText(p.fin)}
          </span>
          <span className="hidden w-36 shrink-0 justify-end sm:flex">
            {p.fin ? <FinancialBadge status={p.fin.financial_status} /> : null}
          </span>
        </>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; q?: string }>;
}) {
  const { notice, error, q } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("role, studios(name)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member || !ADMIN_ROLES.includes(member.role)) redirect("/app");
  const studioRel = (member.studios ?? null) as { name: string } | { name: string }[] | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;

  const { data: mems } = await supabase
    .from("members")
    .select("id, status, role, profiles(full_name, email, phone)")
    .in("role", ["client", "instructor", "reception"])
    .order("joined_at", { ascending: false });
  const { data: fins } = await supabase
    .from("member_financial_status")
    .select("member_id, credits_available, has_active_membership, financial_status");

  const finByMember = new Map<string, FinRow>(
    ((fins ?? []) as unknown as FinRow[]).map((f) => [f.member_id, f]),
  );

  const all: Person[] = ((mems ?? []) as unknown as MemberRow[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      name: prof?.full_name ?? "Alumno",
      email: prof?.email ?? null,
      role: m.role,
      isStaff: m.role === "instructor" || m.role === "reception",
      fin: finByMember.get(m.id),
    };
  });

  const query = (q ?? "").trim().toLowerCase();
  const matches = (p: Person) =>
    !query || p.name.toLowerCase().includes(query) || (p.email ?? "").toLowerCase().includes(query);

  const clients = all.filter((p) => !p.isStaff && matches(p));
  const staff = all.filter((p) => p.isStaff && matches(p));
  const totalClients = all.filter((p) => !p.isStaff).length;
  const withDebt = clients.filter((p) => p.fin && p.fin.financial_status !== "al_dia").length;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Alumnos" subtitle={studio?.name ?? "Tu estudio"} />

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

      {/* header de lista + buscador (GET, sin JS) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {totalClients} {totalClients === 1 ? "alumno" : "alumnos"}
          {withDebt > 0 ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{withDebt} con pago pendiente</span>
          ) : null}
        </h2>
        <form method="get" className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o email"
            className="w-64 max-w-full rounded-xl border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring"
          />
        </form>
      </div>

      {/* alumnos (filas densas en un solo contenedor) */}
      {clients.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2">
          <div className="divide-y divide-border">
            {clients.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            {query
              ? `Sin resultados para “${q}”.`
              : "Todavía no hay alumnos. Se suman al ingresar con el código del estudio."}
          </p>
        </div>
      )}

      {/* equipo (instructores + recepción), separado de los alumnos */}
      {staff.length > 0 ? (
        <>
          <h2 className="mt-8 text-base font-semibold text-foreground">
            Equipo <span className="text-xs font-normal text-muted-foreground">{staff.length}</span>
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {staff.map((p) => (
                <PersonRow key={p.id} p={p} />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
