"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { esEmailSintetico } from "@/lib/credenciales";

/**
 * "Me olvidé la contraseña" — la mitad que faltaba de la historia de acceso.
 *
 * Hasta acá, un dueño que olvidaba su clave tenía UN solo camino: que SYNTRA
 * abriera Supabase y se la cambiara a mano. Eso no es una recuperación, es un
 * favor, y no escala más allá de tres clientes.
 *
 * El mail lo manda Supabase Auth (GoTrue), no nuestro Resend: el link lleva un
 * token de un solo uso que sólo GoTrue sabe emitir y validar. En local lo
 * recibe Inbucket (http://localhost:54324) y ahí se prueba de punta a punta;
 * en producción hay que apuntar el SMTP de Auth a Resend — sin eso, esta
 * pantalla acepta el pedido y el mail no sale nunca.
 */

const schema = z.object({
  email: z.string().trim().min(1, "Escribí tu email.").email("Revisá el email."),
});

export type RecuperarState = { error?: string; aviso?: string };

export async function pedirRecuperacion(
  _prev: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }
  const email = parsed.data.email.toLowerCase();

  /* El empleado NO tiene email: el suyo lo fabrica el sistema sobre un dominio
     reservado (`.invalid`, RFC 2606) que por definición no recibe correo.
     Mandarlo al camino genérico lo dejaría esperando un mail que no existe.
     Y decírselo no filtra nada: ese email lo compuso él mismo tipeando su
     usuario y el código del negocio, así que no revela ninguna cuenta. */
  if (esEmailSintetico(email)) {
    return {
      aviso:
        "Los usuarios de empleado no tienen email. Pedile al dueño que te genere una clave nueva desde Equipo.",
    };
  }

  /* Endpoint público ⇒ rate limit en los dos ejes (baseline). Fail-open: si el
     limitador se cae no dejamos a nadie sin poder recuperar su cuenta.
     La clave por cuenta va hasheada: `rate_limits` es una tabla y no tiene por
     qué guardar el email de nadie en claro. */
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cuenta = createHash("sha256").update(email).digest("hex");
  const [ipOk, cuentaOk] = await Promise.all([
    checkRateLimit(`recuperar:ip:${ip}`, 10, 900),
    checkRateLimit(`recuperar:acct:${cuenta}`, 3, 900),
  ]);
  if (!ipOk || !cuentaOk) {
    return { error: "Ya pediste varios links. Esperá unos minutos y probá de nuevo." };
  }

  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createSupabaseServer();
  /* No se mira el error a propósito (ver el redirect de abajo): distinguir
     "ese email no existe" de "salió el mail" convierte esta pantalla en un
     verificador de qué clientes tenemos. */
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/auth/callback?next=${encodeURIComponent("/cuenta?nueva=1")}`,
  });

  redirect("/recuperar?enviado=1");
}
