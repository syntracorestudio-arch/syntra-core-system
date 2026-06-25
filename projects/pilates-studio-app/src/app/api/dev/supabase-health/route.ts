import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health check de conexión a Supabase — SOLO DESARROLLO.
 * Devuelve 404 en producción. Usa el cliente admin (server-only) y consulta
 * una tabla simple (studios). No devuelve secretos.
 *   GET /api/dev/supabase-health
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("studios")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const studiosCount = count ?? 0;
    return NextResponse.json({
      ok: true,
      projectRef: process.env.SUPABASE_PROJECT_REF ?? null, // ref público (está en la URL)
      studiosCount,
      seedDetected: studiosCount >= 1,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
