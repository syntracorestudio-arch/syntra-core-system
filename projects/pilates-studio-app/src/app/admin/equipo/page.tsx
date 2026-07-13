import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { PersonRow, type Person } from "@/components/admin/person-row";

export const metadata = { title: "Equipo — Panel" };
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "reception"];

type ProfileRel = { full_name: string; email: string | null; phone: string | null };
type MemberRow = { id: string; status: string; role: string; profiles: ProfileRel | ProfileRel[] | null };

export default async function EquipoPage() {
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
    .in("role", ["instructor", "reception"])
    .order("role", { ascending: true });

  const staff: Person[] = ((mems ?? []) as unknown as MemberRow[]).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      name: prof?.full_name ?? "—",
      email: prof?.email ?? null,
      role: m.role,
      isStaff: true,
      fin: undefined,
    };
  });
  const instructores = staff.filter((p) => p.role === "instructor").length;
  const recepcion = staff.length - instructores;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <PageHeader title="Equipo" subtitle={studio?.name ?? "Tu estudio"} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {staff.length} {staff.length === 1 ? "persona" : "personas"}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {instructores} {instructores === 1 ? "instructor" : "instructores"} · {recepcion} recepción
          </span>
        </h2>
      </div>

      {staff.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm duration-500 animate-in fade-in slide-in-from-bottom-2">
          <div className="divide-y divide-border">
            {staff.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <GraduationCap className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay equipo cargado. Sumá a alguien con el código del estudio y cambiale el rol desde su ficha.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        El rol (Alumno / Instructor / Recepción) se cambia desde la ficha de cada persona.
      </p>
    </main>
  );
}
