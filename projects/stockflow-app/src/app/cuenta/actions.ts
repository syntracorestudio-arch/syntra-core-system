"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Cambiar la propia contraseña estando adentro.
 *
 * Es la gemela de `/clave`, con una diferencia que importa: `/clave` es un
 * trámite OBLIGATORIO de un solo uso (el flag `must_change_password`) y al
 * terminar te manda a trabajar. Esto es voluntario y repetible, así que vuelve
 * acá con una confirmación — si te devolviera al panel no sabrías si se guardó.
 *
 * También es el destino del link de recuperación: `/auth/callback` canjea el
 * token por sesión y aterriza acá con `?nueva=1`.
 */

const schema = z
  .object({
    password: z.string().min(8, "Poné al menos 8 caracteres.").max(72, "Máximo 72 caracteres."),
    repetir: z.string(),
  })
  .refine((d) => d.password === d.repetir, {
    message: "Las dos no coinciden.",
    path: ["repetir"],
  });

export type CuentaState = { error?: string };

export async function cambiarClaveDeCuenta(
  _prev: CuentaState,
  formData: FormData,
): Promise<CuentaState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    repetir: formData.get("repetir"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error: error.message.toLowerCase().includes("different")
        ? "Tiene que ser distinta a la actual."
        : "No pudimos guardarla. Probá de nuevo.",
    };
  }

  /* Si llegó por el link de recuperación, el flag de "cambiá la credencial de
     alta" puede seguir prendido: apagarlo acá evita que `requireSession` lo
     rebote a `/clave` a hacer lo que acaba de hacer. */
  await supabase.rpc("marcar_clave_cambiada");

  redirect("/cuenta?listo=1");
}
