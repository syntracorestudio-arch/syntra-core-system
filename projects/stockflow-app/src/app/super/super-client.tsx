"use client";

import { useState, useTransition } from "react";
import {
  Store,
  Plus,
  X,
  LoaderCircle,
  Check,
  TriangleAlert,
  Copy,
  Pause,
  Play,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  crearNegocio,
  cambiarEstado,
  setAsistenteIA,
  marcarPagoSuscripcion,
  type AltaResult,
} from "./actions";
import { signOut } from "@/app/login/actions";
import { haceCuanto } from "@/app/admin/fiado/fiado-client";

export type Vertical = "kiosco" | "dietetica" | "petshop" | "otro";

/** Rubros del negocio. El label es cara-al-cliente; el value viaja a la DB. */
export const VERTICALES: { value: Vertical; label: string }[] = [
  { value: "kiosco", label: "Kiosco" },
  { value: "dietetica", label: "Dietética" },
  { value: "petshop", label: "Pet shop" },
  { value: "otro", label: "Otro" },
];

/**
 * El estado de cobranza, tal cual lo devuelve `estado_suscripcion` (057).
 *
 * Se tipa la UNIÓN y no un objeto con todo opcional: así el compilador obliga a
 * contemplar cada caso donde se lo consume. Un `estado: string` dejaría pasar
 * "debe" sin mostrar la deuda.
 */
export type Suscripcion =
  | { estado: "sin_suscripcion" }
  | { estado: "cancelada"; cancelada_el: string }
  | { estado: "prueba"; prueba_hasta: string; precio: number }
  | { estado: "al_dia"; precio: number; proximo_vencimiento: string }
  | {
      estado: "debe";
      precio: number;
      meses_impagos: number;
      desde: string;
      deuda: number;
      /* 058 · pagó algo pero no todo. "Te falta completar" no es "no pagaste",
         y quien levanta el teléfono necesita esa diferencia. */
      parcial: boolean;
      dias_de_atraso: number;
    };

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dueno: string | null;
  miembros: number;
  productos: number;
  ventas: number;
  ventas30d: number;
  ultimaVenta: string | null;
  createdAt: string;
  vertical: string;
  aiAssistant: boolean;
  suscripcion: Suscripcion;
};

export function SuperClient({
  stores,
  email,
}: {
  stores: StoreRow[];
  email: string | null;
}) {
  const [creando, setCreando] = useState(false);
  const [alta, setAlta] = useState<Extract<AltaResult, { ok: true }> | null>(null);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  /* 055 · ninguna mutación de este panel se ejecuta sin motivo: el botón abre
     este diálogo y la acción sale desde ahí. */
  const [pidiendoMotivo, setPidiendoMotivo] = useState<PedidoDeMotivo | null>(null);
  /* 057 · marcar un pago es un acto CONTABLE: abre diálogo, no se dispara de un
     click. Un pago marcado por error deja al cliente "al día" sin haber pagado
     y no hay forma de notarlo después. */
  const [cobrando, setCobrando] = useState<
    { storeId: string; nombre: string; sub: Suscripcion } | null
  >(null);

  const activos = stores.filter((s) => s.status === "active").length;

  /* 057 · las otras dos preguntas de la semana, arriba de todo.
     Se calculan acá y no en SQL porque son una suma sobre 10 filas que ya
     están en memoria: una RPC nueva para esto sería una consulta de más por
     cada visita, a cambio de nada. */
  /* "POR MES" y no "este mes", y la diferencia no es cosmética: el mes corriente
     de un cliente que debe está contado en las DOS cifras (acá y en la deuda).
     Con la etiqueta "este mes" al lado de "sin cobrar", leído rápido parece que
     entran las dos sumadas. "Por mes" dice lo que el número es: lo que factura
     el plan si todos pagan — o sea MRR, sin usar la sigla. */
  const porMes = stores.reduce(
    (t, s) => t + (s.suscripcion.estado === "al_dia" || s.suscripcion.estado === "debe"
      ? s.suscripcion.precio : 0),
    0,
  );
  const deudaTotal = stores.reduce(
    (t, s) => t + (s.suscripcion.estado === "debe" ? s.suscripcion.deuda : 0),
    0,
  );
  const enPrueba = stores.filter((s) => s.suscripcion.estado === "prueba").length;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              SF
            </div>
            <div>
              <p className="text-sm font-semibold">StockFlow · SYNTRA</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Salir
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Negocios</h1>
            <p className="text-sm text-muted-foreground">
              {stores.length === 0
                ? "Todavía no hay ninguno."
                : `${activos} activo${activos === 1 ? "" : "s"} de ${stores.length}`}
            </p>

            {/* Las dos cifras que se miran una vez por semana. Deliberadamente
                SIN gráfico: con 10 clientes un gráfico es decoración, y la
                decisión ("¿a quién llamo?") ya la resuelve el color de la fila.
                La deuda sólo aparece si existe — un "$0 de deuda" permanente
                enseña a ignorar ese renglón. */}
            {stores.length > 0 && (
              <p className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-foreground">{pesos(porMes)} por mes</span>
                {deudaTotal > 0 && (
                  <span className="text-danger-ink">· {pesos(deudaTotal)} sin cobrar</span>
                )}
                {enPrueba > 0 && (
                  <span className="text-muted-foreground">
                    · {enPrueba} en prueba
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Dar de alta un kiosco
          </button>
        </div>

        {aviso && (
          <div
            role="status"
            className={cn(
              "mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
              aviso.tone === "ok"
                ? "bg-success/10 text-success-ink ring-success/25"
                : "bg-danger/10 text-danger-ink ring-danger/25",
            )}
          >
            {aviso.tone === "ok" ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="flex-1">{aviso.text}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="cursor-pointer opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <Store className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Ningún negocio todavía</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Dale de alta al primero y pasale las credenciales.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {stores.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {s.name}
                    {s.status !== "active" && (
                      <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger-ink ring-1 ring-danger/30">
                        suspendido
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.dueno ?? "sin dueño"} · /{s.slug}
                  </p>
                </div>
                <div className="tabular flex shrink-0 gap-4 text-xs text-muted-foreground">
                  <span>{s.productos} prod.</span>
                  {/* 057 · ventas de los ÚLTIMOS 30 DÍAS y no el acumulado
                      histórico: "1347 ventas" no distingue a un cliente activo
                      de uno que vendió mucho hace un año, que es justo la
                      diferencia que hay que ver acá. */}
                  <span>{s.ventas30d} en 30d</span>
                  {/* La última venta es el pulso real: un kiosco que no vende
                      hace una semana dejó de usar el sistema. */}
                  <span
                    className={cn(
                      s.ultimaVenta === null && "text-danger-ink",
                    )}
                  >
                    {s.ultimaVenta ? haceCuanto(s.ultimaVenta) : "nunca vendió"}
                  </span>
                </div>

                <EstadoCobranza
                  sub={s.suscripcion}
                  onMarcarPago={() =>
                    setCobrando({ storeId: s.id, nombre: s.name, sub: s.suscripcion })
                  }
                  pending={pending}
                />
                {/* Add-on del Asistente IA: prender/apagar por negocio. Es el flag
                    que decide si el negocio entra al reporte mensual (cron PR2). */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.aiAssistant}
                  disabled={pending}
                  /* 055 · ya no ejecuta: abre el diálogo que pide el motivo. El
                     motivo no es burocracia — es lo que el DUEÑO va a leer en
                     su pantalla para entender qué le pasó a su negocio. */
                  onClick={() =>
                    setPidiendoMotivo({
                      storeId: s.id,
                      nombre: s.name,
                      tipo: "ia",
                      valor: !s.aiAssistant,
                    })
                  }
                  aria-label={
                    s.aiAssistant
                      ? `Apagar Asistente IA en ${s.name}`
                      : `Activar Asistente IA en ${s.name}`
                  }
                  title="Asistente IA"
                  className={cn(
                    "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors disabled:opacity-40",
                    s.aiAssistant
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Sparkles className="size-3.5" />
                  IA
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setPidiendoMotivo({
                      storeId: s.id,
                      nombre: s.name,
                      tipo: "estado",
                      valor: s.status !== "active",
                    })
                  }
                  aria-label={s.status === "active" ? `Suspender ${s.name}` : `Reactivar ${s.name}`}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  {s.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creando && (
        <AltaDialog
          onClose={() => setCreando(false)}
          onDone={(r) => {
            setCreando(false);
            setAlta(r);
          }}
        />
      )}

      {alta && <CredencialesDialog alta={alta} onClose={() => setAlta(null)} />}

      {cobrando && (
        <DialogoDePago
          nombre={cobrando.nombre}
          sub={cobrando.sub}
          pending={pending}
          onCancelar={() => setCobrando(null)}
          onConfirmar={(periodo, monto, nota) => {
            startTransition(async () => {
              const r = await marcarPagoSuscripcion(cobrando.storeId, periodo, monto, nota);
              setCobrando(null);
              setAviso(
                r.ok
                  ? { tone: "ok", text: `Pago de ${cobrando.nombre} registrado.` }
                  : { tone: "error", text: r.error ?? "No se pudo registrar." },
              );
            });
          }}
        />
      )}

      {pidiendoMotivo && (
        <DialogoDeMotivo
          pedido={pidiendoMotivo}
          pending={pending}
          onCancelar={() => setPidiendoMotivo(null)}
          onConfirmar={(motivo) => {
            const p = pidiendoMotivo;
            startTransition(async () => {
              const r =
                p.tipo === "estado"
                  ? await cambiarEstado(p.storeId, p.valor ? "active" : "suspended", motivo)
                  : await setAsistenteIA(p.storeId, p.valor, motivo);

              setPidiendoMotivo(null);
              if (!r.ok) {
                setAviso({ tone: "error", text: r.error ?? "No se pudo completar." });
                return;
              }
              setAviso({
                tone: "ok",
                text:
                  p.tipo === "estado"
                    ? p.valor
                      ? `${p.nombre} está activo de nuevo.`
                      : `${p.nombre} quedó suspendido.`
                    : p.valor
                      ? `Asistente IA activado en ${p.nombre}.`
                      : `Asistente IA apagado en ${p.nombre}.`,
              });
            });
          }}
        />
      )}
    </div>
  );
}

function AltaDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (r: Extract<AltaResult, { ok: true }>) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [accent, setAccent] = useState("#2E6BFF");
  const [vertical, setVertical] = useState<Vertical>("kiosco");
  const [aiAssistant, setAiAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** El slug se propone solo desde el nombre; si lo tocan, se respeta. */
  function onNombre(v: string) {
    setName(v);
    if (!slugTocado) {
      setSlug(
        v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      );
    }
  }

  function guardar() {
    startTransition(async () => {
      const res = await crearNegocio({
        name,
        slug,
        ownerEmail,
        ownerName: ownerName || null,
        accent: accent || null,
        vertical,
        aiAssistant,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(res);
    });
  }

  return (
    <Dialog title="Dar de alta un kiosco" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
            {error}
          </p>
        )}

        <Campo id="sa-name" label="¿Cómo se llama el kiosco?">
          <input
            id="sa-name"
            value={name}
            onChange={(e) => onNombre(e.target.value)}
            autoFocus
            placeholder="Kiosco El Trébol"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <Campo id="sa-slug" label="Dirección" hint="Se usa en el link del negocio.">
          <input
            id="sa-slug"
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <div className="flex gap-2">
          <div className="flex-1">
            <Campo id="sa-oname" label="Nombre del dueño">
              <input
                id="sa-oname"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jorge"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Campo>
          </div>
          <div className="w-24">
            <Campo id="sa-accent" label="Color">
              <input
                id="sa-accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-1"
              />
            </Campo>
          </div>
        </div>

        <Campo id="sa-email" label="Email del dueño" hint="Con este email va a entrar a la app.">
          <input
            id="sa-email"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="jorge@gmail.com"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Campo>

        <Campo id="sa-vertical" label="Rubro" hint="Ajusta el vocabulario y los umbrales del asistente.">
          <select
            id="sa-vertical"
            value={vertical}
            onChange={(e) => setVertical(e.target.value as Vertical)}
            className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {VERTICALES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </Campo>

        {/* Add-on pago: el asistente que manda el reporte mensual por email. */}
        <button
          type="button"
          role="switch"
          aria-checked={aiAssistant}
          onClick={() => setAiAssistant((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md transition-colors",
              aiAssistant ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Asistente IA</span>
            <span className="block text-xs text-muted-foreground">
              Reporte mensual del negocio por email. Add-on pago.
            </span>
          </span>
          <span
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              aiAssistant ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                aiAssistant ? "left-[18px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={guardar}
          disabled={pending || !name.trim() || !slug || !ownerEmail}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Crear el negocio
        </button>
      </div>
    </Dialog>
  );
}

/** Las credenciales se muestran UNA vez: la contraseña no se guarda en claro. */
function CredencialesDialog({
  alta,
  onClose,
}: {
  alta: Extract<AltaResult, { ok: true }>;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = `StockFlow — ${alta.store}\nEntrá con:\nEmail: ${alta.email}\nContraseña: ${alta.password}`;

  return (
    <Dialog title={`${alta.store} está listo`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Pasale estos datos al dueño. La contraseña es temporal y{" "}
          <strong className="text-foreground">no la vas a poder ver de nuevo</strong>.
        </p>

        <dl className="space-y-2 rounded-lg border border-border bg-background p-3">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="text-sm font-medium">{alta.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contraseña temporal</dt>
            <dd className="tabular text-lg font-semibold">{alta.password}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(texto);
            setCopiado(true);
          }}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Copiado" : "Copiar para mandarle"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-full cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Ya se lo pasé
        </button>
      </div>
    </Dialog>
  );
}

function Campo({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Qué acción está esperando su motivo. */
type PedidoDeMotivo = {
  storeId: string;
  nombre: string;
  tipo: "estado" | "ia";
  /** Estado al que se va: suspendido→activo, IA on/off. */
  valor: boolean;
};

/**
 * El motivo, tipeado a mano, antes de tocar el negocio de un cliente.
 *
 * No es un confirm con un campo: el texto que se escribe acá lo LEE EL DUEÑO
 * en su pantalla. Por eso el placeholder muestra un motivo de verdad y no
 * "razón", y por eso el mínimo son 10 caracteres — "test" no le explica a
 * nadie por qué se quedó sin caja un martes.
 */
function DialogoDeMotivo({
  pedido,
  onCancelar,
  onConfirmar,
  pending,
}: {
  pedido: PedidoDeMotivo;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
  pending: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const suficiente = motivo.trim().length >= 10;

  const titulo =
    pedido.tipo === "estado"
      ? pedido.valor
        ? "Reactivar " + pedido.nombre
        : "Suspender " + pedido.nombre
      : pedido.valor
        ? "Activar el Asistente IA en " + pedido.nombre
        : "Desactivar el Asistente IA en " + pedido.nombre;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      {/* Este diálogo tiene un `textarea`, así que el teclado se abre SÍ O SÍ.
          Medido a 360 con el teclado puesto (viewport útil 350px): el diálogo
          entero medía 377px y "Confirmar" caía en 484 — inalcanzable, y sin
          confirmar el negocio no se suspende.
          Acotarlo no alcanzaba: con `max-h` el contenido entra pero el botón
          queda ABAJO DEL SCROLL. Por eso el cuerpo scrollea y las acciones van
          fijas al pie — que es la regla del responsive-audit para hojas, no una
          invención. */}
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {pedido.tipo === "estado" && !pedido.valor && (
          /* Se dice lo que realmente pasa: suspender apaga la caja de un
             comercio que puede estar abierto con gente esperando. */
          <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
            Deja de poder vender. Si está abierto, se entera en la próxima venta.
          </p>
        )}
        <label htmlFor="motivo" className="mt-4 block text-sm font-medium">
          ¿Por qué?
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Esto lo va a leer el dueño en su cuenta.
        </p>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Falta de pago de la cuota de agosto, avisado por WhatsApp el 12."
          className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {suficiente ? "Listo." : "Faltan " + (10 - motivo.trim().length) + " caracteres."}
        </p>

        </div>

        {/* Fijas al pie: se ven siempre, con el teclado abierto o cerrado. */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-popover px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 cursor-pointer rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!suficiente || pending}
            onClick={() => onConfirmar(motivo.trim())}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pesos sin centavos: los montos de suscripción son redondos. */
function pesos(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/**
 * El estado de cobranza de un negocio, en la fila del panel.
 *
 * Es la primera de las tres preguntas de la semana ("¿quién me debe?"), así que
 * tiene que leerse SIN hacer click. El color no es decoración: es el criterio de
 * acción — rojo se reclama hoy, ámbar se mira, verde no se toca.
 */
function EstadoCobranza({
  sub,
  onMarcarPago,
  pending,
}: {
  sub: Suscripcion;
  onMarcarPago: () => void;
  pending: boolean;
}) {
  /* `sin_suscripcion` no se pinta de rojo: es un negocio al que todavía no se le
     armó el contrato, no uno que deba plata. Confundirlos haría que el panel
     grite por algo que se resuelve en 10 segundos. */
  if (sub.estado === "sin_suscripcion") {
    return (
      <span className="shrink-0 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
        sin plan
      </span>
    );
  }

  if (sub.estado === "cancelada") {
    return (
      <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
        de baja
      </span>
    );
  }

  if (sub.estado === "prueba") {
    return (
      <span
        className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary ring-1 ring-primary/25"
        title={`Gratis hasta el ${sub.prueba_hasta}`}
      >
        prueba
      </span>
    );
  }

  if (sub.estado === "al_dia") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={onMarcarPago}
        title="Marcar un pago"
        className="shrink-0 cursor-pointer rounded-md bg-success/10 px-2 py-1 text-xs text-success-ink ring-1 ring-success/25 transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        al día
      </button>
    );
  }

  /* Debe. Se muestran las DOS cosas que deciden qué hacer: cuánto y desde hace
     cuánto. "Debe $120.000" sin el tiempo no dice si hay que llamar o esperar;
     "45 días" sin el monto no dice si vale la pena. */
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onMarcarPago}
      title={
        (sub.parcial ? "Pagó una parte. " : "") +
        `${sub.meses_impagos} mes(es) sin saldar, desde ${sub.desde}`
      }
      className={cn(
        "shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium ring-1 transition-opacity hover:opacity-80 disabled:opacity-40",
        /* Un parcial no es un moroso: pagó, le falta. Mismo dato, otra llamada. */
        sub.parcial
          ? "bg-warning/10 text-warning-ink ring-warning/30"
          : "bg-danger/10 text-danger-ink ring-danger/30",
      )}
    >
      {sub.parcial ? "falta" : "debe"} {pesos(sub.deuda)} · {sub.dias_de_atraso}d
    </button>
  );
}

/**
 * Marcar el pago de un mes.
 *
 * Dos decisiones de diseño que evitan errores caros:
 *
 * 1 · El PERÍODO viene pre-elegido con el mes más viejo impago, no con el mes
 *     actual. Es lo que uno quiere el 95% de las veces —se cobra la deuda más
 *     vieja primero— y si se dejara el actual, marcar un pago con dos meses
 *     debidos saldaría el mes equivocado sin que nadie lo note.
 *
 * 2 · El MONTO viene con el precio del plan, editable. Un cliente puede pagar de
 *     menos y eso hay que poder asentarlo tal cual: forzar el monto exacto
 *     obligaría a mentirle a la base para que cierre.
 */
function DialogoDePago({
  nombre,
  sub,
  onCancelar,
  onConfirmar,
  pending,
}: {
  nombre: string;
  sub: Suscripcion;
  onCancelar: () => void;
  onConfirmar: (periodo: string, monto: number, nota?: string) => void;
  pending: boolean;
}) {
  /* 058 · se propone lo que FALTA del mes más viejo, no el precio entero: si
     ya pagó una parte, ofrecer el total lleva derecho al error
     `monto_excede_lo_adeudado`. */
  const precio = sub.estado === "debe" ? Math.min(sub.deuda, sub.precio) : "precio" in sub ? sub.precio : 0;
  const sugerido = sub.estado === "debe" ? sub.desde : new Date().toISOString().slice(0, 8) + "01";

  const [periodo, setPeriodo] = useState(sugerido);
  const [monto, setMonto] = useState(String(Math.round(precio)));
  const [nota, setNota] = useState("");

  const montoNum = Number(monto);
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(periodo) && Number.isFinite(montoNum) && montoNum >= 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-popover">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-semibold">Registrar pago · {nombre}</h2>
          {sub.estado === "debe" && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
              Debe {sub.meses_impagos} mes{sub.meses_impagos === 1 ? "" : "es"} desde {sub.desde}.
              Se salda el más viejo primero.
            </p>
          )}

          <label htmlFor="periodo" className="mt-4 block text-sm font-medium">
            Mes que paga
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            El mes que queda saldado, no la fecha en que transfirió.
          </p>
          <input
            id="periodo"
            type="date"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />

          <label htmlFor="monto" className="mt-4 block text-sm font-medium">
            Monto
          </label>
          <input
            id="monto"
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="tabular w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />

          <label htmlFor="nota-pago" className="mt-4 block text-sm font-medium">
            Nota <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="nota-pago"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Transferencia del 12/09, comprobante 4471"
            className="w-full rounded-lg border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-popover px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancelar}
            className="h-10 cursor-pointer rounded-lg border border-border px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido || pending}
            onClick={() => onConfirmar(periodo, montoNum, nota.trim() || undefined)}
            className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
