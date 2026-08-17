import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/redirect-seguro";

export const dynamic = "force-dynamic";

/**
 * Canjea el código del link de recuperación por una sesión y manda al destino.
 *
 * GoTrue emite el link con un token de un solo uso; acá se cambia por sesión.
 * Si el link expiró o ya se usó, hay que DECIRLO —"pedí uno nuevo"— porque el
 * error genérico manda al dueño a pelearse con su clave creyendo que la tipeó
 * mal, que es el mismo problema que arregló la 049 en el login.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  /* `next` sólo puede ser una ruta INTERNA: sin recorte, este parámetro es un
     open redirect que además aterriza con la sesión YA creada. El guard vive en
     `lib/redirect-seguro` y no acá porque tiene tests propios — cubre el
     protocolo-relativo (`//host`), la variante con backslash y los saltos de
     línea, que un `startsWith("/")` deja pasar. */
  const next = rutaInternaSegura(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("El link no es válido. Pedí uno nuevo.")}`,
    );
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("El link expiró o ya fue usado. Pedí uno nuevo.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next ?? "/"}`);
}
