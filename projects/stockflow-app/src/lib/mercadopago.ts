import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret";
import type { DireccionNegocio } from "@/lib/provincias";
import { geocodificar } from "@/lib/geocode";

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
  // Terminal Point vinculada (Cobros Fase 2). null = el negocio no configuró posnet.
  mpTerminalId: string | null;
};

/** Credencial descifrada del negocio, o null si no conectó su cuenta. */
export async function getStoreMpAuth(storeId: string): Promise<MpCredenciales | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("store_payment_providers")
    .select("access_token, webhook_secret, status, mp_user_id, external_pos_id, mp_terminal_id")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!data || data.status !== "connected" || !data.access_token) return null;

  try {
    let webhookSecret: string | null = null;
    if (data.webhook_secret) {
      try {
        webhookSecret = decryptSecret(data.webhook_secret as string);
      } catch {
        // Secreto ilegible (p.ej. MP_ENC_KEY cambió): se trata como no configurado,
        // pero NO en silencio — sin esto el webhook corre sin verificar firma para
        // ese negocio y nadie se entera. La verdad del pago igual se re-consulta a
        // MP, así que es defensa-en-profundidad, no un agujero de pago falso. T3.
        webhookSecret = null;
        console.error("[mercadopago] webhook_secret ilegible para store", storeId, "— firma sin verificar");
      }
    }
    return {
      token: decryptSecret(data.access_token as string),
      webhookSecret,
      mpUserId: String(data.mp_user_id),
      externalPosId: (data.external_pos_id as string | null) ?? null,
      mpTerminalId: (data.mp_terminal_id as string | null) ?? null,
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
      // Cota dura: MercadoPago puede colgarse, y `estadoCobro` se pollea cada 2,5 s
      // desde cada caja abierta. Sin timeout, un MP lento apila invocaciones
      // colgadas en el serverless hasta agotar el tiempo de plataforma. Fallar
      // rápido y que el poll reintente es mejor que quedarse esperando: el AbortError
      // cae en el catch de acá y devuelve el mismo "no pudimos conectarnos".
      signal: AbortSignal.timeout(8000),
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
    // MP devuelve el error en cualquiera de tres formas según el endpoint: `message`,
    // `error`, o un array `errors[]`. Sin contemplar el array, el fallback dumpeaba el
    // JSON crudo a la pantalla del cajero ("{"errors":[{"code":…").
    const m = json as
      | { message?: string; error?: string; errors?: { code?: string; message?: string }[] }
      | null;
    const detalle = m?.message ?? m?.error ?? m?.errors?.[0]?.message ?? texto.slice(0, 200);

    /* Los estados del REEMBOLSO que la doc documenta y que el dueño tiene que
       poder entender sin llamar a nadie. Sin esto lee el texto crudo de MP, que
       está en inglés y no le dice qué hacer. Sólo se traduce lo accionable: el
       resto sigue pasando el detalle de MP tal cual. */
    if (path.endsWith("/refund")) {
      if (res.status === 409) {
        return {
          ok: false,
          status: res.status,
          message: "Esa parte ya fue devuelta. Revisá el movimiento en tu cuenta de MercadoPago.",
        };
      }
      if (res.status === 422) {
        return {
          ok: false,
          status: res.status,
          message: "MercadoPago no permite devolver este pago (puede estar fuera de plazo o ya conciliado). Devolvelo desde tu cuenta.",
        };
      }
      if (res.status === 425 || res.status === 428) {
        return {
          ok: false,
          status: res.status,
          message: "El pago todavía se está acreditando. Esperá unos minutos y volvé a intentar.",
        };
      }
    }

    return { ok: false, status: res.status, message: detalle };
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

  /* Buscar antes de crear, en vez de crear y adivinar qué significa el error.
     Reconectar con un token nuevo es normal (rotación, recuperación de cuenta) y
     tiene que ser inofensivo. Interpretar mensajes de error para deducir "ah, ya
     existía" es frágil: cualquier cambio de redacción del lado de MP y el alta se
     rompe sin que nadie lo note. */

  // ---- Sucursal ----
  let sucursalId: number | null = await buscarSucursal(token, mpUserId, extStore);

  if (sucursalId === null) {
    // MP rechaza 0,0 explícitamente, así que las coordenadas hay que resolverlas.
    // `geocodificar` nunca falla: si el geocoder no responde, cae al centro de la
    // provincia. Nadie se queda sin cobrar porque OpenStreetMap esté caído.
    const coords = await geocodificar(direccion);

    const creada = await mpFetch<{ id: number }>(token, `/users/${mpUserId}/stores`, {
      method: "POST",
      body: {
        name: storeName.slice(0, 60),
        external_id: extStore,
        location: {
          street_name: direccion.calle,
          street_number: direccion.numero,
          city_name: direccion.ciudad,
          state_name: direccion.provincia,
          latitude: coords.latitude,
          longitude: coords.longitude,
          reference: storeName.slice(0, 60),
        },
      },
    });
    if (!creada.ok) {
      return { ok: false, error: `No pudimos crear la sucursal en MercadoPago: ${creada.message}` };
    }
    sucursalId = creada.data.id;
  }

  // ---- Caja ----
  const cajaExistente = await buscarCaja(token, extPos);
  if (cajaExistente !== null) {
    return { ok: true, externalStoreId: extStore, externalPosId: extPos, posId: String(cajaExistente) };
  }

  /* `store_id` numérico y no `external_store_id`: el endpoint de cajas no resuelve
     el id externo de la sucursal — responde "External store id does not refer any
     store" aunque la sucursal exista con ese mismo id. */
  const caja = await mpFetch<{ id: number }>(token, "/pos", {
    method: "POST",
    body: {
      name: `${storeName.slice(0, 40)} Caja`,
      external_id: extPos,
      store_id: sucursalId,
      fixed_amount: false, // el monto lo manda cada orden
      category: 621102, // "Alimentos y bebidas" — categoría genérica de comercio
    },
  });

  if (!caja.ok) {
    return { ok: false, error: `No pudimos crear la caja en MercadoPago: ${caja.message}` };
  }
  return { ok: true, externalStoreId: extStore, externalPosId: extPos, posId: String(caja.data.id) };
}

/** Id numérico de la sucursal con ese external_id, o null si no existe. */
async function buscarSucursal(
  token: string,
  mpUserId: string,
  extStore: string,
): Promise<number | null> {
  const res = await mpFetch<{ results?: { id: number; external_id?: string }[] }>(
    token,
    `/users/${mpUserId}/stores/search`,
  );
  if (!res.ok) return null;
  return res.data.results?.find((s) => s.external_id === extStore)?.id ?? null;
}

/** Id numérico de la caja con ese external_id, o null si no existe. */
async function buscarCaja(token: string, extPos: string): Promise<number | null> {
  const res = await mpFetch<{ results?: { id: number; external_id?: string }[] }>(
    token,
    `/pos?external_id=${encodeURIComponent(extPos)}`,
  );
  if (!res.ok) return null;
  return res.data.results?.find((p) => p.external_id === extPos)?.id ?? null;
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

/**
 * Cobro con terminal Point (Cobros Fase 2). Es la MISMA Orders API que el QR: solo
 * cambia `type: "point"` y `config.point.terminal_id` en lugar del bloque `qr`. El
 * monto viaja igual (decimal string) y el resultado se lee con `mpLeerOrden` /
 * `montoPagado` / `ordenAprobada` — los mismos helpers que el QR. Al crear la orden,
 * MercadoPago EMPUJA el monto a la pantalla de la terminal física; el cajero pasa la
 * tarjeta ahí. El binding H3 de monto real aplica idéntico: el pagador no digita el
 * importe, lo fija el sistema.
 *
 * `expiration_time` corto: si el cliente no termina de pagar en la terminal, la orden
 * expira y la caja se libera (igual que el QR que nadie escaneó).
 */
export async function mpCrearOrdenPoint(args: {
  token: string;
  terminalId: string;
  amount: number;
  externalReference: string;
  descripcion: string;
  /**
   * Tipo de tarjeta cuando el cobro es con posnet (Fase 3). Sin esto, la terminal
   * muestra el QR. NO mandamos cuotas ni interés a propósito: los define el dueño en
   * su cuenta de MercadoPago y la terminal los ofrece sola — así nunca ofrecemos una
   * cuota que MP no permite ni inventamos una tasa.
   */
  paymentType?: "credit_card" | "debit_card";
}): Promise<{ ok: true; orden: MpOrden } | { ok: false; error: string }> {
  const monto = args.amount.toFixed(2);

  const config: Record<string, unknown> = { point: { terminal_id: args.terminalId } };
  if (args.paymentType) config.payment_method = { default_type: args.paymentType };

  const res = await mpFetch<MpOrden>(args.token, "/v1/orders", {
    method: "POST",
    idempotencyKey: args.externalReference,
    body: {
      type: "point",
      total_amount: monto,
      description: args.descripcion.slice(0, 200),
      external_reference: args.externalReference,
      expiration_time: "PT5M",
      config,
      transactions: { payments: [{ amount: monto }] },
    },
  });

  if (!res.ok) return { ok: false, error: res.message };
  return { ok: true, orden: res.data };
}

/**
 * Cancela una orden (QR o Point). MercadoPago solo la deja cancelar mientras está
 * `created`; si ya está en la terminal (`at_terminal`) hay que cancelarla desde el
 * aparato. Por eso el error no es fatal: la UI cae a "cancelá desde la terminal".
 */
export async function mpCancelarOrden(
  token: string,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await mpFetch<MpOrden>(token, `/v1/orders/${orderId}/cancel`, {
    method: "POST",
    idempotencyKey: `cancel-${orderId}`,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.message };
}

/**
 * Reembolso TOTAL de una orden (una pata electrónica de un split a medio cobrar). Le
 * devuelve al cliente la plata de esa pata cuando se fue con una cobrada y la otra no.
 *
 * Es la Orders API (la misma superficie del cobro): `POST /v1/orders/{id}/refund` sin
 * body = reembolso total. `idempotencyKey` propio por pata → reintentar no devuelve dos
 * veces. Money-critical: validar en el sandbox de MercadoPago antes de habilitarlo en
 * producción (puede que el endpoint exacto sea `/v1/payments/{id}/refunds` según cuenta;
 * por eso el reembolso queda gateado hasta la prueba real).
 */
export async function mpReembolsarOrden(
  token: string,
  orderId: string,
  idempotencyKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  /* SIN `body`. La doc de MP es literal para el reembolso TOTAL: "the request
     body must be empty". Acá decía `body: {}` — y `{}` es TRUTHY en JS, así que
     `mpFetch` lo serializaba y mandaba el string "{}" como cuerpo. Si MP valida
     eso, el reembolso devuelve 400 y NO devuelve la plata nunca: el cliente
     esperando en el mostrador, la pata sigue `approved` y el dueño ve un error
     de MP sin explicación. Encontrado contrastando contra la doc oficial ANTES
     de tener sandbox (docs/mercadopago-sandbox-checklist.md). */
  const res = await mpFetch<MpOrden>(token, `/v1/orders/${orderId}/refund`, {
    method: "POST",
    idempotencyKey,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.message };
}

export type MpTerminal = {
  id: string;
  pos_id?: number | string;
  store_id?: number | string;
  external_pos_id?: string;
  operating_mode?: string;
};

/**
 * Terminales Point vinculadas a la cuenta MP del negocio. Para el selector de Ajustes:
 * el dueño elige cuál es su posnet. La respuesta de MP envuelve la lista en
 * `data.terminals`; se contempla también la forma plana por robustez.
 */
export async function mpListarTerminales(
  token: string,
): Promise<{ ok: true; terminales: MpTerminal[] } | { ok: false; error: string }> {
  const res = await mpFetch<{ data?: { terminals?: MpTerminal[] }; terminals?: MpTerminal[] }>(
    token,
    "/terminals/v1/list?limit=50&offset=0",
  );
  if (!res.ok) return { ok: false, error: res.message };
  const terminales = res.data.data?.terminals ?? res.data.terminals ?? [];
  return { ok: true, terminales };
}

/**
 * Pone la terminal en modo PDV (integrada al sistema) para que reciba órdenes. Sin
 * esto la terminal opera standalone y no acepta el push de monto. No es fatal si
 * falla: se puede dejar en modo PDV desde la app de MercadoPago; solo se registra.
 */
export async function mpSetTerminalPDV(
  token: string,
  terminalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await mpFetch(token, "/terminals/v1/setup", {
    method: "PATCH",
    body: { terminals: [{ id: terminalId, operating_mode: "PDV" }] },
  });
  return res.ok ? { ok: true } : { ok: false, error: res.message };
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

/**
 * Monto REALMENTE pagado: suma de los pagos acreditados de la orden. NO es
 * `total_amount` (ese es el monto que NOSOTROS pedimos, así que compararlo contra
 * nuestro propio intento siempre da igual — un no-op). Devuelve null si MP no trae
 * montos legibles: en ese caso el binding se apoya en que el QR es dinámico (el
 * pagador no puede alterar el monto codificado), no en un número que no leímos.
 */
export function montoPagado(orden: MpOrden): number | null {
  const acreditados = (orden.transactions?.payments ?? []).filter((p) =>
    ["processed", "approved", "accredited"].includes((p.status ?? "").toLowerCase()),
  );
  if (acreditados.length === 0) return null;
  let total = 0;
  for (const p of acreditados) {
    const monto = Number(p.amount);
    if (!Number.isFinite(monto)) return null; // dato incompleto → no afirmamos un monto
    total += monto;
  }
  return total;
}
