"use client";

import { useState, useTransition } from "react";
import { Wand2, Loader2, AlertTriangle, X, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { bulkAssignCategory } from "@/app/admin/productos/actions";
import { aplicarNombres, sugerirCategorias, sugerirNombresCortos } from "./catalogo-actions";
import type { CategoriaVerificada, NombreVerificado } from "@/lib/asistente/catalogo";

/**
 * Las tareas que el asistente hace POR el dueño — el otro lado de los pendientes.
 *
 * Mismo contrato que el remito: el modelo propone, el código valida (nombres que
 * conservan marca y tamaño y no chocan; categorías que existen de verdad) y el
 * dueño confirma. Acá la confirmación es explícita y por ítem: arranca todo
 * tildado, pero destildar es un click y nada se guarda hasta apretar el botón.
 */

type Estado = "listo" | "cargando" | "revisando" | "guardando";

function Panel({
  titulo,
  descripcion,
  cta,
  estado,
  error,
  onPedir,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  descripcion: string;
  cta: string;
  estado: Estado;
  error: string | null;
  onPedir: () => void;
  onCerrar: () => void;
  children?: React.ReactNode;
  pie?: React.ReactNode;
}) {
  const ocupado = estado === "cargando" || estado === "guardando";
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{descripcion}</p>
        </div>
        {estado === "revisando" ? (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Descartar sugerencias"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPedir}
            disabled={ocupado}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors",
              ocupado ? "cursor-default opacity-60" : "hover:border-primary/40 hover:text-primary-ink",
            )}
          >
            {estado === "cargando" ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {estado === "cargando" ? "Pensando…" : cta}
          </button>
        )}
      </div>

      {error && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-ink">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {children && <div className="border-t border-border">{children}</div>}
      {pie && <div className="border-t border-border px-4 py-3">{pie}</div>}
    </div>
  );
}

/** Fuera del render a propósito: un componente creado adentro se remonta en
    cada pasada y pierde su estado. */
function Guardar({ n, onClick, estado }: { n: number; onClick: () => void; estado: Estado }) {
  const bloqueado = n === 0 || estado === "guardando";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={bloqueado}
      className={cn(
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
        bloqueado
          ? "cursor-default bg-secondary text-muted-foreground"
          : "bg-primary text-primary-foreground hover:opacity-90",
      )}
    >
      {estado === "guardando" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      {estado === "guardando" ? "Guardando…" : `Aplicar ${n} ${n === 1 ? "cambio" : "cambios"}`}
    </button>
  );
}

export function TareasCatalogo({ onHecho }: { onHecho: () => void }) {
  // ── Nombres cortos ──────────────────────────────────────────────────────────
  const [estN, setEstN] = useState<Estado>("listo");
  const [errN, setErrN] = useState<string | null>(null);
  const [nombres, setNombres] = useState<NombreVerificado[]>([]);
  const [elegidosN, setElegidosN] = useState<Set<string>>(new Set());
  const [, startN] = useTransition();

  const pedirNombres = () => {
    setErrN(null);
    setEstN("cargando");
    startN(async () => {
      const r = await sugerirNombresCortos();
      if (!r.ok) {
        setErrN(r.error);
        setEstN("listo");
      } else {
        setNombres(r.nombres);
        setElegidosN(new Set(r.nombres.map((n) => n.id))); // arranca todo tildado
        setEstN("revisando");
      }
    });
  };

  const guardarNombres = () => {
    setEstN("guardando");
    startN(async () => {
      const cambios = nombres.filter((n) => elegidosN.has(n.id)).map((n) => ({ id: n.id, nombre: n.nombre }));
      const r = await aplicarNombres({ cambios });
      if (!r.ok) {
        setErrN(r.error);
        setEstN("revisando");
      } else {
        setNombres([]);
        setEstN("listo");
        onHecho();
      }
    });
  };

  // ── Categorías ──────────────────────────────────────────────────────────────
  const [estC, setEstC] = useState<Estado>("listo");
  const [errC, setErrC] = useState<string | null>(null);
  const [cats, setCats] = useState<CategoriaVerificada[]>([]);
  const [elegidosC, setElegidosC] = useState<Set<string>>(new Set());
  const [, startC] = useTransition();

  const pedirCategorias = () => {
    setErrC(null);
    setEstC("cargando");
    startC(async () => {
      const r = await sugerirCategorias();
      if (!r.ok) {
        setErrC(r.error);
        setEstC("listo");
      } else {
        setCats(r.categorias);
        setElegidosC(new Set(r.categorias.map((c) => c.id)));
        setEstC("revisando");
      }
    });
  };

  const guardarCategorias = () => {
    setEstC("guardando");
    startC(async () => {
      /* Una llamada por categoría destino: `bulkAssignCategory` mueve N productos
         a UNA categoría, así que se agrupa. Son 2-5 grupos por tanda. */
      const porCategoria = new Map<string, string[]>();
      for (const c of cats) {
        if (!elegidosC.has(c.id)) continue;
        porCategoria.set(c.categoriaId, [...(porCategoria.get(c.categoriaId) ?? []), c.id]);
      }
      for (const [categoryId, ids] of porCategoria) {
        const r = await bulkAssignCategory({ product_ids: ids, category_id: categoryId });
        if (!r.ok) {
          setErrC(r.error);
          setEstC("revisando");
          return;
        }
      }
      setCats([]);
      setEstC("listo");
      onHecho();
    });
  };

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    fn(next);
  };

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Tareas que hago por vos
      </h2>

      <Panel
        titulo="Acortar nombres largos"
        descripcion="Los nombres del catálogo mayorista se cortan en la pantalla de venta. Te propongo versiones cortas que mantienen marca y tamaño."
        cta="Proponer"
        estado={estN}
        error={errN}
        onPedir={pedirNombres}
        onCerrar={() => {
          setNombres([]);
          setEstN("listo");
        }}
        pie={estN === "revisando" ? <Guardar n={elegidosN.size} onClick={guardarNombres} estado={estN} /> : undefined}
      >
        {estN === "revisando" && nombres.length > 0 && (
          <ul className="divide-y divide-border">
            {nombres.map((n) => (
              <li key={n.id}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={elegidosN.has(n.id)}
                    onChange={() => toggle(elegidosN, n.id, setElegidosN)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate text-xs text-muted-foreground line-through">{n.original}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-medium">
                      <ArrowRight className="size-3.5 shrink-0 text-primary-ink" />
                      {n.nombre}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        titulo="Poner categoría a lo que no tiene"
        descripcion="Uso solo las categorías que ya creaste. Lo que no encaje claro, lo dejo como está."
        cta="Proponer"
        estado={estC}
        error={errC}
        onPedir={pedirCategorias}
        onCerrar={() => {
          setCats([]);
          setEstC("listo");
        }}
        pie={estC === "revisando" ? <Guardar n={elegidosC.size} onClick={guardarCategorias} estado={estC} /> : undefined}
      >
        {estC === "revisando" && cats.length > 0 && (
          <ul className="divide-y divide-border">
            {cats.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={elegidosC.has(c.id)}
                    onChange={() => toggle(elegidosC, c.id, setElegidosC)}
                    className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.producto}</span>
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {c.categoriaNombre}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
