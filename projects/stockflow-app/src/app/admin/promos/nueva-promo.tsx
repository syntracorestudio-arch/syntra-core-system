"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { X, LoaderCircle, Search, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import {
  fechaCorta,
  finMinimo,
  duracionValida,
  razonDeDuracion,
  sumarDias,
  diasEntre,
  margenPct,
} from "@/lib/promos";
import { Button } from "@/components/ui/button";
import { buscarProductos, type ProductoBuscado } from "@/app/pos/actions";
import { Hoja, BajoCosto } from "./hoja";
import { crearPromo, lotesDelProducto, type LoteDelProducto } from "./actions";

/**
 * Alta manual de una promo.
 *
 * Cuatro pasos en orden fijo: producto → precio → hasta cuándo → confirmar.
 * Cada uno habilita al siguiente y nada se pregunta dos veces.
 *
 * El producto se elige con BÚSQUEDA SERVER-SIDE y no con un `<select>`: el
 * catálogo real ronda los 2000 productos y el select de Vencimientos está
 * capado a 500, así que en un negocio de verdad el producto que buscás puede
 * directamente no estar en la lista.
 */
export function NuevaPromo({
  hoy,
  margenMinimo,
  onClose,
  onDone,
}: {
  hoy: string;
  margenMinimo: number;
  onClose: () => void;
  onDone: (texto: string) => void;
}) {
  const [producto, setProducto] = useState<ProductoBuscado | null>(null);

  if (!producto) {
    return <ElegirProducto onClose={onClose} onElegir={setProducto} />;
  }

  return (
    <ArmarPromo
      producto={producto}
      hoy={hoy}
      margenMinimo={margenMinimo}
      onVolver={() => setProducto(null)}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Paso 1 · el producto
   ─────────────────────────────────────────────────────────────────────────── */

function ElegirProducto({
  onClose,
  onElegir,
}: {
  onClose: () => void;
  onElegir: (p: ProductoBuscado) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductoBuscado[]>([]);
  const [cargando, setCargando] = useState(true);
  const pedido = useRef(0);

  useEffect(() => {
    /* Debounce 250 ms + descarte por número de pedido: sin el contador, una
       respuesta lenta de "alf" puede pisar a la de "alfajor" y la lista queda
       mostrando resultados de lo que el dueño YA terminó de tipear. */
    const id = window.setTimeout(async () => {
      const mio = ++pedido.current;
      setCargando(true);
      const r = await buscarProductos({ q: q.trim() || null, limit: 20 });
      if (mio !== pedido.current) return;
      setItems(r.items);
      setCargando(false);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <Hoja>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">¿A qué producto?</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Buscá por nombre"
          aria-label="Buscar producto"
          className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <ul className="mt-3 space-y-1">
        {cargando && items.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            <LoaderCircle className="mx-auto size-4 animate-spin" />
          </li>
        )}
        {!cargando && items.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            No encontramos nada con «{q}».
          </li>
        )}
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onElegir(p)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-secondary"
            >
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-base">
                {p.emoji ?? "📦"}
              </span>
              <span className="min-w-0 flex-1">
                {/* Sin truncar: acá el nombre DECIDE cuál producto se rebaja, y
                    dos productos que difieren en el final se verían iguales. */}
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="tabular block text-xs text-muted-foreground">
                  {money(p.listPrice ?? p.price)} · {p.stock} u.
                  {p.promoId && " · ya está en promo"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Hoja>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Pasos 2-4 · precio, duración y confirmación
   ─────────────────────────────────────────────────────────────────────────── */

function ArmarPromo({
  producto,
  hoy,
  margenMinimo,
  onVolver,
  onClose,
  onDone,
}: {
  producto: ProductoBuscado;
  hoy: string;
  margenMinimo: number;
  onVolver: () => void;
  onClose: () => void;
  onDone: (texto: string) => void;
}) {
  /* `price` viene con la promo YA aplicada; el precio de lista es contra el que
     `create_promo` compara y el que se restaura al terminar. */
  const lista = producto.listPrice ?? producto.price;
  const costo = producto.cost;

  const [valor, setValor] = useState("");
  const [lotes, setLotes] = useState<LoteDelProducto[]>([]);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [fin, setFin] = useState<string>(sumarDias(hoy, 6) ?? hoy);
  const [tocoLaFecha, setTocoLaFecha] = useState(false);
  const [confirmandoBajoCosto, setConfirmandoBajoCosto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    lotesDelProducto(producto.id).then((l) => {
      if (!vivo) return;
      setLotes(l);
      /* La ligadura NO es un campo: si el producto tiene lotes por vencer, se
         ata solo el más cercano y la fecha de fin se deriva de él. El dueño la
         puede cambiar; no la tiene que completar. */
      if (l.length > 0) {
        setLoteId(l[0].id);
        setFin((f) => (tocoLaFecha ? f : l[0].expiryDate));
      }
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id]);

  const lote = useMemo(() => lotes.find((l) => l.id === loteId) ?? null, [lotes, loteId]);
  const venceLote = lote?.expiryDate ?? null;

  const precio = Number(valor);
  const margen = margenPct(precio, costo);
  const bajoCosto = costo !== null && Number.isFinite(precio) && precio > 0 && precio < costo;
  const precioOk = Number.isFinite(precio) && precio > 0 && precio < lista;
  const duracionOk = duracionValida(hoy, fin, venceLote);
  const minimo = finMinimo(hoy, venceLote);
  const dias = (diasEntre(hoy, fin) ?? 0) + 1;

  /* Guardarraíl 1 en el camino manual: AVISA, no bloquea. Si el producto se
     agota solo antes de vencer, rebajarlo es regalar margen — pero la decisión
     sigue siendo del dueño, que puede saber algo que el sistema no. */
  const porDia = producto.sold14d / 14;
  const diasAlVencimiento = venceLote ? Math.max(diasEntre(hoy, venceLote) ?? 0, 1) : null;
  const seAgotaSolo =
    diasAlVencimiento !== null && producto.stock > 0 && porDia >= producto.stock / diasAlVencimiento;

  function guardar(belowCostOk: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await crearPromo({
        productId: producto.id,
        promoPrice: precio,
        startsOn: hoy,
        endsOn: fin,
        expiryId: loteId,
        origin: "manual",
        belowCostOk,
        /* Reemplaza si el producto YA tiene una promo viva: el dueño la eligió
           a sabiendas (la lista se lo dijo) y dos llamadas dejarían una ventana
           cobrando el precio de lista. */
        reemplazar: producto.promoId != null,
      });
      if (!r.ok) {
        setConfirmandoBajoCosto(false);
        setError(r.error);
        return;
      }
      onDone(
        `Listo. La caja ya cobra ${money(precio)} el ${producto.name}. Termina el ${fechaCorta(
          fin,
        )} y vuelve solo a ${money(lista)}.`,
      );
    });
  }

  if (confirmandoBajoCosto && costo !== null) {
    return (
      <BajoCosto
        costo={costo}
        precio={precio}
        stock={producto.stock}
        pendiente={pendiente}
        onVolver={() => setConfirmandoBajoCosto(false)}
        onConfirmar={() => guardar(true)}
      />
    );
  }

  /* Chips de duración. El de "7 días" no se ofrece si el lote vence antes: un
     chip que produce un error no es una opción, es una trampa. */
  const chips: { label: string; fin: string }[] = [];
  const tres = sumarDias(hoy, 2);
  const siete = sumarDias(hoy, 6);
  if (tres && (!venceLote || tres <= venceLote)) chips.push({ label: "3 días", fin: tres });
  if (siete && (!venceLote || siete <= venceLote)) chips.push({ label: "7 días", fin: siete });
  if (venceLote) chips.push({ label: `Hasta que venza · ${fechaCorta(venceLote)}`, fin: venceLote });

  return (
    <Hoja>
      <div className="mb-4 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Otro producto
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <h2 className="text-sm font-semibold">{producto.name}</h2>
      <p className="tabular mt-0.5 text-xs text-muted-foreground">
        Hoy lo vendés a {money(lista)} · te quedan {producto.stock} u.
      </p>

      {producto.promoId && (
        <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-ink">
          Ya tiene una promo corriendo a {money(producto.price)}. Si seguís, esta la reemplaza.
        </p>
      )}

      {/* ---- precio ---- */}
      <label htmlFor="np-precio" className="mt-4 block text-sm font-medium">
        Precio de promo
      </label>
      <input
        id="np-precio"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        placeholder={String(Math.round(lista))}
        className="tabular mt-1.5 h-12 w-full rounded-lg border border-input bg-background px-3 text-lg outline-none focus:border-primary"
      />
      <p className="mt-1.5 text-sm text-muted-foreground">
        {valor === "" ? (
          "Poné cuánto querés cobrarlo."
        ) : !Number.isFinite(precio) || precio <= 0 ? (
          "Poné un número."
        ) : precio >= lista ? (
          <>Tiene que ser menor a {money(lista)}.</>
        ) : (
          /* Bajo costo se dice "perdés X", no "te queda −X": un menos delante
             de un monto se lee mal y rápido, y acá el signo es lo único que
             separa ganar de perder. El porcentaje negativo se omite por lo
             mismo — "−104% de margen" no significa nada en el mostrador. */
          bajoCosto ? (
            <>
              Perdés{" "}
              <strong className="tabular text-danger-ink">{money((costo ?? 0) - precio)}</strong> por
              unidad.
            </>
          ) : (
            <>
              Te queda{" "}
              <strong
                className={cn(
                  "tabular",
                  margen !== null && margen < margenMinimo
                    ? "text-warning-ink"
                    : "text-foreground",
                )}
              >
                {money(precio - (costo ?? 0))}
              </strong>{" "}
              por unidad{margen !== null && <> · {margen}% de margen</>}
            </>
          )
        )}
      </p>

      {/* ---- hasta cuándo ---- */}
      <p className="mt-4 text-sm font-medium">¿Hasta cuándo?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              setFin(c.fin);
              setTocoLaFecha(true);
            }}
            className={cn(
              "min-h-9 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors",
              fin === c.fin
                ? "border-primary bg-primary/10 text-primary-ink"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={fin}
        min={minimo ?? hoy}
        max={venceLote ?? undefined}
        onChange={(e) => {
          setFin(e.target.value);
          setTocoLaFecha(true);
        }}
        aria-label="Fecha de fin"
        className="tabular mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {!duracionOk ? (
          razonDeDuracion(hoy, venceLote)
        ) : venceLote && fin === venceLote && dias < 3 ? (
          <>{razonDeDuracion(hoy, venceLote)}</>
        ) : (
          <>
            Dura {dias} día{dias === 1 ? "" : "s"} y el precio vuelve solo a {money(lista)}.
          </>
        )}
      </p>

      {lote && (
        <p className="mt-2 text-xs text-muted-foreground">
          Atada al lote de <span className="tabular">{lote.qty} u.</span> que vence el{" "}
          {fechaCorta(lote.expiryDate)}: si lo resolvés antes, la promo termina sola.
        </p>
      )}
      {lotes.length > 1 && (
        <select
          value={loteId ?? ""}
          onChange={(e) => setLoteId(e.target.value || null)}
          aria-label="Lote al que se ata la promo"
          className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        >
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.qty} u. · vence el {fechaCorta(l.expiryDate)}
            </option>
          ))}
          <option value="">Sin atar a ningún lote</option>
        </select>
      )}

      {seAgotaSolo && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-ink">
          Vendés ~{porDia.toFixed(1).replace(".", ",")} por día y te quedan {producto.stock}: se
          agotan solos antes de vencer. Si igual querés rebajarlo, dale.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger-ink">{error}</p>
      )}

      {/* El precio y la fecha viven EN el botón: es lo último que el dueño lee
          antes de que cambie lo que cobra la caja. */}
      <button
        type="button"
        disabled={!precioOk || !duracionOk || pendiente}
        onClick={() => (bajoCosto ? setConfirmandoBajoCosto(true) : guardar(false))}
        className={cn(
          "mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40",
          bajoCosto
            ? "border border-danger/40 bg-danger/10 text-danger-ink"
            : "bg-primary text-primary-foreground",
        )}
      >
        {pendiente && <LoaderCircle className="size-4 animate-spin" />}
        <span className="truncate">
          {precioOk ? (
            <>
              Poner a {money(precio)} hasta el {fechaCorta(fin)}
            </>
          ) : (
            "Poner en promo"
          )}
        </span>
      </button>
      <Button variant="ghost" className="mt-1 w-full" onClick={onClose}>
        Cancelar
      </Button>
    </Hoja>
  );
}
