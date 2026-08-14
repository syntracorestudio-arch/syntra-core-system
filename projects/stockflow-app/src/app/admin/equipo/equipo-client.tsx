"use client";

import { useState, useTransition } from "react";
import {
  UserPlus,
  X,
  Check,
  LoaderCircle,
  Copy,
  Users,
  UserMinus,
  UserCheck,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button } from "@/components/ui/button";
import {
  crearEmpleado,
  actualizarPermisos,
  cambiarEstado,
  resetearClaveEmpleado,
  type AltaEmpleado,
  type ResetClave,
} from "./actions";

export type Miembro = {
  id: string;
  nombre: string | null;
  rol: "owner" | "staff";
  email: string;
  /** 050 · con qué usuario entra. null en el dueño y en las altas viejas. */
  usuario: string | null;
  estado: string;
  puede_fiar: boolean;
  puede_descuento: boolean;
  puede_anular: boolean;
  puede_recibir: boolean;
  /** Sigue viniendo de la RPC, pero ya no es un toggle: acompaña a puede_recibir. */
  ve_costos: boolean;
  /** 052 · cierra el turno; el payload que recibe NO trae la recaudación. */
  puede_cerrar: boolean;
  /** 052 · ve unidades y faltantes; ni un número de plata. */
  ve_reportes: boolean;
  desde: string;
};

/**
 * Los permisos, explicados por lo que HABILITAN, no por su nombre técnico.
 *
 * "Ver costos y ganancias" SALIÓ de esta lista (decisión del owner 2026-08-13).
 * No es que no hiciera nada: es que se contradecía con "Cargar mercadería" —
 * no se puede recibir mercadería sin anotar cuánto costó, así que quien
 * registra lo que entra ve costos por necesidad. Dos permisos que se pisan
 * confunden más de lo que protegen. `can_see_costs` sigue existiendo en la base
 * y ahora ACOMPAÑA a `can_receive_stock` (ver `actions.ts`), así que la columna
 * dice la verdad en vez de contradecir a la pantalla.
 */
/**
 * 052 · Seis permisos en dos grupos.
 *
 * Agrupados porque seis toggles planos ya no se leen de un vistazo, y porque el
 * dueño no piensa en una matriz: piensa "esta persona atiende" o "esta persona
 * además me maneja el local". Los títulos están en su idioma, no en el nuestro.
 *
 * `enAlta` marca cuáles se ofrecen al crear la cuenta. Cerrar la caja y ver qué
 * se vende NO están: se otorgan después, cuando el dueño ya decidió que confía.
 * Un permiso que se tilda en el apuro del alta no es una decisión.
 *
 * ACÁ VIVÍA "Cambiar precios en la venta" (`can_apply_discount`), y se sacó por
 * el mismo motivo que "Ver costos": prometía algo que la app no hace. Ocho RPCs
 * validan el flag, pero NINGUNA pantalla manda `unit_price` — ni para el dueño.
 * El carrito sólo tiene cantidad. Era la segunda promesa vacía encontrada en
 * esta pantalla, así que se barrieron las cinco restantes una por una
 * (docs/permisos-audit.md §A.3): las cinco llegan a una acción real.
 *
 * La columna y la validación en SQL se DEJAN: el guard del servidor es correcto
 * y no queremos reconstruirlo cuando la función llegue. Lo que no puede quedar
 * es el interruptor que no enciende nada.
 */
const PERMISOS = [
  {
    key: "puedeFiar",
    grupo: "mostrador",
    enAlta: true,
    label: "Fiar",
    ayuda: "Puede vender a cuenta y cobrarle al que viene a pagar",
  },
  {
    key: "puedeAnular",
    grupo: "mostrador",
    enAlta: true,
    label: "Anular ventas",
    ayuda: "Puede deshacer la venta que acaba de cobrar",
  },
  {
    key: "puedeRecibir",
    grupo: "local",
    enAlta: true,
    label: "Cargar mercadería",
    ayuda: "Puede registrar lo que entra — y ver cuánto te costó",
  },
  {
    key: "puedeCerrar",
    grupo: "local",
    enAlta: false,
    label: "Cerrar la caja",
    /* La ayuda dice explícitamente lo que NO ve: es justo lo que el dueño
       quiere saber antes de tildarlo. */
    ayuda: "Cuenta el efectivo y cierra el turno — no ve lo que se facturó ni la ganancia",
  },
  {
    key: "veReportes",
    grupo: "local",
    enAlta: false,
    label: "Ver qué se vende",
    ayuda: "Lo que más sale y lo que se está por acabar, en unidades — sin un solo precio",
  },
] as const;

const GRUPOS = [
  { id: "mostrador", titulo: "En el mostrador" },
  { id: "local", titulo: "Además de atender" },
] as const;

type PermisosState = Record<(typeof PERMISOS)[number]["key"], boolean>;

/** Los toggles agrupados. Vive acá para no repetir el map en los dos diálogos. */
function GrupoPermisos({
  soloAlta,
  permisos,
  onChange,
}: {
  soloAlta: boolean;
  permisos: PermisosState;
  onChange: (key: keyof PermisosState, v: boolean) => void;
}) {
  return (
    <>
      {GRUPOS.map((g) => {
        const items = PERMISOS.filter((p) => p.grupo === g.id && (!soloAlta || p.enAlta));
        if (items.length === 0) return null;
        return (
          <div key={g.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {g.titulo}
            </p>
            {items.map((p) => (
              <Toggle
                key={p.key}
                label={p.label}
                ayuda={p.ayuda}
                activo={permisos[p.key]}
                onChange={(v) => onChange(p.key, v)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export function EquipoClient({ miembros, yoId }: { miembros: Miembro[]; yoId: string }) {
  const [creando, setCreando] = useState(false);
  const [alta, setAlta] = useState<Extract<AltaEmpleado, { ok: true }> | null>(null);
  const [reset, setReset] = useState<Extract<ResetClave, { ok: true }> | null>(null);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const empleados = miembros.filter((m) => m.rol === "staff");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
      <PageHeader
        title="Equipo"
        subtitle={
          empleados.length === 0
            ? "Trabajás solo."
            : `${empleados.length} ${empleados.length === 1 ? "empleado" : "empleados"}`
        }
        icon={Users}
        art="equipo"
      >
        <Button variant="primary" onClick={() => setCreando(true)}>
          <UserPlus className="size-4" /> Sumar a alguien
        </Button>
      </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {empleados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <EmptyArt name="equipo" alt="Tarjetas de acceso apiladas" />
          <p className="text-sm font-medium">Todavía no sumaste a nadie</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando sumás a alguien, entra con su propio usuario y vos elegís qué puede hacer.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {empleados.map((m) => {
            const inactivo = m.estado !== "active";
            const puede = PERMISOS.filter(
              (p) =>
                ({
                  puedeFiar: m.puede_fiar,
                  puedeAnular: m.puede_anular,
                  puedeRecibir: m.puede_recibir,
                  puedeCerrar: m.puede_cerrar,
                  veReportes: m.ve_reportes,
                })[p.key],
            );
            return (
              <li key={m.id} className={cn("px-4 py-3", inactivo && "opacity-50")}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.nombre}
                      {inactivo && <span className="ml-2 text-xs text-danger-ink">dado de baja</span>}
                    </p>
                    {/* El USUARIO es el dato que el dueño le dicta; el email
                        sintético no se le muestra a nadie. Las altas viejas
                        (con email real) siguen mostrando el email. */}
                    <p className="truncate text-xs text-muted-foreground">
                      {m.usuario ?? m.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditando(m)}
                    className="h-8 cursor-pointer rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:border-primary"
                  >
                    Permisos
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await resetearClaveEmpleado(m.id);
                        if (r.ok) setReset(r);
                        else setAviso({ tone: "error", text: r.error });
                      })
                    }
                    aria-label={`Darle una clave nueva a ${m.nombre}`}
                    title="Clave nueva"
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-30"
                  >
                    <KeyRound className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pending || m.id === yoId}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cambiarEstado(m.id, inactivo);
                        setAviso(
                          r.ok
                            ? {
                                tone: "ok",
                                text: inactivo
                                  ? `${m.nombre} puede volver a entrar.`
                                  : `${m.nombre} ya no puede entrar.`,
                              }
                            : { tone: "error", text: r.error },
                        );
                      })
                    }
                    aria-label={inactivo ? `Reactivar a ${m.nombre}` : `Dar de baja a ${m.nombre}`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-30"
                  >
                    {inactivo ? <UserCheck className="size-3.5" /> : <UserMinus className="size-3.5" />}
                  </button>
                </div>
                {puede.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Puede: {puede.map((p) => p.label.toLowerCase()).join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Los empleados entran directo a la caja. Sin permisos no ven la plata del día,
        ni los costos, ni las cuentas de fiado.
      </p>

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
      {reset && <ClaveNuevaDialog reset={reset} onClose={() => setReset(null)} />}

      {editando && (
        <PermisosDialog
          miembro={editando}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null);
            setAviso({ tone: "ok", text: "Permisos actualizados." });
          }}
          onError={(e) => setAviso({ tone: "error", text: e })}
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
  onDone: (r: Extract<AltaEmpleado, { ok: true }>) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  // Por defecto puede lo básico de mostrador: vender y recibir mercadería.
  // Fiar, descontar, anular y ver costos se otorgan a conciencia.
  const [permisos, setPermisos] = useState<PermisosState>({
    puedeFiar: false,
    puedeAnular: false,
    puedeRecibir: true,
    // 052 · no se ofrecen en el alta: nacen apagados y se otorgan después.
    puedeCerrar: false,
    veReportes: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog title="Sumar a alguien al equipo" onClose={onClose}>
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="eq-nombre" className="text-sm font-medium">
            ¿Cómo se llama?
          </label>
          <input
            id="eq-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            placeholder="Luciana"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="eq-usuario" className="text-sm font-medium">
            Con qué usuario entra
          </label>
          <input
            id="eq-usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="luciana"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
          {/* 050 · ya no se pide email: la cajera de un kiosco muchas veces no
              tiene, y exigirlo era el bloqueante real del onboarding. */}
          <p className="text-xs text-muted-foreground">
            No hace falta que tenga email. Se lo dictás junto con la clave.
          </p>
        </div>

        <fieldset className="space-y-2 rounded-lg border border-border bg-background p-3">
          <legend className="px-1 text-sm font-medium">¿Qué puede hacer?</legend>
          <GrupoPermisos
            soloAlta
            permisos={permisos}
            onChange={(k, v) => setPermisos((s) => ({ ...s, [k]: v }))}
          />
        </fieldset>

        <button
          type="button"
          disabled={pending || !nombre.trim() || usuario.trim().length < 3}
          onClick={() =>
            startTransition(async () => {
              const res = await crearEmpleado({ nombre, usuario, ...permisos });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              onDone(res);
            })
          }
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Crear su cuenta
        </button>
      </div>
    </Dialog>
  );
}

function PermisosDialog({
  miembro,
  onClose,
  onDone,
  onError,
}: {
  miembro: Miembro;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [permisos, setPermisos] = useState<PermisosState>({
    puedeFiar: miembro.puede_fiar,
    puedeAnular: miembro.puede_anular,
    puedeRecibir: miembro.puede_recibir,
    puedeCerrar: miembro.puede_cerrar,
    veReportes: miembro.ve_reportes,
  });
  const [pending, startTransition] = useTransition();

  return (
    <Dialog title={`Permisos de ${miembro.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <fieldset className="space-y-4 rounded-lg border border-border bg-background p-3">
          <GrupoPermisos
            soloAlta={false}
            permisos={permisos}
            onChange={(k, v) => setPermisos((s) => ({ ...s, [k]: v }))}
          />
        </fieldset>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await actualizarPermisos(miembro.id, permisos);
              if (!r.ok) {
                onError(r.error);
                return;
              }
              onDone();
            })
          }
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          Guardar permisos
        </button>
      </div>
    </Dialog>
  );
}

function CredencialesDialog({
  alta,
  onClose,
}: {
  alta: Extract<AltaEmpleado, { ok: true }>;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  /* Lo que el dueño le dicta o le manda: los TRES datos del login, en el
     mismo orden en que aparecen en la pantalla. */
  const texto = `StockFlow
Código del negocio: ${alta.kiosco}
Usuario: ${alta.usuario}
Clave: ${alta.password}`;

  return (
    <Dialog title={`${alta.nombre} ya puede entrar`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Pasale estos datos. La clave es temporal —se la va a cambiar al
          entrar— y{" "}
          <strong className="text-foreground">no la vas a poder ver de nuevo</strong>.
        </p>
        <dl className="space-y-2 rounded-lg border border-border bg-background p-3">
          <div>
            <dt className="text-xs text-muted-foreground">Código del negocio</dt>
            <dd className="text-sm font-medium">{alta.kiosco}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Usuario</dt>
            <dd className="text-sm font-medium">{alta.usuario}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Clave temporal</dt>
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

function Toggle({
  label,
  ayuda,
  activo,
  onChange,
}: {
  label: string;
  ayuda: string;
  activo: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={label}
        onClick={() => onChange(!activo)}
        className={cn(
          "mt-0.5 flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors",
          activo ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-foreground transition-transform",
            activo && "translate-x-4",
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
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

/**
 * La clave nueva de un empleado, después de que el dueño se la resetea.
 *
 * Muestra el usuario junto a la clave a propósito: el dueño está por dictarle
 * las dos cosas y, si sólo viera la clave, tendría que ir a buscar el usuario a
 * la lista. Al resetear se cierran las sesiones abiertas de esa persona y se le
 * exige cambiarla al entrar — igual que en el alta.
 */
function ClaveNuevaDialog({
  reset,
  onClose,
}: {
  reset: Extract<ResetClave, { ok: true }>;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = reset.usuario
    ? `StockFlow
Usuario: ${reset.usuario}
Clave: ${reset.password}`
    : `StockFlow
Clave: ${reset.password}`;

  return (
    <Dialog title={`Clave nueva para ${reset.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          La anterior dejó de servir y se cerró su sesión en todos lados.
          Dictásela: se la va a cambiar al entrar y{" "}
          <strong className="text-foreground">no la vas a poder ver de nuevo</strong>.
        </p>
        <dl className="space-y-2 rounded-lg border border-border bg-background p-3">
          {reset.usuario && (
            <div>
              <dt className="text-xs text-muted-foreground">Usuario</dt>
              <dd className="text-sm font-medium">{reset.usuario}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Clave nueva</dt>
            <dd className="tabular text-lg font-semibold">{reset.password}</dd>
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
          Listo
        </button>
      </div>
    </Dialog>
  );
}
