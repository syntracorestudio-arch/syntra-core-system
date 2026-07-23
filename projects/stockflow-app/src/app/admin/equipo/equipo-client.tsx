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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { crearEmpleado, actualizarPermisos, cambiarEstado, type AltaEmpleado } from "./actions";

export type Miembro = {
  id: string;
  nombre: string | null;
  rol: "owner" | "staff";
  email: string;
  estado: string;
  puede_fiar: boolean;
  puede_descuento: boolean;
  puede_anular: boolean;
  puede_recibir: boolean;
  ve_costos: boolean;
  desde: string;
};

/** Los permisos, explicados por lo que HABILITAN, no por su nombre técnico. */
const PERMISOS = [
  { key: "puedeFiar", label: "Fiar", ayuda: "Puede vender a cuenta y cobrar deudas" },
  { key: "puedeRecibir", label: "Cargar mercadería", ayuda: "Puede registrar lo que entra" },
  { key: "puedeDescuento", label: "Cambiar precios en la venta", ayuda: "Puede hacer descuentos" },
  { key: "puedeAnular", label: "Anular ventas", ayuda: "Puede deshacer una venta cobrada" },
  { key: "veCostos", label: "Ver costos y ganancias", ayuda: "Ve cuánto te cuesta cada producto" },
] as const;

type PermisosState = Record<(typeof PERMISOS)[number]["key"], boolean>;

export function EquipoClient({ miembros, yoId }: { miembros: Miembro[]; yoId: string }) {
  const [creando, setCreando] = useState(false);
  const [alta, setAlta] = useState<Extract<AltaEmpleado, { ok: true }> | null>(null);
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
      >
        <Button variant="primary" onClick={() => setCreando(true)}>
          <UserPlus className="size-4" /> Sumar a alguien
        </Button>
      </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {empleados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
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
                  puedeDescuento: m.puede_descuento,
                  puedeAnular: m.puede_anular,
                  puedeRecibir: m.puede_recibir,
                  veCostos: m.ve_costos,
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
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
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
        Los empleados entran directo a la caja. No ven reportes, ajustes ni el equipo.
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
  const [email, setEmail] = useState("");
  // Por defecto puede lo básico de mostrador: vender y recibir mercadería.
  // Fiar, descontar, anular y ver costos se otorgan a conciencia.
  const [permisos, setPermisos] = useState<PermisosState>({
    puedeFiar: false,
    puedeDescuento: false,
    puedeAnular: false,
    puedeRecibir: true,
    veCostos: false,
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
          <label htmlFor="eq-email" className="text-sm font-medium">
            Su email
          </label>
          <input
            id="eq-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="luciana@gmail.com"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <p className="text-xs text-muted-foreground">Con esto va a entrar a la caja.</p>
        </div>

        <fieldset className="space-y-2 rounded-lg border border-border bg-background p-3">
          <legend className="px-1 text-sm font-medium">¿Qué puede hacer?</legend>
          {PERMISOS.map((p) => (
            <Toggle
              key={p.key}
              label={p.label}
              ayuda={p.ayuda}
              activo={permisos[p.key]}
              onChange={(v) => setPermisos((s) => ({ ...s, [p.key]: v }))}
            />
          ))}
        </fieldset>

        <button
          type="button"
          disabled={pending || !nombre.trim() || !email}
          onClick={() =>
            startTransition(async () => {
              const res = await crearEmpleado({ nombre, email, ...permisos });
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
    puedeDescuento: miembro.puede_descuento,
    puedeAnular: miembro.puede_anular,
    puedeRecibir: miembro.puede_recibir,
    veCostos: miembro.ve_costos,
  });
  const [pending, startTransition] = useTransition();

  return (
    <Dialog title={`Permisos de ${miembro.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <fieldset className="space-y-2 rounded-lg border border-border bg-background p-3">
          {PERMISOS.map((p) => (
            <Toggle
              key={p.key}
              label={p.label}
              ayuda={p.ayuda}
              activo={permisos[p.key]}
              onChange={(v) => setPermisos((s) => ({ ...s, [p.key]: v }))}
            />
          ))}
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
  const texto = `StockFlow\nEntrá con:\nEmail: ${alta.email}\nContraseña: ${alta.password}`;

  return (
    <Dialog title={`${alta.nombre} ya puede entrar`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Pasale estos datos. La contraseña es temporal y{" "}
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
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/60 sm:place-items-center sm:p-4">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
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
