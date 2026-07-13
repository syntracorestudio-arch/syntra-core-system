import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Callback OAuth (Google): canjea el `code` por sesión y rutea igual que el login.
 * Caso clave: usuario de Google SIN estudio vinculado → /join (modo vincular, solo código).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No se pudo completar el ingreso con Google.")}`,
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No se pudo completar el ingreso con Google.")}`,
    );
  }

  // Superadmin → panel SYNTRA.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.is_superadmin) return NextResponse.redirect(`${origin}/super`);

  // Rol de estudio (filtrado por el usuario actual — ver nota en login/actions).
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("profile_id", data.user.id)
    .limit(1)
    .maybeSingle();

  if (!member) return NextResponse.redirect(`${origin}/join`); // cuenta sin estudio → vincular por código
  if (member.role === "instructor") return NextResponse.redirect(`${origin}/instructor`);
  if (member.role === "admin" || member.role === "reception") return NextResponse.redirect(`${origin}/admin`);
  return NextResponse.redirect(`${origin}/app`);
}
