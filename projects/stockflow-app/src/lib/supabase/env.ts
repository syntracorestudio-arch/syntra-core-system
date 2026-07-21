import { z } from "zod";

/**
 * Variables de entorno de Supabase, validadas con Zod.
 * - Las `NEXT_PUBLIC_*` son públicas (van al browser).
 * - La `SERVICE_ROLE` es **server-only**, validada de forma perezosa (`getServerEnv`)
 *   con guarda anti-browser, para que nunca se evalúe ni se filtre en el cliente.
 *
 * Sobre `isSupabaseConfigured`: mientras el proyecto de Supabase no exista (tanda 1A,
 * antes de 1B), la app debe poder levantarse igual para revisar la UI. En DESARROLLO
 * el middleware deja pasar y avisa por consola; en PRODUCCIÓN la falta de envs revienta
 * ruidosamente, que es lo correcto — nunca servir una app "protegida" sin auth real.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/** ¿Están las credenciales públicas de Supabase presentes y bien formadas? */
export const isSupabaseConfigured = parsed.success;

if (!parsed.success && process.env.NODE_ENV === "production") {
  throw new Error(
    "Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/**
 * Env público. Acceder a esto sin configurar lanza — de forma deliberada: si un
 * módulo necesita hablar con Supabase, no puede seguir sin credenciales.
 */
export const publicEnv: z.infer<typeof publicSchema> = parsed.success
  ? parsed.data
  : (new Proxy({} as z.infer<typeof publicSchema>, {
      get() {
        throw new Error(
          "Supabase no está configurado. Copiá .env.example a .env.local y completá las credenciales.",
        );
      },
    }) as z.infer<typeof publicSchema>);

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

/** Valida y devuelve el env server-only. Lanza si se invoca en el browser. */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv(): el entorno server-only no debe leerse en el browser.");
  }
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
