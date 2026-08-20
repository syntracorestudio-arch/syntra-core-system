"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { segmentoValido } from "@/lib/super-path";

export type EstadoAcceso = { error?: string };

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Entrada al panel de plataforma.
 *
 * TRES DIFERENCIAS DELIBERADAS con el login de los kioscos:
 *
 * 1 · EL FRENO ES FAIL-CLOSED. En toda la app el rate limiter es fail-open
 *     —"un limiter caído nunca puede tirar abajo la caja de un kiosco"— y está
 *     bien ahí. Acá se invierte: si el contador no responde, NO se deja pasar.
 *     El panel se usa una vez por semana, así que quedarse afuera unos minutos
 *     cuesta casi nada; en cambio un limiter caído con la credencial más
 *     valiosa del sistema y un solo factor es fuerza bruta sin techo.
 *
 * 2 · SE VERIFICA EL FLAG DESPUÉS DE AUTENTICAR, Y SI NO ES SUPERADMIN SE CIERRA
 *     LA SESIÓN. Sin esto, esta ruta sería un login alternativo para cualquier
 *     cliente: entraría con sus credenciales buenas y se llevaría una sesión
 *     válida desde una URL que no debería reconocerle nada. Se desloguea y se
 *     devuelve el MISMO error genérico que una clave mala — quien encuentre la
 *     ruta de casualidad no aprende que existe otra clase de cuenta.
 *
 * 3 · UN SOLO MENSAJE PARA TODO. Ni "ese email no existe", ni "no sos
 *     superadmin", ni "clave incorrecta". Cualquier distinción acá es un oráculo
 *     para enumerar cuentas de plataforma.
 */
export async function entrarAlPanel(
  clave: string,
  _prev: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  /* El segmento se re-valida en la acción y no sólo en la página: las server
     actions son endpoints POST propios, alcanzables sin pasar por el render.
     Sin esto, la ruta secreta protegería la vista pero no el login. */
  if (!segmentoValido(clave)) {
    return { error: "No pudimos entrar." };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "No pudimos entrar." };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cuenta = createHash("sha256").update(parsed.data.email.toLowerCase()).digest("hex");

  /* Mucho más apretado que el login de kioscos (30/5min por IP, 5/15min por
     cuenta): acá no hay un mostrador con tres empleados equivocándose, hay una
     persona que entra una vez por semana. */
  const [ipOk, cuentaOk] = await Promise.all([
    checkRateLimit(`panel:ip:${ip}`, 5, 1800),
    checkRateLimit(`panel:acct:${cuenta}`, 3, 1800),
  ]);
  if (!ipOk || !cuentaOk) {
    return { error: "Demasiados intentos. Probá más tarde." };
  }

  const supabase = await createSupabaseServer();
  const { data: sesion, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !sesion.user) {
    return { error: "No pudimos entrar." };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", sesion.user.id)
    .maybeSingle();

  if (!perfil?.is_superadmin) {
    /* Autenticó bien pero no le corresponde esta puerta: se deshace la sesión
       ANTES de contestar. Si sólo devolviéramos el error, la cookie ya estaría
       puesta y bastaría con navegar a otra ruta para quedar adentro. */
    await supabase.auth.signOut();
    return { error: "No pudimos entrar." };
  }

  redirect("/super");
}
