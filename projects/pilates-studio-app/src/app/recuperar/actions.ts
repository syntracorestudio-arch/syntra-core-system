"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Pide el email de recuperación. SIEMPRE responde éxito (no filtra si el email
 * existe o no). El link del mail vuelve por /auth/callback?next=/cuenta.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/recuperar?error=" + encodeURIComponent("Ingresá tu email."));

  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createSupabaseServer();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/auth/callback?next=${encodeURIComponent(
      "/cuenta?notice=" + encodeURIComponent("Creá tu contraseña nueva acá abajo."),
    )}`,
  });

  // Éxito genérico aunque el email no exista (anti-enumeración).
  redirect("/recuperar?sent=1");
}
