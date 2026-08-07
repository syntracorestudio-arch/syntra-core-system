import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/session";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CartelesClient, type Cartel } from "./carteles-client";

export const dynamic = "force-dynamic";

export default async function CartelesPage() {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/admin");

  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("promos_carteles", { p_store_id: session.store.id });

  return (
    <AppShell
      current="/admin/promos"
      storeName={session.store.name}
      userLabel={`${session.member.display_name ?? "Vos"} · Dueño`}
    >
      <CartelesClient carteles={(data ?? []) as Cartel[]} />
    </AppShell>
  );
}
