import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret";
import type { DireccionNegocio } from "@/lib/provincias";

/**
 * MercadoPago — cobro con QR, cuenta propia de cada negocio.
 *
 * SYNTRA no toca la plata: el token es del kiosquero y el dinero le entra a él.
 * Hablamos con la API por `fetch` y no por el SDK a propósito — la Orders API es
 * la superficie nueva y el SDK va por detrás; acá conviene ver los bytes.
 *
 * Este archivo es server-only por construcción: importa `createAdminClient` (que
 * revienta en el navegador) y solo lo consumen server actions y route handlers.
 * El token descifrado no puede existir en el cliente.
 */

const API = "https://api.mercadopago.com";

export type MpCredenciales = {
  token: string;
  webhookSecret: string | null;
  mpUserId: string;
  externalPosId: string | null;
};

/** Credencial descifrada del negocio, o null si no conectó su cuenta. */
export async function getStoreMpAuth(storeId: string): Promise<MpCredenciales | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("store_payment_providers")
    .select("access_token, webhook_secret, status, mp_user_id, external_pos_id")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!data || data.status !== "connected" || !data.access_token) return null;

  try {
    let webhookSecret: string | null = null;
    if (data.webhook_secret) {
      try {
        webhookSecret = decryptSecret(data.webhook_secret as string);
      } catch {
        webhookSecret = null; // secreto ilegible → lo tratamos como no configurado
      }
    }
    return {
      token: decryptSecret(data.access_token as string),
      webhookSecret,
      mpUserId: String(data.mp_user_id),
      externalPosId: (data.external_pos_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

type MpFetchOpts = { method?: string; body?: unknown; idempotencyKey?: string };

async function mpFetch<T>(
  token: string,
  path: string,
  opts: MpFetchOpts = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (opts.idempotencyKey) headers["X-Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, message: "No pudimos conectarnos con MercadoPago." };
  }

  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta no-JSON */
  }

  if (!res.ok) {
    const m = json as { message?: string; error?: string } | null;
    return { ok: false, status: res.status, message: m?.message ?? m?.error ?? texto.slice(0, 200) };
  }
  return { ok: true, data: json as T };
}

/** Quién es el dueño del token. Es la validación de que el token sirve. */
export async function mpQuienEs(token: string) {
  return mpFetch<{ id: number; nickname: string; site_id: string; email?: string }>(
    token,
    "/users/me",
  );
}

/**
 * `external_id` de MP solo admite letras y números — nada de guiones. El UUID del
 * negocio pelado sirve perfecto y mantiene la relación 1:1 sin tabla de mapeo.
 */
function externalId(prefijo: string, storeId: string): string {
  return `${prefijo}${storeId.replace(/-/g, "")}`.toUpperCase().slice(0, 40);
}

/**
 * Crea la sucursal y la caja en la cuenta MP del negocio.
 *
 * Es la diferencia entre "conectá tu cuenta" y "andá al panel de MercadoPago, creá
 * una sucursal, después una caja, copiá el external_id…". El kiosquero completa su
 * dirección una vez; el resto lo hacemos nosotros con su propia credencial.
 *
 * La dirección la pedimos de verdad y no la inventamos: MercadoPago usa la
 * ubicación de la sucursal para retenciones impositivas, así que llenarla con
 * guiones sería ensuciarle la cuenta al kiosquero con un problema que aparece
 * meses después.
 *
 * Idempotente: si ya existen (reconexión, token rotado), los reusa.
 */
export async function mpAsegurarCaja(
  token: string,
  mpUserId: string,
  storeId: string,
  storeName: string,
  direccion: DireccionNegocio,
): Promise<{ ok: true; externalStoreId: string; externalPosId: string; posId: string } | { ok: false; error: string }> {
  const extStore = externalId("ST", storeId);
  const extPos = externalId("POS", storeId);

  // ---- Sucursal ----
  const sucursal = await mpFetch<{ id: number }>(token, `/users/${mpUserId}/stores`, {
    method: "POST",
    body: {
      name: storeName.slice(0, 60),
      external_id: extStore,
      location: {
        street_name: direccion.calle,
        street_number: direccion.numero,
        city_name: direccion.ciudad,
        state_name: direccion.provincia,
        // MP exige coordenadas pero lo que usa para impuestos es la dirección de
        // arriba. Geocodificar para llenar un campo que no se mira sería sumar una
        // dependencia externa al alta a cambio de nada.
        latitude: 0,
        longitude: 0,
        reference: storeName.slice(0, 60),
      },
    },
  });

  // 400 con external_id repetido = ya la habíamos creado. No es un error.
  if (!sucursal.ok && !/already|exist|duplicad/i.test(sucursal.message)) {
    return { ok: false, error: `No pudimos crear la sucursal en MercadoPago: ${sucursal.message}` };
  }

  // ---- Caja ----
  const caja = await mpFetch<{ id: number; external_id: string }>(token, "/pos", {
    method: "POST",
    body: {
      name: `${storeName.slice(0, 40)} · Caja`,
      external_id: extPos,
      external_store_id: extStore,
      fixed_amount: false, // el monto lo manda cada orden
      category: 621102, // "Alimentos y bebidas" — categoría genérica de comercio
    },
  });

  if (caja.ok) {
    return { ok: true, externalStoreId: extStore, externalPosId: extPos, posId: String(caja.data.id) };
  }

  // Ya existía: la buscamos por external_id para quedarnos con su id.
  const existente = await mpFetch<{ results?: { id: number; external_id: string }[] }>(
    token,
    `/pos?external_id=${encodeURIComponent(extPos)}`,
  );
  const encontrada = existente.ok ? existente.data.results?.[0] : undefined;
  if (encontrada) {
    return {
      ok: true,
      externalStoreId: extStore,
      externalPosId: extPos,
      posId: String(encontrada.id),
    };
  }

  return { ok: false, error: `No pudimos crear la caja en MercadoPago: ${caja.message}` };
}

export type MpOrden = {
  id: string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  type_response?: { qr_data?: string };
  transactions?: { payments?: { id?: string; status?: string; amount?: string }[] };
};

/**
 * Pide a MP el QR con el monto exacto de esta venta.
 *
 * `expiration_time` corto a propósito: un QR de kiosco que sigue vivo veinte
 * minutos después es un QR que alguien puede pagar cuando el cliente ya se fue.
 */
export async function mpCrearOrdenQR(args: {
  token: string;
  externalPosId: string;
  amount: number;
  externalReference: string;
  descripcion: string;
}): Promise<{ ok: true; orden: MpOrden } | { ok: false; error: string }> {
  const monto = args.amount.toFixed(2);

  const res = await mpFetch<MpOrden>(args.token, "/v1/orders", {
    method: "POST",
    // La misma clave que la venta: si reintentamos, MP devuelve la MISMA orden en
    // lugar de crear un segundo cobro por el mismo carrito.
    idempotencyKey: args.externalReference,
    body: {
      type: "qr",
      total_amount: monto,
      description: args.descripcion.slice(0, 200),
      external_reference: args.externalReference,
      expiration_time: "PT10M",
      config: { qr: { external_pos_id: args.externalPosId, mode: "dynamic" } },
      transactions: { payments: [{ amount: monto }] },
    },
  });

  if (!res.ok) return { ok: false, error: res.message };
  if (!res.data.type_response?.qr_data) {
    return { ok: false, error: "MercadoPago no devolvió el código QR." };
  }
  return { ok: true, orden: res.data };
}

export async function mpLeerOrden(
  token: string,
  orderId: string,
): Promise<{ ok: true; orden: MpOrden } | { ok: false; error: string }> {
  const res = await mpFetch<MpOrden>(token, `/v1/orders/${orderId}`);
  return res.ok ? { ok: true, orden: res.data } : { ok: false, error: res.message };
}

/**
 * ¿Está pagada?
 *
 * La Orders API marca `processed` cuando el dinero se acreditó. Aceptamos también
 * los nombres del mundo viejo porque una cuenta puede responder con cualquiera de
 * los dos durante la transición, y equivocarse acá es cobrar dos veces o no cobrar.
 */
export function ordenAprobada(orden: MpOrden): boolean {
  const s = (orden.status ?? "").toLowerCase();
  if (["processed", "paid", "closed", "approved"].includes(s)) return true;
  return (orden.transactions?.payments ?? []).some((p) =>
    ["processed", "approved", "accredited"].includes((p.status ?? "").toLowerCase()),
  );
}

/** ¿Se cayó definitivamente? (para dejar de esperar y liberar la caja) */
export function ordenTerminada(orden: MpOrden): boolean {
  return ["expired", "cancelled", "canceled", "rejected", "refunded"].includes(
    (orden.status ?? "").toLowerCase(),
  );
}

/** Id del pago de MP dentro de la orden, para dejarlo asentado en el intento. */
export function idDePago(orden: MpOrden): string | null {
  return orden.transactions?.payments?.find((p) => p.id)?.id ?? null;
}
