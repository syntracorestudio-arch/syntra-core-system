import { z } from "zod";

/**
 * Variables de entorno de Supabase, validadas con Zod.
 * - Las `NEXT_PUBLIC_*` son públicas (van al browser) y se validan al importar.
 * - La `SERVICE_ROLE` es **server-only** y se valida de forma perezosa (`getServerEnv`),
 *   con guarda anti-browser, para que nunca se evalúe ni se filtre en el cliente.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

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
