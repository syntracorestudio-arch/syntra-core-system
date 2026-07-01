import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";

export const dynamic = "force-dynamic";

/**
 * Aplica el color de marca del estudio (branding.accent) en runtime → white-label.
 * Sobrescribe --color-primary / --color-ring (las vars que usan las utilidades de
 * Tailwind v4) en el subárbol del panel; si el estudio no tiene accent, usa el default.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: member } = await supabase.from("members").select("studios(branding)").limit(1).maybeSingle();
  const rel = (member?.studios ?? null) as
    | { branding: Record<string, unknown> | null }
    | { branding: Record<string, unknown> | null }[]
    | null;
  const branding = (Array.isArray(rel) ? rel[0] : rel)?.branding ?? null;
  const accent =
    branding && typeof branding === "object" && "accent" in branding ? String(branding.accent) : null;

  const style = accent
    ? ({
        "--primary": accent,
        "--ring": accent,
        "--primary-foreground": accentForeground(accent),
      } as CSSProperties)
    : undefined;

  return <div style={style}>{children}</div>;
}
