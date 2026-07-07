import type { CSSProperties, ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";

export const dynamic = "force-dynamic";

/**
 * Marca del estudio en el panel (white-label): aplica el color de acento en runtime
 * (sobrescribe --primary/--ring/--primary-foreground, las vars que usan las utilidades
 * de Tailwind v4) y muestra el logo del estudio en una barra superior si existe.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: member } = await supabase
    .from("members")
    .select("studios(name, branding)")
    .limit(1)
    .maybeSingle();
  const rel = (member?.studios ?? null) as
    | { name: string; branding: Record<string, unknown> | null }
    | { name: string; branding: Record<string, unknown> | null }[]
    | null;
  const studio = Array.isArray(rel) ? rel[0] : rel;
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
    <div style={style}>
      {logo ? (
        <div className="border-b border-border bg-card/60">
          <div className="mx-auto flex max-w-6xl items-center px-5 py-3 lg:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={studio?.name ?? "Logo"} className="h-11 w-auto max-w-[220px] object-contain sm:h-12" />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
