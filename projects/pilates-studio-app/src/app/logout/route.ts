import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Cierra la sesión (limpia cookies) y redirige a /login. */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
