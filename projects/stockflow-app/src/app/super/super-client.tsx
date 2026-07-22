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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { crearNegocio, cambiarEstado, type AltaResult } from "./actions";
import { signOut } from "@/app/login/actions";
import { haceCuanto } from "@/app/admin/fiado/fiado-client";

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dueno: string | null;
  miembros: number;
  productos: number;
  ventas: number;
  ultimaVenta: string | null;
  createdAt: string;
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

  const activos = stores.filter((s) => s.status === "active").length;

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
                  <span>{s.ventas} ventas</span>
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await cambiarEstado(s.id, s.status === "active" ? "suspended" : "active");
                      setAviso({
                        tone: "ok",
                        text:
                          s.status === "active"
                            ? `${s.name} quedó suspendido.`
                            : `${s.name} está activo de nuevo.`,
                      });
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
