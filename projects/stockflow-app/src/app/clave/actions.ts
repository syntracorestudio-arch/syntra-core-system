"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Cambio de la propia contraseña.
 *
 * Hasta la 049 esto no existía: la credencial de alta era la definitiva de cada
 * cliente para siempre. Es la mitad de la historia de recuperación — la otra
 * mitad (auto-servicio por email) llega en el bloque B.
 */

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Poné al menos 8 caracteres.")
      .max(72, "Máximo 72 caracteres."),
    /* Opcional: el empleado ve UN solo campo con «mostrar» (el repetir existe
       para cachar un typo que no ves; si lo ves, sobra). El dueño sí lo tiene
       porque todavía no hay `/recuperar` y un typo lo dejaría afuera. Cuando
       viene, tiene que coincidir. */
    repetir: z.string().optional(),
  })
  .refine((d) => d.repetir === undefined || d.password === d.repetir, {
    message: "Las dos no coinciden.",
    path: ["repetir"],
  });

export type ClaveState = { error?: string };

export async function cambiarMiClave(
  _prev: ClaveState,
  formData: FormData,
): Promise<ClaveState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    repetir: formData.get("repetir") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  }

  const supabase = await createSupabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    /* GoTrue rechaza reusar la misma contraseña; el resto son fallas de red. */
    return {
      error: error.message.toLowerCase().includes("different")
        ? "Tiene que ser distinta a la que te dimos."
        : "No pudimos guardarla. Probá de nuevo.",
    };
  }

  /* Recién acá se apaga el flag, y con una RPC: el usuario NO tiene UPDATE
     sobre `profiles` desde la 049 (era por donde se podía hacer superadmin). */
  const { error: eFlag } = await supabase.rpc("marcar_clave_cambiada");
  if (eFlag) return { error: "Guardamos la contraseña pero algo falló. Volvé a entrar." };

  redirect("/");
}
