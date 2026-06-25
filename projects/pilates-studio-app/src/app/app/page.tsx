import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Mi estudio" };
export const dynamic = "force-dynamic";

type MemberRow = {
  role: string;
  status: string;
  studios: { name: string; slug: string } | null;
};

export default async function AppPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS: el alumno solo ve sus propias filas de members + su(s) estudio(s).
  const { data: members } = await supabase
    .from("members")
    .select("role, status, studios(name, slug)")
    .returns<MemberRow[]>();

  const membership = members?.[0] ?? null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">Sesión iniciada</h1>
        <dl className="mt-4 grid gap-3 text-sm">
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Rol" value={membership?.role ?? "sin vínculo a estudio"} />
          <Row label="Estudio" value={membership?.studios?.name ?? "—"} />
        </dl>
        <a
          href="/logout"
          className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Cerrar sesión
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Ruta protegida temporal · Fase 1D-1A (sin pantallas reales todavía)
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
