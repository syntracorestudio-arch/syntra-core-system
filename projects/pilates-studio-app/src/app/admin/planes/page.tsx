import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Power, Infinity as InfinityIcon, CalendarClock, Ticket } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PageHeader, HeaderStat } from "@/components/admin/page-header";
import { PlanForm, type PlanInitial, type PlanConcept } from "@/components/admin/plan-form";
import { togglePlan } from "./actions";

export const metadata = { title: "Abonos y membresías — Panel" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}

const CONCEPT_META: Record<PlanConcept, { label: string; icon: typeof InfinityIcon }> = {
  membership: { label: "Membresía", icon: InfinityIcon },
  abono: { label: "Abono", icon: CalendarClock },
  drop_in: { label: "Clase suelta", icon: Ticket },
};

type PlanRow = {
  id: string;
  name: string;
  concept: PlanConcept;
  price: number;
  duration_days: number | null;
  active: boolean;
};

export default async function PlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; notice?: string; error?: string }>;
}) {
  const { edit, notice, error } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/app");
  if (member.role !== "admin") redirect("/admin");

  const { data: rows } = await supabase
    .from("sale_products")
    .select("id, name, concept, price, duration_days, active")
    .order("active", { ascending: false })
    .order("price", { ascending: true });
  const plans = (rows ?? []) as PlanRow[];

  const editing = edit ? plans.find((p) => p.id === edit) : null;
  const initial: PlanInitial | null = editing
    ? {
        id: editing.id,
        name: editing.name,
        concept: editing.concept,
        price: Number(editing.price),
        durationDays: editing.duration_days,
      }
    : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
      <Link
        href="/admin/configuracion"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Configuración
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Abonos y membresías"
          subtitle="Definí membresías, abonos y clases sueltas con su precio."
          icon={CalendarClock}
          stat={<HeaderStat value={plans.length} caption={plans.length === 1 ? "plan" : "planes"} />}
        />
      </div>

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section>
          <h2 className="text-base font-semibold text-foreground">Listado</h2>
          <div className="mt-3 grid gap-3">
            {plans.length > 0 ? (
              plans.map((p) => {
                const meta = CONCEPT_META[p.concept];
                const Icon = meta.icon;
                const detail =
                  p.concept === "drop_in"
                    ? "1 clase · vence en 30 días"
                    : `${meta.label} · vigencia ${p.duration_days ?? "—"} días`;
                return (
                  <article
                    key={p.id}
                    className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-base sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
                      p.id === edit ? "border-primary ring-2 ring-primary/30" : "border-border"
                    } ${p.active ? "" : "opacity-70"}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            {meta.label}
                          </span>
                          {!p.active ? (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                              inactivo
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
                        <p className="mt-1 text-lg font-bold text-foreground">{money(p.price)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col sm:items-end">
                      <Link
                        href={`/admin/planes?edit=${p.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:flex-none"
                      >
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Link>
                      <form action={togglePlan} className="flex-1 sm:flex-none">
                        <input type="hidden" name="planId" value={p.id} />
                        <input type="hidden" name="active" value={(!p.active).toString()} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Power className="size-4" aria-hidden />
                          {p.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface-sunken/60 px-6 py-12 text-center">
                <CalendarClock className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">
                  Todavía no tenés abonos ni membresías. Creá el primero con el panel de la derecha.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {initial ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              </span>
              <h2 className="text-base font-semibold text-foreground">{initial ? "Editar plan" : "Nuevo plan"}</h2>
            </div>
            <PlanForm key={initial?.id ?? "new"} initial={initial} />
          </div>
        </aside>
      </div>
    </main>
  );
}
