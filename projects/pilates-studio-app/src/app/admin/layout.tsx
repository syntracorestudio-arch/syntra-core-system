import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";
import { AdminSidebar } from "@/components/admin/sidebar";

export const dynamic = "force-dynamic";

/**
 * Shell del panel admin: navegación por sidebar (desktop) / bottom-bar (mobile) +
 * marca del estudio white-label. Aplica el acento del estudio en runtime
 * (sobrescribe --primary/--ring/--primary-foreground, las vars de Tailwind v4).
 * La guarda de auth/rol la hace cada página; acá solo se arma el chrome.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase
        .from("members")
        .select("role, profiles(full_name), studios(name, branding)")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const role = (member?.role as string) ?? "reception";
  const profRel = (member?.profiles ?? null) as { full_name: string } | { full_name: string }[] | null;
  const userName = (Array.isArray(profRel) ? profRel[0] : profRel)?.full_name ?? "Equipo";

  const studioRel = (member?.studios ?? null) as
    | { name: string; branding: Record<string, unknown> | null }
    | { name: string; branding: Record<string, unknown> | null }[]
    | null;
  const studio = Array.isArray(studioRel) ? studioRel[0] : studioRel;
  const studioName = studio?.name ?? "Tu estudio";
  const branding = studio?.branding ?? null;
  const bstr = (k: string) =>
    branding && typeof branding === "object" && typeof branding[k] === "string" ? String(branding[k]) : null;
  const accent = bstr("accent");
  const logo = bstr("logo_url");

  const style = accent
    ? ({
        "--primary": accent,
        "--ring": accent,
        "--primary-foreground": accentForeground(accent),
      } as CSSProperties)
    : undefined;

  return (
    <div style={style} className="min-h-dvh">
      <AdminSidebar role={role} studioName={studioName} logo={logo} userName={userName} />
      <div className="pb-20 lg:pb-0 lg:pl-60">{children}</div>
    </div>
  );
}
