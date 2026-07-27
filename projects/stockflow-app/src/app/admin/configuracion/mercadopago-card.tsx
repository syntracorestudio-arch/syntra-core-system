"use client";

import { useState, useTransition } from "react";
import {
  Check,
  LoaderCircle,
  TriangleAlert,
  QrCode,
  Copy,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  conectarMercadoPago,
  crearCajaMercadoPago,
  guardarFirmaWebhook,
  desconectarMercadoPago,
  listarTerminales,
  configurarPosnet,
  type EstadoMp,
  type TerminalOpcion,
} from "./mercadopago-actions";
import { PROVINCIAS_MP } from "@/lib/provincias";

/**
 * Conexión de la cuenta de MercadoPago del negocio.
 *
 * El texto insiste en una cosa porque es la que genera desconfianza: la plata va
 * DIRECTO a su cuenta. SYNTRA no intermedia fondos ni cobra comisión por transacción.
 */
export function MercadoPagoCard({ estado }: { estado: EstadoMp }) {
  const [token, setToken] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [firma, setFirma] = useState("");
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  function correr(fn: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const r = await fn();
      setAviso(r.ok ? { tone: "ok", text: r.mensaje } : { tone: "error", text: r.error });
      if (r.ok) {
        setToken("");
        setFirma("");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <QrCode className="mt-0.5 size-5 shrink-0 text-primary-ink" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Cobrar con QR</h2>
          <p className="text-sm text-muted-foreground">
            El cliente escanea desde la caja y el sistema marca la venta como cobrada solo. La
            plata va directo a tu cuenta de MercadoPago — no pasa por nosotros.
          </p>
        </div>
      </div>

      {aviso && (
        <p
          role="status"
          className={cn(
            "mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
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
          {aviso.text}
        </p>
      )}

      {!estado.cifradoListo && (
        <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink ring-1 ring-warning/25">
          Falta configurar el servidor (MP_ENC_KEY). Hasta que esté, no guardamos credenciales:
          preferimos no aceptar tu token antes que guardarlo sin cifrar.
        </p>
      )}

      {estado.conectado ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="size-2 shrink-0 rounded-full bg-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                Conectado{estado.nickname ? ` como ${estado.nickname}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {estado.cajaLista
                  ? "Caja creada en tu MercadoPago. Ya podés cobrar con QR."
                  : "Falta crear la caja en MercadoPago. Completá tu dirección acá abajo."}
              </p>
            </div>
          </div>

          {/* Conectado pero sin caja: se resuelve acá mismo, sin volver a pedir el
              token. Antes este estado no tenía salida — el formulario del token ya
              no se muestra y no quedaba ningún botón que tocar. */}
          {!estado.cajaLista && (
            <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <CamposDireccion
                calle={calle}
                numero={numero}
                ciudad={ciudad}
                provincia={provincia}
                setCalle={setCalle}
                setNumero={setNumero}
                setCiudad={setCiudad}
                setProvincia={setProvincia}
                disabled={false}
              />
              <button
                type="button"
                disabled={
                  pending || !calle.trim() || !numero.trim() || !ciudad.trim() || !provincia
                }
                onClick={() =>
                  correr(() => crearCajaMercadoPago({ calle, numero, ciudad, provincia }))
                }
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                Crear la caja
              </button>
            </div>
          )}

          {/* Firma del webhook: opcional, pero es lo que impide que un tercero nos
              avise "te pagaron" cuando nadie pagó. */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm">
              <span className="font-medium">Avisos de MercadoPago</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {estado.tieneFirma ? "· firma configurada" : "· recomendado"}
              </span>
            </summary>
            <div className="space-y-2 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                En tu panel de MercadoPago → Tus integraciones → Webhooks, pegá esta dirección y
                copiá acá la clave secreta que te dan.
              </p>
              {estado.urlWebhook ? (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2 py-1.5 text-xs">
                    {estado.urlWebhook}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(estado.urlWebhook!);
                      setCopiado(true);
                    }}
                    aria-label="Copiar dirección"
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  >
                    {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-warning-ink">
                  Falta NEXT_PUBLIC_APP_URL en el servidor para armar la dirección.
                </p>
              )}
              <input
                value={firma}
                onChange={(e) => setFirma(e.target.value)}
                placeholder="Clave secreta del webhook"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={pending || firma.trim().length < 8}
                onClick={() => correr(() => guardarFirmaWebhook({ secret: firma }))}
                className="h-9 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-40"
              >
                Guardar clave
              </button>
            </div>
          </details>

          {/* Terminal Point (posnet): opcional. Solo tiene sentido con la caja lista.
              Si el negocio la configura, la caja pregunta "terminal o QR en pantalla"
              al cobrar con MercadoPago. */}
          {estado.cajaLista && <PosnetConfig estado={estado} />}

          <button
            type="button"
            disabled={pending}
            onClick={() => correr(desconectarMercadoPago)}
            className="cursor-pointer text-sm text-danger-ink transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Desconectar la cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="mp-token" className="text-sm font-medium">
            Tu Access Token de MercadoPago
          </label>
          <input
            id="mp-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="APP_USR-…"
            autoComplete="off"
            disabled={!estado.cifradoListo}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-40"
          />
          <p className="text-xs text-muted-foreground">
            Lo sacás de tu panel de MercadoPago, en Tus integraciones → tu aplicación →
            Credenciales de producción. Lo guardamos cifrado y no vuelve a mostrarse.
          </p>

          <CamposDireccion
            calle={calle}
            numero={numero}
            ciudad={ciudad}
            provincia={provincia}
            setCalle={setCalle}
            setNumero={setNumero}
            setCiudad={setCiudad}
            setProvincia={setProvincia}
            disabled={!estado.cifradoListo}
          />
          <a
            href="https://www.mercadopago.com.ar/developers/panel/app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary-ink hover:underline"
          >
            Abrir el panel de MercadoPago <ExternalLink className="size-3" />
          </a>
          <button
            type="button"
            disabled={
              pending ||
              token.trim().length < 20 ||
              !estado.cifradoListo ||
              !calle.trim() ||
              !numero.trim() ||
              !ciudad.trim() ||
              !provincia
            }
            onClick={() =>
              correr(() =>
                conectarMercadoPago({
                  accessToken: token,
                  calle,
                  numero,
                  ciudad,
                  provincia,
                }),
              )
            }
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            Conectar mi cuenta
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Configuración de la terminal Point (posnet).
 *
 * Prende el cobro con tarjeta en la terminal física: al cobrar con MercadoPago, la
 * caja pregunta si va a la terminal o al QR en pantalla — y esa misma pregunta sirve
 * de salida si la terminal se traba (un toque → QR). El id de terminal se busca en la
 * cuenta del negocio con su propio token; no se tipea de memoria.
 */
function PosnetConfig({ estado }: { estado: EstadoMp }) {
  const [on, setOn] = useState(estado.hasPosnet);
  const [terminalId, setTerminalId] = useState(estado.terminalId ?? "");
  const [terminales, setTerminales] = useState<TerminalOpcion[] | null>(null);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const r = await listarTerminales();
      if (r.ok) {
        setTerminales(r.terminales);
        if (r.terminales.length === 0) {
          setAviso({ tone: "error", text: "No encontramos terminales Point en tu cuenta de MercadoPago." });
        } else {
          setAviso(null);
          // Preseleccionar la única, o mantener la ya guardada si sigue en la lista.
          if (!terminalId && r.terminales.length === 1) setTerminalId(r.terminales[0].id);
        }
      } else {
        setAviso({ tone: "error", text: r.error });
      }
    });
  }

  function guardar() {
    startTransition(async () => {
      const r = await configurarPosnet({
        hasPosnet: on,
        terminalId: on ? terminalId || null : null,
      });
      setAviso(r.ok ? { tone: "ok", text: r.mensaje } : { tone: "error", text: r.error });
    });
  }

  return (
    <details className="rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
        <CreditCard className="size-4 shrink-0 text-primary-ink" />
        <span className="font-medium">Cobrar con la terminal (posnet)</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {estado.hasPosnet && estado.terminalId ? "· activa" : "· opcional"}
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Si tenés una terminal Point de MercadoPago, la caja la usa para cobrar con QR y con
          tarjeta: al cobrar con QR te pregunta si va al posnet o a la pantalla, y con tarjeta si es
          débito o crédito. Le mandamos el monto exacto — nadie lo tipea, y las cuotas las maneja tu
          cuenta de MP. Si se traba, seguís cobrando en el acto.
        </p>

        {aviso && (
          <p
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
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
            {aviso.text}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Tengo terminal Point</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Cobrar con terminal Point"
            onClick={() => setOn((v) => !v)}
            className={cn(
              "flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
              on ? "bg-primary" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-foreground transition-transform",
                on && "translate-x-5",
              )}
            />
          </button>
        </div>

        {on && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={pending}
              onClick={buscar}
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium transition-colors hover:border-primary disabled:opacity-40"
            >
              {pending && <LoaderCircle className="size-4 animate-spin" />}
              Buscar mis terminales
            </button>

            {terminales && terminales.length > 0 && (
              <select
                aria-label="Terminal Point"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Elegí tu terminal</option>
                {terminales.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            )}

            {/* Si ya hay una guardada y todavía no buscó, mostrarla para que sepa cuál es. */}
            {!terminales && estado.terminalId && (
              <p className="text-xs text-muted-foreground">
                Terminal configurada: <span className="font-medium text-foreground">{estado.terminalId}</span>. Tocá
                “Buscar mis terminales” para cambiarla.
              </p>
            )}

            {/* Salida manual: si la lista no la trae (o querés pegarla directo), el id
                de la terminal se puede escribir. Lo encontrás en tu panel de MercadoPago
                → Point → tus dispositivos. */}
            <details className="rounded-lg border border-dashed border-border">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground">
                ¿No aparece? Pegá el id de tu terminal
              </summary>
              <div className="border-t border-border p-3">
                <input
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value.trim())}
                  placeholder="PAX_A910__SMARTPOS…"
                  aria-label="Id de la terminal Point"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:border-primary"
                />
              </div>
            </details>
          </div>
        )}

        <button
          type="button"
          disabled={pending || (on && !terminalId)}
          onClick={guardar}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {on ? "Guardar terminal" : "Desactivar terminal"}
        </button>
      </div>
    </details>
  );
}

/**
 * Dirección del negocio.
 *
 * MercadoPago la exige para crear la sucursal Y la usa para retenciones
 * impositivas: por eso se pide de verdad en lugar de rellenarla con guiones. La
 * provincia es un desplegable porque MP acepta una lista cerrada de nombres con
 * ortografía exacta — como texto libre, "CABA" o "Bs As" darían un 400.
 */
function CamposDireccion({
  calle,
  numero,
  ciudad,
  provincia,
  setCalle,
  setNumero,
  setCiudad,
  setProvincia,
  disabled,
}: {
  calle: string;
  numero: string;
  ciudad: string;
  provincia: string;
  setCalle: (v: string) => void;
  setNumero: (v: string) => void;
  setCiudad: (v: string) => void;
  setProvincia: (v: string) => void;
  disabled: boolean;
}) {
  const input =
    "h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-40";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Dirección del negocio</legend>
      <p className="text-xs text-muted-foreground">
        MercadoPago la pide para tus retenciones de impuestos. Poné la real.
      </p>
      <div className="flex gap-2">
        <input
          aria-label="Calle"
          value={calle}
          onChange={(e) => setCalle(e.target.value)}
          placeholder="Calle"
          disabled={disabled}
          className={`${input} min-w-0 flex-1`}
        />
        <input
          aria-label="Altura"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="N°"
          inputMode="numeric"
          disabled={disabled}
          className={`${input} w-20 shrink-0`}
        />
      </div>
      <input
        aria-label="Ciudad"
        value={ciudad}
        onChange={(e) => setCiudad(e.target.value)}
        placeholder="Ciudad"
        disabled={disabled}
        className={`${input} w-full`}
      />
      <select
        aria-label="Provincia"
        value={provincia}
        onChange={(e) => setProvincia(e.target.value)}
        disabled={disabled}
        className={`${input} w-full cursor-pointer`}
      >
        <option value="">Elegí tu provincia</option>
        {PROVINCIAS_MP.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
