import { redirect } from "next/navigation";
import { Users, ChevronRight, GraduationCap, Headset } from "lucide-react";
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

export default async function AlumnosPage({
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

  const alumnos = ((mems ?? []) as unknown as MemberRow[]).map((m) => {
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
  const withDebt = alumnos.filter((a) => !a.isStaff && a.fin && a.fin.financial_status !== "al_dia").length;

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

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {alumnos.length > 0
            ? `${alumnos.length} ${alumnos.length === 1 ? "alumno" : "alumnos"}`
            : "Alumnos"}
        </h2>
        {withDebt > 0 ? (
          <span className="text-xs text-muted-foreground">{withDebt} con pago pendiente</span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {alumnos.length > 0 ? (
          alumnos.map((a, i) => (
            <a
              key={a.id}
              href={`/admin/alumnos/${a.id}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md sm:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-fill-mode:backwards]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{a.name}</p>
                {a.email ? <p className="truncate text-sm text-muted-foreground">{a.email}</p> : null}
                {/* saldo en mobile (en desktop va en la columna derecha); el staff no lleva saldo */}
                {!a.isStaff ? (
                  <p className="mt-0.5 text-sm font-medium text-foreground sm:hidden">{saldoText(a.fin)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {a.isStaff ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {a.role === "reception" ? (
                      <Headset className="size-3.5" aria-hidden />
                    ) : (
                      <GraduationCap className="size-3.5" aria-hidden />
                    )}
                    {a.role === "reception" ? "Recepción" : "Instructor"}
                  </span>
                ) : (
                  <>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-foreground">{saldoText(a.fin)}</p>
                    </div>
                    {a.fin ? <FinancialBadge status={a.fin.financial_status} /> : null}
                  </>
                )}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <Users className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm text-muted-foreground">
              Todavía no hay alumnos. Se suman al ingresar con el código del estudio.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
