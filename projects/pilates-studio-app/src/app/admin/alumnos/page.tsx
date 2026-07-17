import { redirect } from "next/navigation";
import { Users, Search } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader, HeaderStat } from "@/components/admin/page-header";
import { PersonRow, type Person, type FinRow } from "@/components/admin/person-row";

export const metadata = { title: "Alumnos — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];

type ProfileRel = { full_name: string; email: string | null; phone: string | null };
type MemberRow = { id: string; status: string; role: string; profiles: ProfileRel | ProfileRel[] | null };

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

  const [{ data: mems }, { data: fins }] = await Promise.all([
    supabase
      .from("members")
      .select("id, status, role, profiles(full_name, email, phone)")
      .eq("role", "client")
      .order("joined_at", { ascending: false }),
    supabase.from("member_financial_status").select("member_id, credits_available, has_active_membership, financial_status"),
  ]);

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
      isStaff: false,
      fin: finByMember.get(m.id),
    };
  });

  const query = (q ?? "").trim().toLowerCase();
  const clients = all.filter(
    (p) => !query || p.name.toLowerCase().includes(query) || (p.email ?? "").toLowerCase().includes(query),
  );
  const withDebt = clients.filter((p) => p.fin && p.fin.financial_status !== "al_dia").length;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader
        title="Alumnos"
        subtitle={studio?.name ?? "Tu estudio"}
        icon={Users}
        stat={
          <HeaderStat
            value={all.length}
            caption={withDebt > 0 ? `${withDebt} con pago pendiente` : "alumnos activos"}
          />
        }
      >
        <form method="get" className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o email"
            className="w-full rounded-xl border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-base placeholder:text-muted-foreground/60 focus:border-transparent focus:ring-2 focus:ring-ring sm:w-64"
          />
        </form>
      </PageHeader>

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

      {clients.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2">
          <div className="divide-y divide-border">
            {clients.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            {query
              ? `Sin resultados para “${q}”.`
              : "Todavía no hay alumnos. Se suman al ingresar con el código del estudio."}
          </p>
        </div>
      )}
    </main>
  );
}
