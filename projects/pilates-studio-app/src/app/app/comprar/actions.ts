"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioMpToken, mpPreference } from "@/lib/mercadopago";

function back(params: Record<string, string>): never {
  redirect(`/app/comprar?${new URLSearchParams(params).toString()}`);
}

/** Inicia el checkout online de un pack: crea la preferencia MP con la credencial del
 *  estudio, registra un intento `pending` y redirige al checkout de MercadoPago. */
export async function startCheckout(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/login");

  const passId = String(formData.get("passId") ?? "");
  const { data: pass } = await supabase
    .from("passes")
    .select("id, name, price, active")
    .eq("id", passId)
    .maybeSingle();
  if (!pass || !pass.active) return back({ error: "El pack no está disponible." });

  const token = await getStudioMpToken(member.studio_id as string);
  if (!token) return back({ error: "El estudio todavía no tiene el cobro online activo." });

  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const webhook = process.env.MP_WEBHOOK_URL; // pública (túnel) — se setea al probar Slice C

  const attemptId = crypto.randomUUID();
  let initPoint: string | null = null;
  let preferenceId: string | null = null;
  try {
    const pref = await mpPreference(token).create({
      body: {
        items: [
          {
            id: pass.id as string,
            title: pass.name as string,
            quantity: 1,
            unit_price: Number(pass.price),
            currency_id: "ARS",
          },
        ],
        external_reference: attemptId,
        metadata: {
          studio_id: member.studio_id,
          member_id: member.id,
          attempt_id: attemptId,
          pass_id: pass.id,
          concept: "pack",
        },
        back_urls: {
          success: `${origin}/app/comprar?status=ok`,
          failure: `${origin}/app/comprar?status=fail`,
          pending: `${origin}/app/comprar?status=pending`,
        },
        ...(webhook ? { notification_url: `${webhook}?studio=${member.studio_id}` } : {}),
      },
    });
    initPoint = pref.sandbox_init_point ?? pref.init_point ?? null;
    preferenceId = pref.id ?? null;
  } catch {
    return back({ error: "No se pudo iniciar el pago. Reintentá en unos minutos." });
  }
  if (!initPoint) return back({ error: "No se pudo iniciar el pago." });

  // Registrar el intento (server-only vía service-role; RLS no da INSERT a usuarios).
  const admin = createAdminClient();
  await admin.from("payment_attempts").insert({
    id: attemptId,
    studio_id: member.studio_id,
    member_id: member.id,
    concept: "pack",
    amount: Number(pass.price),
    status: "pending",
    provider: "mercadopago",
    preference_id: preferenceId,
    idempotency_key: attemptId,
    pass_id: pass.id,
  });

  redirect(initPoint);
}
