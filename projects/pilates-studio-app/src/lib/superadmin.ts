import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Gate del panel SYNTRA: exige sesión + profiles.is_superadmin (el usuario puede
 * leer su propia fila por RLS). Los datos del panel luego van vía service-role.
 */
export async function requireSuperadmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) redirect("/app");

  return { user, fullName: (profile.full_name as string | null) ?? null };
}
