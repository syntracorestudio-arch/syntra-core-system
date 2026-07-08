import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Ticket, Power } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PackForm, type PackInitial } from "@/components/admin/pack-form";
import { togglePass } from "./actions";

export const metadata = { title: "Packs — Panel" };
export const dynamic = "force-dynamic";

function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}

type PackRow = {
  id: string;
  name: string;
  credits: number;
  validity_days: number;
  price: number;
  active: boolean;
};

export default async function PacksPage({
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
  // Precios/catálogo = decisión del dueño → solo admin (reception no gestiona packs).
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/app");
  if (member.role !== "admin") redirect("/admin");

  const { data: rows } = await supabase
    .from("passes")
    .select("id, name, credits, validity_days, price, active")
    .order("active", { ascending: false })
    .order("price", { ascending: true });
  const packs = (rows ?? []) as PackRow[];

  const editing = edit ? packs.find((p) => p.id === edit) : null;
  const initial: PackInitial | null = editing
    ? {
        id: editing.id,
        name: editing.name,
        credits: editing.credits,
        validityDays: editing.validity_days,
        price: Number(editing.price),
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
      <header className="mt-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Packs y precios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Definí los packs que vendés. Aparecen al registrar un pago.
        </p>
      </header>

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
        {/* lista de packs */}
        <section>
          <h2 className="text-base font-semibold text-foreground">
            {packs.length > 0 ? `${packs.length} ${packs.length === 1 ? "pack" : "packs"}` : "Packs"}
          </h2>
          <div className="mt-3 grid gap-3">
            {packs.length > 0 ? (
              packs.map((p) => (
                <article
                  key={p.id}
                  className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-base sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
                    p.id === edit ? "border-primary ring-2 ring-primary/30" : "border-border"
                  } ${p.active ? "" : "opacity-70"}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Ticket className="size-5" aria-hidden />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                        {!p.active ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            inactivo
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {p.credits} {p.credits === 1 ? "clase" : "clases"} · vigencia {p.validity_days} días
                      </p>
                      <p className="mt-1 text-lg font-bold text-foreground">{money(p.price)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-col sm:items-end">
                    <Link
                      href={`/admin/packs?edit=${p.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:flex-none"
                    >
                      <Pencil className="size-4" aria-hidden />
                      Editar
                    </Link>
                    <form action={togglePass} className="flex-1 sm:flex-none">
                      <input type="hidden" name="passId" value={p.id} />
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
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface-sunken/60 px-6 py-12 text-center">
                <Ticket className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm text-muted-foreground">
                  Todavía no tenés packs. Creá el primero con el panel de la derecha.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* panel crear/editar */}
        <aside className="lg:sticky lg:top-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {initial ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              </span>
              <h2 className="text-base font-semibold text-foreground">{initial ? "Editar pack" : "Nuevo pack"}</h2>
            </div>
            <PackForm key={initial?.id ?? "new"} initial={initial} />
          </div>
        </aside>
      </div>
    </main>
  );
}
