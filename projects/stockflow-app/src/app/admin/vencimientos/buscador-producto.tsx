"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, ScanLine, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CameraScanner } from "@/components/pos/camera-scanner";
import { useWedgeScanner } from "@/components/pos/use-wedge-scanner";
import { buscarParaIngreso, type IngresoBuscado } from "@/app/admin/productos/actions";

/**
 * Elegir el producto: ESCANEAR primero, buscar después.
 *
 * POR QUÉ SE FUE EL `<select>`. Tenía 501 opciones sobre un catálogo de 2007,
 * así que 1507 productos (75%) eran INALCANZABLES desde esta pantalla — y la
 * pantalla no lo decía. No era lentitud: no se podía cargar el vencimiento de
 * tres cuartos del stock. Además obligaba a precargar 500 productos en cada
 * request sólo para poblarlo.
 *
 * POR QUÉ ESCANEAR ES LO PRIMARIO Y NO EL BUSCADOR. Cargar un vencimiento es
 * una tarea CON EL PRODUCTO EN LA MANO: el dueño está parado en la góndola
 * leyendo la fecha impresa en el paquete. El código de barras está ahí, a dos
 * centímetros de la fecha que va a tipear. Buscar por nombre es el fallback
 * para lo que no tiene código o no escanea.
 *
 * Reusa exactamente lo que ya usa Recibir mercadería: `buscarParaIngreso`
 * (server-side, tope 8 resultados), `useWedgeScanner` (pistola) y
 * `CameraScanner`. Cero búsqueda nueva.
 */
export function BuscadorProducto({
  onElegir,
  autoFocus = false,
}: {
  onElegir: (p: IngresoBuscado) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<IngresoBuscado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [camara, setCamara] = useState(false);
  const [sinResultado, setSinResultado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* El escaneo resuelve por código COMPLETO (`exacto`): un parecido cargaría la
     fecha sobre el producto equivocado, y eso después no se nota. */
  const onScan = useCallback(
    (code: string) => {
      const codigo = code.trim();
      if (!codigo) return;
      setBuscando(true);
      setSinResultado(null);
      buscarParaIngreso(codigo, true)
        .then((r) => {
          const p = r[0];
          if (!p) {
            /* No se inventa un resultado: se dice qué código fue y se deja el
               camino de buscar por nombre abierto. */
            setSinResultado(codigo);
            return;
          }
          setCamara(false);
          onElegir(p);
        })
        .catch(() => setSinResultado(codigo))
        .finally(() => setBuscando(false));
    },
    [onElegir],
  );

  /* La pistola es un teclado: se escucha siempre que la cámara esté cerrada. */
  useWedgeScanner(onScan, !camara);

  /* Debounce de 180ms — el mismo que Recibir mercadería. Sin él, tipear
     "coca" dispara cuatro consultas y la última no es necesariamente la que
     llega al final. */
  useEffect(() => {
    const texto = q.trim();
    /* Con menos de 2 letras no se consulta y TAMPOCO se limpia con un
       `setItems([])`: vaciar la lista es estado DERIVADO de la query (ver
       `visibles` abajo), y setearlo en el cuerpo del efecto es lo que
       `react-hooks/set-state-in-effect` prohíbe. */
    if (texto.length < 2) return;
    let vivo = true;
    /* `setBuscando(true)` va DENTRO del timeout y no en el cuerpo del efecto:
       `react-hooks/set-state-in-effect` lo prohíbe con razón —un setState
       síncrono al montar dispara un render extra— y además el spinner no tiene
       por qué encenderse durante los 180ms de debounce, cuando todavía no hay
       ninguna consulta en vuelo. */
    const t = setTimeout(() => {
      if (vivo) setBuscando(true);
      buscarParaIngreso(texto)
        .then((r) => {
          if (vivo) setItems(r);
        })
        .finally(() => {
          if (vivo) setBuscando(false);
        });
    }, 180);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* La lista visible se DERIVA: si la query bajó de 2 caracteres, no hay nada
     que mostrar aunque `items` todavía tenga el resultado anterior. */
  const visibles = q.trim().length >= 2 ? items : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escaneá el código o buscá por nombre"
            aria-label="Buscar producto por nombre o código"
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Borrar la búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCamara(true)}
          aria-label="Escanear con la cámara"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-input text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <ScanLine className="size-5" />
        </button>
      </div>

      {sinResultado && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-ink">
          No encontramos el código <span className="tabular">{sinResultado}</span> en tu
          catálogo. Buscalo por nombre, o cargalo desde Recibir mercadería.
        </p>
      )}

      {buscando && visibles.length === 0 && q.trim().length >= 2 && (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" /> Buscando…
        </p>
      )}

      {/* "Sin resultados" con salida, nunca una lista vacía muda. */}
      {!buscando && q.trim().length >= 2 && visibles.length === 0 && !sinResultado && (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Ningún producto coincide con «{q.trim()}».
        </p>
      )}

      {visibles.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onElegir(p)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm",
                  "transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none",
                )}
              >
                <span className="w-5 shrink-0 text-center" aria-hidden>
                  {p.emoji ?? "📦"}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.archivado && (
                  <span className="shrink-0 text-[11px] text-warning-ink">archivado</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {camara && (
        /* `simple`: se autocierra al leer. A diferencia de Recibir mercadería
           —donde la cámara queda abierta para escanear la caja entera— acá cada
           lectura exige tipear una fecha, y no se puede tener cámara y teclado
           numérico a la vez. */
        <CameraScanner
          onScan={onScan}
          onClose={() => setCamara(false)}
          modoInicial="simple"
        />
      )}
    </div>
  );
}
