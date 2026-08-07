"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Clock,
  Check,
  Trash2,
  Bell,
  BellRing,
  X,
  LoaderCircle,
  CalendarPlus,
  CalendarClock,
  Tag,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { fechaCorta } from "@/lib/promos";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button } from "@/components/ui/button";
import {
  resolveExpiry,
  subscribeToPush,
  sendTestPush,
} from "./actions";
import { addExpiry } from "@/app/admin/configuracion/actions";
import { crearPromo } from "@/app/admin/promos/actions";

export type ExpiryRow = {
  id: string;
  productName: string;
  productEmoji: string | null;
  expiryDate: string;
  qty: number;
  daysLeft: number;
};

type Aviso = { tone: "ok" | "error"; text: string } | null;

/** Urgencia por días restantes. El color refuerza, pero el texto lo dice solo. */
function urgencia(days: number): { label: string; tone: "danger" | "warning" | "muted" } {
  if (days < 0) return { label: `venció hace ${Math.abs(days)} d.`, tone: "danger" };
  if (days === 0) return { label: "vence hoy", tone: "danger" };
  if (days === 1) return { label: "vence mañana", tone: "danger" };
  if (days <= 7) return { label: `en ${days} días`, tone: "warning" };
  return { label: `en ${days} días`, tone: "muted" };
}

export type ProductOption = { id: string; name: string; emoji: string | null };

/** Lo que necesita la franja de promo. Espejo parcial de `promos_sugeridas`. */
export type SugerenciaPromo = {
  expiry_id: string;
  product_id: string;
  name: string;
  sugerido: string | number;
  list_price: string | number;
  cost: string | number | null;
  expiry_date: string;
  aplicable: boolean;
  es_reescalon: boolean;
};

export function VencimientosClient({
  expiries,
  products,
  sugerencias,
  hoy,
  warningDays,
  canEdit,
  vapidPublicKey,
}: {
  expiries: ExpiryRow[];
  products: ProductOption[];
  sugerencias: SugerenciaPromo[];
  /** Hoy en la zona DEL NEGOCIO. Nunca `new Date()` del navegador. */
  hoy: string;
  warningDays: number;
  canEdit: boolean;
  vapidPublicKey: string | null;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [agregando, setAgregando] = useState(false);
  /* Lo que ya se puso en promo desde acá: la franja se reemplaza EN EL LUGAR
     en vez de navegar. El dueño estaba decidiendo sobre esta lista; sacarlo de
     acá le corta el hilo. */
  const [puestas, setPuestas] = useState<Map<string, number>>(new Map());
  const [pending, startTransition] = useTransition();

  const porVencimiento = new Map(sugerencias.map((s) => [s.expiry_id, s]));

  function resolver(id: string, resolution: "sold" | "wasted", qty: number) {
    startTransition(async () => {
      const res = await resolveExpiry(id, resolution, resolution === "wasted" ? qty : null);
      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }
      const base = resolution === "sold" ? "Marcado como vendido." : "Registrado como merma.";
      setAviso({
        tone: "ok",
        /* Resolver el lote cierra la promo que lo liquidaba: callarlo deja al
           dueño con un cartel de promo puesto y la caja cobrando el precio de
           lista. */
        text:
          res.promosTerminadas > 0
            ? `${base} La promo terminó y el precio vuelve al de siempre.`
            : base,
      });
    });
  }

  function ponerEnPromo(s: SugerenciaPromo) {
    startTransition(async () => {
      const precio = Number(s.sugerido);
      const r = await crearPromo({
        productId: s.product_id,
        promoPrice: precio,
        startsOn: hoy,
        endsOn: s.expiry_date,
        expiryId: s.expiry_id,
        origin: "sugerida",
        belowCostOk: false,
        reemplazar: s.es_reescalon,
      });
      if (!r.ok) {
        setAviso({ tone: "error", text: r.error });
        return;
      }
      setPuestas((m) => new Map(m).set(s.expiry_id, precio));
    });
  }

  const urgentes = expiries.filter((e) => e.daysLeft <= 7).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Vencimientos"
          subtitle={`${
            expiries.length === 0
              ? "No tenés nada por vencer."
              : `${expiries.length} pendiente${expiries.length === 1 ? "" : "s"}${
                  urgentes > 0 ? ` · ${urgentes} requiere${urgentes === 1 ? "" : "n"} atención` : ""
                }`
          } · te avisamos ${warningDays} ${warningDays === 1 ? "día" : "días"} antes`}
          icon={CalendarClock}
          art="vencimientos"
        >
          {canEdit && (
            <Button variant="secondary" className="bg-background/60" onClick={() => setAgregando(true)}>
              <CalendarPlus className="size-4" /> Cargar vencimiento
            </Button>
          )}
        </PageHeader>
      </div>

      <PushCard vapidPublicKey={vapidPublicKey} onAviso={setAviso} />

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {expiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="vencimientos" alt="Un calendario con un tilde" />
          <p className="text-sm font-medium">Todo al día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá la fecha de vencimiento cuando recibís mercadería y te avisamos antes.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {expiries.map((e) => {
            const u = urgencia(e.daysLeft);
              const sug = porVencimiento.get(e.id);
              const yaPuesta = puestas.get(e.id);
              const bajoCosto =
                sug != null && sug.cost !== null && Number(sug.sugerido) < Number(sug.cost);

              return (
              <li key={e.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Franja de promo: va ARRIBA y separada, nunca como tercer
                    botón. Las dos acciones de abajo son RESOLUCIONES ("ya pasó
                    esto"); poner una promo es preventivo y mezclarlos hace que
                    se toque el equivocado con apuro. */}
                {yaPuesta != null ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-secondary/50 px-4 py-2 text-xs">
                    <Tag className="size-3.5 shrink-0 text-info-ink" />
                    <span className="tabular">
                      En promo a {money(yaPuesta)} hasta el {fechaCorta(e.expiryDate)}
                    </span>
                    <Link
                      href="/admin/promos"
                      className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Ver en Promos
                    </Link>
                  </div>
                ) : sug ? (
                  bajoCosto ? (
                    /* Bajo costo no se resuelve de un toque: el segundo tap en
                       pesos necesita el contexto completo, y eso vive en Promos. */
                    <Link
                      href="/admin/promos"
                      className="flex w-full items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2 text-left text-xs transition-colors hover:bg-secondary"
                    >
                      <Tag className="size-3.5 shrink-0 text-info-ink" />
                      <span className="min-w-0 flex-1">
                        No se vende al ritmo actual · rebajarlo queda bajo costo
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => ponerEnPromo(sug)}
                      className="flex w-full cursor-pointer items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2 text-left text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Tag className="size-3.5 shrink-0 text-info-ink" />
                      {/* El precio en pesos y la fecha van SIEMPRE: sin los dos,
                          el tap es a ciegas y no se puede ofrecer de un toque. */}
                      <span className="tabular min-w-0 flex-1">
                        No se vende al ritmo actual · ponerlo a {money(Number(sug.sugerido))} hasta
                        el {fechaCorta(e.expiryDate)}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  )
                ) : null}

                <div className="flex items-start gap-3 p-4 pb-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg" aria-hidden>
                    {e.productEmoji ?? "📦"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.productName}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {e.qty} u. · {e.expiryDate}
                    </p>
                  </div>
                  {/* Ícono + texto: el color nunca informa solo (a11y, daltonismo) */}
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      u.tone === "danger" && "bg-danger/15 text-danger-ink ring-1 ring-danger/30",
                      u.tone === "warning" && "bg-warning/15 text-warning-ink ring-1 ring-warning/30",
                      u.tone === "muted" && "text-muted-foreground",
                    )}
                  >
                    <Clock className="size-3" />
                    {u.label}
                  </span>
                </div>

                <div className="flex gap-2 p-4 pt-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => resolver(e.id, "sold", e.qty)}
                    className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium transition-colors hover:border-success disabled:opacity-40"
                  >
                    <Check className="size-3.5" /> Se vendió
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => resolver(e.id, "wasted", e.qty)}
                    className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium transition-colors hover:border-danger hover:text-danger-ink disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" /> Tuve que tirarlo
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {agregando && (
        <AddExpiryDialog
          products={products}
          onClose={() => setAgregando(false)}
          onDone={() => {
            setAgregando(false);
            setAviso({ tone: "ok", text: "Vencimiento cargado. Te vamos a avisar a tiempo." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
        />
      )}
    </div>
  );
}

/**
 * Cargar vencimiento a mercadería que YA está en la góndola.
 * El camino normal es al recibir (ahí sabés qué lote entró); esto es para el
 * stock con el que el kiosquero arranca, que si no queda sin alerta posible.
 */
function AddExpiryDialog({
  products,
  onClose,
  onDone,
  onError,
}: {
  products: ProductOption[];
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [productId, setProductId] = useState("");
  const [fecha, setFecha] = useState("");
  const [qty, setQty] = useState("");
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await addExpiry({
        product_id: productId,
        expiry_date: fecha,
        qty: Number(qty),
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Cargar vencimiento</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="ae-prod" className="text-sm font-medium">
              ¿Qué producto?
            </label>
            <select
              id="ae-prod"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Elegí un producto</option>
              {/* Android corta el texto del select cerrado SIN puntos
                  suspensivos, así que un nombre de 62 caracteres se ve cortado a
                  la mitad y sin señal de que falta. Se recorta a 42 con "…": es
                  el mismo criterio defensivo que ya usa el import. */}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name.length > 42 ? `${p.name.slice(0, 42)}…` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="ae-fecha" className="text-sm font-medium">
                ¿Cuándo vence?
              </label>
              <input
                id="ae-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <label htmlFor="ae-qty" className="text-sm font-medium">
                ¿Cuántas?
              </label>
              <input
                id="ae-qty"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="6"
                className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={pending || !productId || !fecha || !qty}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Activación de los avisos al teléfono. */
function PushCard({
  vapidPublicKey,
  onAviso,
}: {
  vapidPublicKey: string | null;
  onAviso: (a: Aviso) => void;
}) {
  const [estado, setEstado] = useState<"cargando" | "no-soportado" | "off" | "on">("cargando");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
        setEstado("no-soportado");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();

      if (!sub) {
        setEstado("off");
        return;
      }

      /* AUTO-REPARACIÓN. El navegador puede tener una suscripción que nuestra
         base no tiene (se perdió la fila, se cambió de negocio, se restauró un
         backup). Si solo miráramos el navegador, la pantalla diría "activos" y
         no llegaría nada NUNCA, sin forma de re-activar: el botón no aparece.
         Al reenviarla en cada carga, ambos lados quedan sincronizados. El upsert
         es por endpoint, así que repetirlo no duplica. */
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh: string; auth: string };
      };
      const res = await subscribeToPush({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setEstado(res.ok ? "on" : "off");
    })().catch(() => setEstado("no-soportado"));
  }, [vapidPublicKey]);

  function activar() {
    if (!vapidPublicKey) return;
    startTransition(async () => {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          onAviso({ tone: "error", text: "Necesitamos permiso para avisarte." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
        const res = await subscribeToPush({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        });
        if (!res.ok) {
          onAviso({ tone: "error", text: res.error });
          return;
        }
        setEstado("on");
        // El resultado de la prueba SÍ se muestra: antes se ignoraba y el usuario
        // quedaba con "activado" sin que le llegara nunca nada.
        const prueba = await sendTestPush();
        onAviso(
          prueba.ok
            ? { tone: "ok", text: "Listo. Te mandamos un aviso de prueba al teléfono." }
            : { tone: "error", text: prueba.error },
        );
      } catch {
        onAviso({ tone: "error", text: "No pudimos activar los avisos en este dispositivo." });
      }
    });
  }

  if (estado === "cargando") return null;

  if (estado === "no-soportado") {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Este navegador no puede recibir avisos. Instalá StockFlow desde el teléfono para
          que te lleguen.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          estado === "on" ? "bg-success/15 text-success-ink" : "bg-accent text-accent-foreground",
        )}
      >
        {estado === "on" ? <BellRing className="size-5" /> : <Bell className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {estado === "on" ? "Los avisos están activos" : "Que el sistema te avise solo"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {estado === "on"
            ? "Te avisamos al teléfono cuando algo esté por vencer o te estés quedando sin stock."
            : "Activá las notificaciones y te avisamos antes de que pierdas plata."}
        </p>
      </div>
      {estado === "off" ? (
        <button
          type="button"
          onClick={activar}
          disabled={pending}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          Activar
        </button>
      ) : (
        /* Poder reenviar el aviso sin desactivar y volver a activar: es lo
           primero que uno quiere hacer cuando duda de si llegan. */
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await sendTestPush();
              onAviso(
                r.ok
                  ? { tone: "ok", text: "Aviso enviado. Fijate en el teléfono." }
                  : { tone: "error", text: r.error },
              );
            })
          }
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          Probar
        </button>
      )}
    </div>
  );
}

/**
 * La clave VAPID viaja en base64url; PushManager la quiere como bytes.
 * El buffer se crea explícito para que el tipo sea `Uint8Array<ArrayBuffer>`:
 * desde TS 5.7 `Uint8Array` es genérico sobre su buffer y `applicationServerKey`
 * no acepta uno que pudiera ser `SharedArrayBuffer`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
