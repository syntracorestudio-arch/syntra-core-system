"use client";

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  CreditCard,
  ArrowRightLeft,
  UserRound,
  X,
  Check,
  Copy,
  Undo2,
  TriangleAlert,
  LoaderCircle,
  PackagePlus,
  LogOut,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CategoryChips } from "@/components/ui/category-chips";
import { EmptyArt } from "@/components/ui/empty-art";
import { money } from "@/lib/format";
import {
  registerSale,
  quickCreateProduct,
  buscarEnCatalogo,
  buscarPorNombre,
} from "@/app/pos/actions";
import { vincularVenta } from "@/app/pos/cobro-qr-actions";
import { anularVenta } from "@/app/admin/caja/actions";
import { signOut } from "@/app/login/actions";
import { useWedgeScanner } from "./use-wedge-scanner";
import { CameraScanner } from "./camera-scanner";
import { CobroQrDialog } from "./cobro-qr-dialog";

export type PosProduct = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  price: number;
  stock: number;
  categoryId: string | null;
  categoryName: string | null;
  barcodes: string[];
  /** Unidades vendidas en los últimos 14 días — ordena la grilla por ritmo. */
  sold14d: number;
};

type Client = {
  id: string;
  name: string;
  /** Cuánto debe hoy, en positivo. */
  owed: number;
  creditLimit: number | null;
};
type Linea = { producto: PosProduct; cantidad: number };

const MEDIOS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transfer.", icon: ArrowRightLeft },
  { key: "account", label: "Fiado", icon: UserRound },
] as const;

type Medio = (typeof MEDIOS)[number]["key"];

export function PosScreen({
  storeName,
  products,
  clients,
  canSellOnCredit,
  isOwner,
  mpConectado,
  transferAlias,
  confirmMethods,
}: {
  storeName: string;
  products: PosProduct[];
  clients: Client[];
  canSellOnCredit: boolean;
  isOwner: boolean;
  /** ¿El negocio conectó su cuenta de MercadoPago? Decide si el QR lo genera la app. */
  mpConectado: boolean;
  /** Alias/CVU del negocio para mostrar al cobrar por transferencia. */
  transferAlias: string | null;
  /** Perilla por método: ¿pedir confirmación antes de cobrar? (QR tiene su diálogo). */
  confirmMethods: { cash: boolean; card: boolean; transfer: boolean; account: boolean };
}) {
  const [busqueda, setBusqueda] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<Medio>("cash");
  const [cobrandoQr, setCobrandoQr] = useState(false);
  /** Paso de confirmación (armar → confirmar) del pie del carrito. */
  const [confirmando, setConfirmando] = useState(false);
  /** Lockout anti-doble-tap: Confirmar no acepta input los primeros 250ms. */
  const [confirmReady, setConfirmReady] = useState(false);
  /** Efectivo: con cuánto paga el cliente (para calcular el vuelto y reconciliar). */
  const [tendered, setTendered] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [aviso, setAviso] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
    /** Si viene, el toast muestra "Deshacer" (anula la venta recién hecha). */
    undoId?: string;
  } | null>(null);
  /** Línea del carrito cuya cantidad se está editando a mano (#6). */
  const [editandoQty, setEditandoQty] = useState<string | null>(null);
  /** El carrito quedó sin tocar un rato: ¿es de un cliente anterior? (#8). */
  const [carritoViejo, setCarritoViejo] = useState(false);
  /** AudioContext perezoso para el beep de "cobrado" (#7). */
  const audioCtx = useRef<AudioContext | null>(null);
  /** Card que acaba de tocarse: dispara el pulso de confirmación. */
  const [pulso, setPulso] = useState<string | null>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const [altaRapida, setAltaRapida] = useState<{
    barcode: string | null;
    sugerencia: { nombre: string; marca: string | null } | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Clave de idempotencia por carrito: si se corta la red y el cajero reintenta,
   *  la RPC devuelve la MISMA venta en vez de cobrar dos veces. */
  const idempotencyKey = useRef(crypto.randomUUID());

  const porCodigo = useMemo(() => {
    const map = new Map<string, PosProduct>();
    for (const p of products) for (const b of p.barcodes) map.set(b, p);
    return map;
  }, [products]);

  /* Categorías derivadas del catálogo (no viajan aparte): las que tienen al
     menos un producto. El color viene del primer producto que la lleva. */
  const categorias = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>();
    for (const p of products) {
      if (p.categoryId && p.categoryName && !map.has(p.categoryId)) {
        map.set(p.categoryId, { id: p.categoryId, name: p.categoryName, color: p.color });
      }
    }
    return [...map.values()];
  }, [products]);

  /* Orden por RITMO de venta, no alfabético: lo que se vende 20 veces por día
     queda en la primera fila y el cajero no lo busca. Empate → alfabético. */
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = products;
    if (cat) base = base.filter((p) => p.categoryId === cat);
    if (q) {
      base = base.filter(
        (p) => p.name.toLowerCase().includes(q) || p.barcodes.some((b) => b.includes(q)),
      );
    }
    return [...base].sort(
      (a, b) => b.sold14d - a.sold14d || a.name.localeCompare(b.name, "es"),
    );
  }, [busqueda, cat, products]);

  const total = carrito.reduce((a, l) => a + l.producto.price * l.cantidad, 0);
  const unidades = carrito.reduce((a, l) => a + l.cantidad, 0);
  const cliente = clienteId ? (clients.find((c) => c.id === clienteId) ?? null) : null;

  const agregar = useCallback((producto: PosProduct) => {
    // Escanear/agregar durante la confirmación = "me faltó un producto": cancela
    // el confirm y vuelve a componer. `setConfirmando(false)` es no-op si ya
    // estábamos en el estado A (React descarta el set al mismo valor).
    setConfirmando(false);
    setCarritoViejo(false); // tocar el carrito reinicia el reloj de "colgado" (#8)
    // Confirmación visual sin mirar el carrito: la card late al tocarla.
    setPulso(producto.id);
    setTimeout(() => setPulso((p) => (p === producto.id ? null : p)), 350);
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto.id === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }, []);

  /** Un beep del lector o de la cámara entra por acá. */
  const onScan = useCallback(
    (code: string) => {
      setCamaraAbierta(false);
      const encontrado = porCodigo.get(code.trim());
      if (encontrado) {
        agregar(encontrado);
        setAviso({ tone: "ok", text: `${encontrado.name} agregado` });
        return;
      }
      // Código desconocido → se consulta el catálogo compartido y recién ahí se
      // abre el alta, ya con el nombre puesto si lo reconocimos.
      const codigo = code.trim();
      buscarEnCatalogo(codigo)
        .then((sug) => setAltaRapida({ barcode: codigo, sugerencia: sug }))
        .catch(() => setAltaRapida({ barcode: codigo, sugerencia: null }));
    },
    [porCodigo, agregar],
  );

  useWedgeScanner(onScan, !camaraAbierta && !altaRapida);

  /* Atajos para el mostrador con lector USB y teclado: F2 salta a la búsqueda,
     Escape vacía la venta. Enter queda LIBRE a propósito: es el terminador del
     lector y atarlo a "cobrar" haría cobrar de más ante un Enter suelto. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        buscadorRef.current?.focus();
        buscadorRef.current?.select();
      } else if (e.key === "Escape") {
        // Rotar la clave al vaciar (ver `vaciar`); inline para no meter una dep
        // no estable en este efecto de deps vacías.
        idempotencyKey.current = crypto.randomUUID();
        setConfirmando(false);
        setTendered(null);
        setCarrito([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function cambiar(id: string, delta: number) {
    setConfirmando(false); // editar el carrito cancela la confirmación en curso
    setCarritoViejo(false);
    setCarrito((prev) =>
      prev
        .map((l) => (l.producto.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );
  }

  /* Vaciar la venta SIEMPRE rota la clave de idempotencia. Así un carrito nuevo
     jamás reusa la clave de uno anterior cuya respuesta se perdió: sin esto, un
     segundo carrito distinto se registraba como "repetido" y se perdía la venta
     bajo un toast de éxito (H1). El éxito de cobro también rota (más abajo). */
  function vaciar() {
    setConfirmando(false);
    setTendered(null);
    setCarritoViejo(false);
    setEditandoQty(null);
    setCarrito([]);
    idempotencyKey.current = crypto.randomUUID();
  }

  /* Lockout anti-doble-tap: al entrar a confirmar, el botón Confirmar ignora el
     input por 250ms. Un doble-tap reflejo (por costumbre de "Cobrar") cae <300ms
     y no dispara; un usuario deliberado ni lo percibe. Junto con el cambio de
     color del botón, evita completar sin mirar. */
  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmReady(true), 250);
    return () => clearTimeout(t);
  }, [confirmando]);

  /* Carrito colgado (#8): si pasa el rato sin tocarlo, avisar que puede ser de un
     cliente anterior. El flag se resetea en cada cambio de carrito (agregar/cambiar/
     vaciar), no acá, para no meter un setState en el cuerpo del efecto. */
  useEffect(() => {
    if (carrito.length === 0) return;
    const t = setTimeout(() => setCarritoViejo(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [carrito]);

  /* Ventana de "Deshacer" (#3): el toast con undo desaparece a los 20s. */
  useEffect(() => {
    if (!aviso?.undoId) return;
    const t = setTimeout(() => setAviso(null), 20_000);
    return () => clearTimeout(t);
  }, [aviso]);

  /** Beep corto de "cobrado" (#7): confirmación sin mirar, mostrador ruidoso. */
  function beep() {
    try {
      audioCtx.current ??= new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      /* audio bloqueado o no disponible: el beep es un extra, no rompe nada */
    }
  }

  /** Deshacer la venta recién hecha (#3): revierte stock y deuda con anularVenta. */
  function deshacer(saleId: string) {
    setAviso(null);
    startTransition(async () => {
      const res = await anularVenta(saleId, "deshacer en caja");
      setAviso(
        res.ok
          ? { tone: "ok", text: "Venta deshecha. La caja quedó como antes." }
          : { tone: "error", text: res.error },
      );
    });
  }

  /** Fijar la cantidad de una línea a un número exacto (#6), sin re-escanear. */
  function setCantidadAbs(id: string, n: number) {
    setCarritoViejo(false);
    setConfirmando(false);
    setCarrito((prev) =>
      prev.map((l) => (l.producto.id === id ? { ...l, cantidad: n } : l)).filter((l) => l.cantidad > 0),
    );
  }

  function cobrar() {
    if (carrito.length === 0 || pending) return;
    if (medio === "account" && !clienteId) {
      setAviso({ tone: "error", text: "Elegí a quién le fiás." });
      return;
    }

    /* QR con la cuenta del negocio conectada: primero el cliente paga, DESPUÉS se
       registra la venta. Al revés quedarían ventas fantasma esperando un pago que
       tal vez nunca llega. Sin cuenta conectada, "QR" sigue siendo lo que era: un
       medio de pago que el cajero marca a mano. */
    if (medio === "qr" && mpConectado) {
      setCobrandoQr(true);
      return;
    }

    // Confirmación (armar → confirmar). El QR con MP ya salió arriba con su diálogo;
    // el QR SIN MP (marca manual) TAMBIÉN confirma —así no es una venta instantánea
    // silenciosa que sorprende al cajero— y el resto según la perilla por método.
    const necesitaConfirmar = medio === "qr" ? true : confirmMethods[medio];
    if (necesitaConfirmar) {
      setTendered(null);
      setConfirmReady(false); // el efecto lo pone en true a los 250ms (lockout)
      setConfirmando(true);
      return;
    }

    registrar(null);
  }

  /** Segundo tap: confirma y registra (respeta el lockout anti-doble-tap). */
  function confirmar() {
    if (!confirmReady || pending) return;
    registrar(null);
  }

  /** Vuelve a componer sin cobrar. */
  function volverAComponer() {
    setConfirmando(false);
    setTendered(null);
  }

  /** Registra la venta. `intentId` viene del cobro con QR cuando lo hubo. */
  function registrar(intentId: string | null) {
    startTransition(async () => {
      const res = await registerSale({
        items: carrito.map((l) => ({
          product_id: l.producto.id,
          qty: l.cantidad,
        })),
        payment_method: medio,
        idempotency_key: idempotencyKey.current,
        client_id: medio === "account" ? clienteId : null,
        // Con intentId, la plata del QR ya entró → registrar es un hecho: no lo
        // frena un producto archivado ni el stock estricto (M4). Efectivo: sin esto.
        paid: intentId !== null,
        // Con cuánto pagó en efectivo (para reconciliar caja). Solo si lo ingresó.
        cash_tendered: medio === "cash" && tendered != null ? tendered : undefined,
      });

      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }

      // Cierra el círculo: este cobro con QR terminó en esta venta. Sin esto, el
      // cobro quedaría como "aprobado sin venta" y aparecería en Caja para recuperar.
      // Se AWAITEA (antes era fire-and-forget): un fallo silencioso dejaba un falso
      // huérfano en Caja aunque la venta existía. Si igual falla, la venta ya quedó
      // registrada y el banner de Caja lo recupera (register_sale es idempotente). M5.
      if (intentId) {
        try {
          await vincularVenta(intentId, res.saleId);
        } catch {
          /* la venta está; el banner de Caja reconcilia por la misma clave */
        }
      }

      // Venta cerrada: carrito nuevo y clave nueva.
      setCobrandoQr(false);
      setConfirmando(false);
      setTendered(null);
      setCarritoViejo(false);
      setEditandoQty(null);
      setCarrito([]);
      setClienteId(null);
      setMedio("cash");
      idempotencyKey.current = crypto.randomUUID();

      if (res.replayed) {
        // La venta ya existía para esta clave (reintento del MISMO carrito). NO se
        // presenta como una venta nueva: se avisa honesto que ya estaba registrada
        // en vez de un "Cobrado" que sumaría en la cabeza del cajero (H1).
        setAviso({
          tone: "warn",
          text: `Este cobro ya estaba registrado (${money(res.total)}).`,
        });
        return;
      }

      // Venta nueva → beep de confirmación (#7). El "Deshacer" (#3) se ofrece solo
      // cuando NO hubo captura externa: en el QR pagado la plata ya está en MP y
      // anular la venta descuadraría — para eso está el flujo de anulación en Caja.
      beep();
      const undoId = intentId === null ? res.saleId : undefined;

      if (res.negativeStock.length > 0) {
        const nombres = res.negativeStock.map((n) => n.name).join(", ");
        setAviso({
          tone: "warn",
          text: `Cobrado ${money(res.total)}. Ojo: ${nombres} quedó en negativo — revisá el stock.`,
          undoId,
        });
      } else if (res.overLimit) {
        setAviso({
          tone: "warn",
          text: `Cobrado ${money(res.total)}. Ese cliente pasó su límite de fiado.`,
          undoId,
        });
      } else {
        setAviso({ tone: "ok", text: `Cobrado ${money(res.total)}`, undoId });
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {camaraAbierta && (
        <CameraScanner onScan={onScan} onClose={() => setCamaraAbierta(false)} />
      )}

      {cobrandoQr && (
        <CobroQrDialog
          items={carrito.map((l) => ({ product_id: l.producto.id, qty: l.cantidad }))}
          amount={total}
          idempotencyKey={idempotencyKey.current}
          descripcion={carrito.map((l) => l.producto.name).join(", ")}
          onPagado={(intentId) => registrar(intentId)}
          onCerrar={() => setCobrandoQr(false)}
        />
      )}

      {altaRapida && (
        <AltaRapida
          barcode={altaRapida.barcode}
          sugerencia={altaRapida.sugerencia}
          canCreate={isOwner}
          onCancel={() => setAltaRapida(null)}
          onCreated={(p) => {
            setAltaRapida(null);
            agregar({
              ...p,
              emoji: "📦",
              color: null,
              stock: 0,
              categoryId: null,
              categoryName: null,
              barcodes: [],
              sold14d: 0,
            });
            setAviso({ tone: "ok", text: `${p.name} creado y agregado` });
          }}
        />
      )}

      {/* Catálogo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Link
                href="/admin"
                aria-label="Volver al resumen"
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <ArrowLeft className="size-5" />
              </Link>
            ) : (
              /* Para el empleado el POS es toda la app: si no le damos salida acá,
                 no tiene ninguna forma de cerrar sesión. */
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  <LogOut className="size-5" />
                </button>
              </form>
            )}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={buscadorRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscá o escaneá un código"
                aria-label="Buscar producto"
                className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              aria-label="Escanear con la cámara"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-150 hover:opacity-90"
            >
              <ScanBarcode className="size-5" />
            </button>
          </div>
          {/* Chips táctiles (h-10): en el mostrador se filtra con el pulgar,
              nunca con un dropdown de dos toques. */}
          <CategoryChips
            categories={categorias}
            value={cat}
            onChange={setCat}
            size="lg"
            className="mt-2.5"
          />
          <p className="mt-1.5 truncate text-xs text-muted-foreground">{storeName}</p>
        </header>

        {aviso && (
          <div
            role="status"
            className={cn(
              "mx-4 mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
              aviso.tone === "ok" && "bg-success/10 text-success-ink ring-success/25",
              aviso.tone === "warn" && "bg-warning/10 text-warning-ink ring-warning/25",
              aviso.tone === "error" && "bg-danger/10 text-danger-ink ring-danger/25",
            )}
          >
            {aviso.tone === "ok" ? (
              <Check className="mt-0.5 size-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="flex-1">{aviso.text}</span>
            {aviso.undoId && (
              <button
                type="button"
                onClick={() => deshacer(aviso.undoId!)}
                disabled={pending}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-current px-2.5 py-1 text-xs font-bold transition-colors hover:bg-current/10 disabled:opacity-50"
              >
                <Undo2 className="size-3.5" />
                Deshacer
              </button>
            )}
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Cerrar aviso"
              className="cursor-pointer opacity-60 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {visibles.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 py-16 text-center">
            <div>
              {products.length === 0 && (
                <EmptyArt name="productos" alt="Una repisa vacía con un escáner" />
              )}
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? "Todavía no cargaste productos. Escaneá uno y lo damos de alta en 10 segundos."
                  : "Ningún producto coincide con la búsqueda."}
              </p>
            </div>
          </div>
        ) : (
          /* Grilla densa: 3 columnas ya en 390px y ~6 en escritorio. Antes eran
             2 y 4 con cards de 250px — con 200 SKUs el cajero scrolleaba una
             cuadra para cobrar un alfajor. */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 p-4 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {visibles.map((p) => {
              const sinStock = p.stock <= 0;
              const poco = p.stock > 0 && p.stock <= 3;
              const color = p.color ?? "var(--muted-foreground)";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  className={cn(
                    "group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-2.5 text-left transition-colors duration-150 hover:border-primary/60",
                    pulso === p.id && "sf-tap",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)`,
                      }}
                      aria-hidden
                    >
                      {p.emoji ?? "📦"}
                    </span>
                    {sinStock ? (
                      <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger-ink ring-1 ring-danger/30">
                        sin stock
                      </span>
                    ) : poco ? (
                      <span className="tabular rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink ring-1 ring-warning/30">
                        {p.stock}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-tight">
                    {p.name}
                  </p>
                  <p className="tabular mt-auto pt-1 text-[15px] font-semibold">
                    {money(p.price)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Carrito */}
      <aside className="sticky bottom-0 z-30 flex shrink-0 flex-col border-t border-border bg-card lg:top-0 lg:h-dvh lg:w-96 lg:border-l lg:border-t-0">
        <div
          className={cn(
            "items-center justify-between border-b border-border px-4 py-3.5 lg:flex",
            carrito.length > 0 ? "flex" : "hidden",
          )}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Venta actual
            {unidades > 0 && (
              <span className="tabular rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                {unidades} u.
              </span>
            )}
          </h2>
          {carrito.length > 0 && (
            <button
              type="button"
              onClick={vaciar}
              className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger-ink"
            >
              <X className="size-3.5" /> Vaciar
            </button>
          )}
        </div>

        {carritoViejo && carrito.length > 0 && (
          <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning-ink ring-1 ring-warning/25">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span className="flex-1">Sin tocar hace un rato. ¿Es de un cliente anterior?</span>
            <button
              type="button"
              onClick={vaciar}
              className="shrink-0 cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Vaciar
            </button>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto max-h-[38dvh] lg:max-h-none",
            carrito.length === 0 && "hidden lg:block",
          )}
        >
          {carrito.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Escaneá o tocá un producto para empezar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {carrito.map((l) => (
                <li key={l.producto.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {l.producto.emoji ?? "📦"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {money(l.producto.price)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label={`Quitar uno de ${l.producto.name}`}
                      onClick={() => cambiar(l.producto.id, -1)}
                    >
                      {l.cantidad === 1 ? (
                        <Trash2 className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </IconBtn>
                    {editandoQty === l.producto.id ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        defaultValue={l.cantidad}
                        aria-label={`Cantidad de ${l.producto.name}`}
                        onBlur={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          if (Number.isFinite(n) && n > 0) setCantidadAbs(l.producto.id, n);
                          setEditandoQty(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditandoQty(null);
                        }}
                        className="tabular h-7 w-12 rounded-md border border-primary bg-background text-center text-sm font-semibold outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoQty(l.producto.id)}
                        aria-label={`Escribir la cantidad de ${l.producto.name}`}
                        className="tabular h-7 w-8 cursor-pointer rounded-md text-center text-sm font-semibold transition-colors hover:bg-secondary"
                      >
                        {l.cantidad}
                      </button>
                    )}
                    <IconBtn
                      label={`Agregar uno de ${l.producto.name}`}
                      onClick={() => cambiar(l.producto.id, 1)}
                    >
                      <Plus className="size-3.5" />
                    </IconBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            {/* El total late con cada producto: confirmación sin mirar la lista. */}
            <span key={total} className="sf-screen-pop tabular text-3xl font-semibold">
              {money(total)}
            </span>
          </div>

          {!confirmando ? (
          <>
          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {MEDIOS.map((m) => {
              const bloqueado = m.key === "account" && !canSellOnCredit;
              const elegido = medio === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setMedio(m.key)}
                  aria-pressed={elegido}
                  title={bloqueado ? "No tenés permiso para fiar" : undefined}
                  className={cn(
                    "flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-1 text-[11px] transition-all duration-150",
                    elegido
                      ? "border-primary text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    bloqueado && "cursor-not-allowed opacity-35 hover:text-muted-foreground",
                  )}
                  style={
                    elegido
                      ? {
                          background:
                            "linear-gradient(180deg, color-mix(in srgb, var(--primary) 22%, transparent), color-mix(in srgb, var(--primary) 8%, transparent))",
                        }
                      : undefined
                  }
                >
                  <m.icon className={cn("size-5", elegido && "text-primary-ink")} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {medio === "account" && (
            <div className="mb-3">
              <select
                value={clienteId ?? ""}
                onChange={(e) => setClienteId(e.target.value || null)}
                aria-label="Cliente al que se le fía"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">¿A quién le fiás?</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {/* Fiar a ciegas era la norma: acá el cajero ve la deuda y el
                  límite ANTES de confirmar, que es cuando se decide. */}
              {cliente && <SaldoCliente cliente={cliente} aFiar={total} />}
            </div>
          )}

          <button
            type="button"
            onClick={cobrar}
            disabled={carrito.length === 0 || pending}
            className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending
              ? "Cobrando…"
              : carrito.length === 0
                ? "Escaneá un producto"
                : `Cobrar ${money(total)} · ${unidades} u.`}
          </button>
          </>
          ) : (
            <ConfirmarCobro
              medio={medio}
              total={total}
              cliente={cliente}
              transferAlias={transferAlias}
              tendered={tendered}
              setTendered={setTendered}
              confirmReady={confirmReady}
              pending={pending}
              onConfirmar={confirmar}
              onVolver={volverAComponer}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * Estado de cuenta del cliente al que se le va a fiar. Avisa, nunca bloquea
 * (business-rules: el límite es un aviso) — pero el cajero decide informado.
 */
function SaldoCliente({ cliente, aFiar }: { cliente: Client; aFiar: number }) {
  const quedaria = cliente.owed + aFiar;
  const limite = cliente.creditLimit;
  const pasa = limite !== null && quedaria > limite;

  return (
    <div
      className={cn(
        "mt-2 rounded-lg px-3 py-2 text-xs ring-1",
        pasa
          ? "bg-warning/10 text-warning-ink ring-warning/25"
          : "bg-secondary/60 text-muted-foreground ring-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{cliente.owed > 0 ? "Ya debe" : "No debe nada"}</span>
        <span className="tabular font-semibold text-foreground">{money(cliente.owed)}</span>
      </div>
      {aFiar > 0 && (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span>Quedaría debiendo</span>
          <span className={cn("tabular font-semibold", pasa ? "" : "text-foreground")}>
            {money(quedaria)}
            {limite !== null && ` de ${money(limite)}`}
          </span>
        </div>
      )}
      {pasa && (
        <p className="mt-1.5 flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Pasa su límite. Podés fiarle igual, pero mejor que lo sepas.
        </p>
      )}
    </div>
  );
}

/** Billetes AR sugeridos para "paga con": los que alcanzan el total. */
function billetesSugeridos(total: number): number[] {
  const utiles = [1000, 2000, 5000, 10000, 20000].filter((b) => b > total).slice(0, 3);
  if (utiles.length === 0) {
    const arriba = Math.ceil(total / 1000) * 1000; // total > $20k → redondear al mil
    return arriba > total ? [arriba] : [];
  }
  return utiles;
}

/**
 * Estado B — confirmar el cobro. Method-aware, en el MISMO pie del carrito (no es
 * un modal). El botón Confirmar va en verde (plata) para que el ojo registre que
 * la superficie cambió: junto con el lockout de 250ms, evita completar por reflejo.
 */
function ConfirmarCobro({
  medio,
  total,
  cliente,
  transferAlias,
  tendered,
  setTendered,
  confirmReady,
  pending,
  onConfirmar,
  onVolver,
}: {
  medio: Medio;
  total: number;
  cliente: Client | null;
  transferAlias: string | null;
  tendered: number | null;
  setTendered: (v: number | null) => void;
  confirmReady: boolean;
  pending: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  const m = MEDIOS.find((x) => x.key === medio);
  return (
    <div>
      {/* Chip del método — tocarlo vuelve a componer (para cambiar el método). */}
      <button
        type="button"
        onClick={onVolver}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm transition-colors hover:border-primary/40"
      >
        <ArrowLeft className="size-4 text-muted-foreground" />
        {m && <m.icon className="size-4 text-muted-foreground" />}
        <span className="font-medium text-foreground">{m?.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">tocá para cambiar</span>
      </button>

      {medio === "cash" && <PagaCon total={total} tendered={tendered} setTendered={setTendered} />}
      {medio === "transfer" && <TransferAlias alias={transferAlias} total={total} />}
      {medio === "card" && (
        <p className="mb-3 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
          Pasá la tarjeta por{" "}
          <span className="tabular font-semibold text-foreground">{money(total)}</span> en el posnet.
        </p>
      )}
      {medio === "qr" && (
        <p className="mb-3 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
          Cobrá con tu QR de MercadoPago por{" "}
          <span className="tabular font-semibold text-foreground">{money(total)}</span> y confirmá.
          {/* Este es el modo manual: MP no está conectado. Conectalo en Ajustes y el
              QR lo genera la app con el monto exacto. */}
        </p>
      )}
      {medio === "account" && cliente && (
        <div className="mb-3">
          <SaldoCliente cliente={cliente} aFiar={total} />
        </div>
      )}

      <button
        type="button"
        onClick={onConfirmar}
        disabled={!confirmReady || pending}
        className={cn(
          "flex h-13 w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white transition-all duration-150",
          confirmReady && !pending ? "cursor-pointer bg-success hover:opacity-90" : "cursor-not-allowed bg-success/40",
        )}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-5" />}
        {pending ? "Cobrando…" : `Confirmar · ${money(total)}`}
      </button>
    </div>
  );
}

/** Efectivo: "paga con" (chips de billetes + monto libre) → vuelto client-side. */
function PagaCon({
  total,
  tendered,
  setTendered,
}: {
  total: number;
  tendered: number | null;
  setTendered: (v: number | null) => void;
}) {
  const [redondeo, setRedondeo] = useState<0 | 50 | 100>(0);
  const [libre, setLibre] = useState("");
  const sugeridos = billetesSugeridos(total);

  const vueltoExacto = tendered != null ? Math.max(0, tendered - total) : null;
  const vuelto =
    vueltoExacto == null ? null : redondeo === 0 ? vueltoExacto : Math.round(vueltoExacto / redondeo) * redondeo;
  const falta = tendered != null && tendered < total;

  function elegir(v: number) {
    setLibre("");
    setTendered(v);
  }

  return (
    <div className="mb-3 space-y-2.5">
      <p className="text-xs font-medium text-muted-foreground">Paga con</p>
      <div className="flex flex-wrap gap-1.5">
        <ChipMonto activo={tendered === total} onClick={() => elegir(total)}>
          Justo
        </ChipMonto>
        {sugeridos.map((b) => (
          <ChipMonto key={b} activo={tendered === b} onClick={() => elegir(b)}>
            {money(b)}
          </ChipMonto>
        ))}
        <input
          type="number"
          inputMode="numeric"
          value={libre}
          onChange={(e) => {
            setLibre(e.target.value);
            const n = Number(e.target.value);
            setTendered(e.target.value !== "" && Number.isFinite(n) ? n : null);
          }}
          placeholder="Otro"
          className="tabular h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {tendered != null && (
        <div className="rounded-lg bg-secondary/50 px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{falta ? "Falta" : "Vuelto"}</span>
            <span
              className={cn(
                "tabular text-xl font-semibold",
                falta ? "text-danger-ink" : "text-success-ink",
              )}
            >
              {money(falta ? total - tendered : (vuelto ?? 0))}
            </span>
          </div>
          {!falta && (vuelto ?? 0) > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Redondear:</span>
              {([0, 50, 100] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRedondeo(r)}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-0.5 text-xs transition-colors",
                    redondeo === r
                      ? "bg-primary/20 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === 0 ? "Exacto" : `$${r}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChipMonto({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tabular h-9 cursor-pointer rounded-lg border px-3 text-sm transition-colors",
        activo
          ? "border-primary bg-primary/15 font-medium text-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Transferencia: alias/CVU del negocio + copiar (lo carga el dueño en Ajustes). */
function TransferAlias({ alias, total }: { alias: string | null; total: number }) {
  const [copiado, setCopiado] = useState(false);
  if (!alias) {
    return (
      <p className="mb-3 rounded-lg bg-warning/10 px-3 py-3 text-sm text-warning-ink ring-1 ring-warning/25">
        Cargá tu alias/CVU en Ajustes para mostrarlo acá. Por ahora, dictáselo al cliente ({money(total)}).
      </p>
    );
  }
  return (
    <div className="mb-3 space-y-2">
      <p className="text-sm text-muted-foreground">
        Que te transfiera <span className="tabular font-semibold text-foreground">{money(total)}</span> a:
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(alias);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50"
      >
        <span className="flex-1 truncate text-sm font-semibold text-foreground">{alias}</span>
        {copiado ? (
          <Check className="size-4 text-success-ink" />
        ) : (
          <Copy className="size-4 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground">{copiado ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}

/** Alta rápida: nombre + precio, nada más. El catálogo se arma vendiendo. */
function AltaRapida({
  barcode,
  sugerencia,
  canCreate,
  onCancel,
  onCreated,
}: {
  barcode: string | null;
  sugerencia: { nombre: string; marca: string | null } | null;
  canCreate: boolean;
  onCancel: () => void;
  onCreated: (p: { id: string; name: string; price: number }) => void;
}) {
  /* La sugerencia llega YA resuelta desde el padre: la búsqueda en el catálogo
     ocurre antes de abrir este diálogo. Así no hay estado de carga acá adentro
     ni un efecto que sincronice props con estado. */
  const [name, setName] = useState(sugerencia?.nombre ?? "");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [delCatalogo, setDelCatalogo] = useState(!!sugerencia);
  const [opciones, setOpciones] = useState<
    { ean: string; nombre: string; marca: string | null }[]
  >([]);
  const [catalogoRef, setCatalogoRef] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* Si el código no se reconoció, buscar por nombre mientras escribe. Es el
     camino de los cigarrillos —que el dataset del Estado no publica— y de
     cualquier producto que falte: elige de la lista y su escaneo aporta el
     código real que nadie tenía mapeado. */
  function alEscribirNombre(v: string) {
    setName(v);
    setDelCatalogo(false);
    setCatalogoRef(null);
    if (sugerencia || v.trim().length < 2) {
      setOpciones([]);
      return;
    }
    buscarPorNombre(v)
      .then(setOpciones)
      .catch(() => setOpciones([]));
  }

  function guardar() {
    startTransition(async () => {
      const res = await quickCreateProduct({
        name,
        price: Number(price),
        barcode,
        catalogoRef,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated({ id: res.id, name: res.name, price: res.price });
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent">
            <PackagePlus className="size-5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Producto nuevo</h2>
            <p className="text-xs text-muted-foreground">
              {barcode ? `Código ${barcode}` : "Sin código"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {!canCreate ? (
          <p className="text-sm text-muted-foreground">
            No tenés permiso para dar de alta productos. Pedíselo al dueño.
          </p>
        ) : (
          <>
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
                {error}
              </p>
            )}
            <div className="space-y-3">
              {delCatalogo && (
                <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success-ink ring-1 ring-success/25">
                  <Sparkles className="mt-0.5 size-4 shrink-0" />
                  Lo reconocimos. Revisá el nombre y poné tu precio.
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="qp-name" className="text-sm font-medium">
                  ¿Qué es?
                </label>
                <input
                  id="qp-name"
                  value={name}
                  onChange={(e) => alEscribirNombre(e.target.value)}
                  autoFocus={!barcode && !sugerencia}
                  placeholder="Coca-Cola 500ml"
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
                {opciones.length > 0 && (
                  <ul className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background">
                    {opciones.map((o) => (
                      <li key={o.ean}>
                        <button
                          type="button"
                          onClick={() => {
                            setName(o.nombre);
                            setCatalogoRef(o.ean);
                            setOpciones([]);
                            setDelCatalogo(true);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                        >
                          <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                          {o.marca && (
                            <span className="shrink-0 text-xs text-muted-foreground">{o.marca}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qp-price" className="text-sm font-medium">
                  ¿A cuánto lo vendés?
                </label>
                <input
                  id="qp-price"
                  autoFocus={!!sugerencia}
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="1800"
                  className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={guardar}
                disabled={pending || !name.trim() || !price}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                Guardar y agregar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-7 cursor-pointer place-items-center rounded-md border border-border text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-foreground"
    >
      {children}
    </button>
  );
}
