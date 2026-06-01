import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LeadInput, LeadStatus } from "@/lib/validations/lead";
import type { Lead } from "@/types";

/**
 * SYNTRA CORE — Lead Service.
 *
 * Capa de abstracción entre la lógica de negocio y la persistencia
 * (backend-architecture.md). Hoy: Supabase. Mañana: lo que haga falta,
 * sin tocar el Server Action ni el formulario.
 */

export type CreateLeadResult =
  | { ok: true; persisted: boolean; lead?: Lead }
  | { ok: false; error: string };

interface LeadMetadata {
  /** Origen del lead (ej. "website-home") */
  source?: string;
}

const LEADS_TABLE = "leads";

export async function createLead(
  input: LeadInput,
  meta: LeadMetadata = {},
): Promise<CreateLeadResult> {
  const record = {
    name: input.name,
    email: input.email,
    company: input.company?.length ? input.company : null,
    message: input.message,
    source: meta.source ?? "website",
  };

  if (!isSupabaseConfigured()) {
    // En producción NUNCA fingir éxito: el lead se perdería en silencio.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[lead-service] Supabase no configurado en producción — lead NO persistido.",
      );
      return { ok: false, error: "El servicio de contacto no está disponible." };
    }
    // Solo en desarrollo: fallback para poder probar el form sin DB local.
    // (No persiste ni hay id → no se dispara notificación.)
    console.warn(
      "[lead-service] ⚠️ DEV FALLBACK — Supabase no configurado, el lead NO se persiste:",
      record,
    );
    return { ok: true, persisted: false };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Servicio de leads no disponible." };
  }

  const { data, error } = await supabase
    .from(LEADS_TABLE)
    .insert(record)
    .select(LEAD_COLUMNS)
    .single();

  if (error) {
    console.error("[lead-service] Error al guardar lead:", error.message);
    return { ok: false, error: "No pudimos guardar tu mensaje." };
  }

  return { ok: true, persisted: true, lead: data as Lead };
}

// ============================================================
// Lectura y gestión de leads (panel interno — Sprint 3)
// ============================================================

export type ListLeadsResult =
  | { ok: true; leads: Lead[] }
  | { ok: false; error: string };

interface ListLeadsOptions {
  status?: LeadStatus;
  /** Orden por fecha de creación. */
  sort?: "recent" | "oldest";
  /** Máximo de filas a traer (default 200; paginación real es futura). */
  limit?: number;
}

const LEAD_COLUMNS = "id,name,email,company,message,source,status,created_at";

export async function listLeads(
  opts: ListLeadsOptions = {},
): Promise<ListLeadsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase no está configurado." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Servicio de datos no disponible." };
  }

  let query = supabase
    .from(LEADS_TABLE)
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: opts.sort === "oldest" })
    .limit(opts.limit ?? 200);

  if (opts.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[lead-service] Error al listar leads:", error.message);
    return { ok: false, error: "No pudimos cargar los leads." };
  }

  return { ok: true, leads: (data ?? []) as Lead[] };
}

export type GetLeadResult =
  | { ok: true; lead: Lead | null }
  | { ok: false; error: string };

export async function getLead(id: string): Promise<GetLeadResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase no está configurado." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Servicio de datos no disponible." };
  }

  const { data, error } = await supabase
    .from(LEADS_TABLE)
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[lead-service] Error al cargar lead:", error.message);
    return { ok: false, error: "No pudimos cargar el lead." };
  }

  return { ok: true, lead: (data as Lead | null) ?? null };
}

export type LeadCountsResult =
  | { ok: true; counts: Record<LeadStatus, number>; total: number }
  | { ok: false; error: string };

export async function getLeadCounts(): Promise<LeadCountsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase no está configurado." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Servicio de datos no disponible." };
  }

  // MVP: traemos solo la columna status y agregamos en memoria.
  // Futuro (a escala): count + group by vía RPC o vista materializada.
  const { data, error } = await supabase.from(LEADS_TABLE).select("status");
  if (error) {
    console.error("[lead-service] Error al contar leads:", error.message);
    return { ok: false, error: "No pudimos cargar las métricas." };
  }

  const counts: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  };
  for (const row of data ?? []) {
    const s = (row as { status: LeadStatus }).status;
    if (s in counts) counts[s] += 1;
  }

  return { ok: true, counts, total: (data ?? []).length };
}

export type UpdateLeadStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<UpdateLeadStatusResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase no está configurado." };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "Servicio de datos no disponible." };
  }

  const { error } = await supabase
    .from(LEADS_TABLE)
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[lead-service] Error al actualizar status:", error.message);
    return { ok: false, error: "No pudimos actualizar el estado." };
  }

  return { ok: true };
}
