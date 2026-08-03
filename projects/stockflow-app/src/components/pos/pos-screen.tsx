"use client";

import { useMemo, useState, useTransition, useCallback, useRef, useEffect, type ComponentType } from "react";
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
  Split,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CategoryChips } from "@/components/ui/category-chips";
import { EmptyArt } from "@/components/ui/empty-art";
import { money } from "@/lib/format";
import {
  registerSale,
  registerSplitSale,
  quickCreateProduct,
  buscarEnCatalogo,
  buscarPorNombre,
  buscarProductoPorCodigo,
  buscarProductos,
  buscarClientes,
} from "@/app/pos/actions";
import {
  vincularVenta,
  crearCobroQR,
  crearCobroSplit,
  crearCobroPoint,
  crearCobroSplitPoint,
} from "@/app/pos/cobro-qr-actions";
import { anularVenta } from "@/app/admin/caja/actions";
import { signOut } from "@/app/login/actions";
import { useWedgeScanner } from "./use-wedge-scanner";
import { CameraScanner } from "./camera-scanner";
import { CobroQrDialog } from "./cobro-qr-dialog";
import { CobroPointDialog } from "./cobro-point-dialog";

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
  /** ¿Alguien contó la góndola? false = se vende, pero el número no vale. */
  stockConfiable?: boolean;
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
/**
 * Una línea del carrito. Unión discriminada a propósito: TypeScript obliga a
 * distinguir producto de monto libre en CADA punto donde se arma plata, en vez de
 * dejar campos opcionales que se pueden olvidar.
 *
 * `libre` = cobrar un importe SIN producto (business-rules §3). Es la válvula de
 * escape del mostrador: si algo no está en el catálogo, el cajero cobra igual en vez
 * de fabricar un producto basura o duplicado para poder cerrar la venta.
 */
type Linea =
  | { tipo: "producto"; producto: PosProduct; cantidad: number }
  | { tipo: "libre"; id: string; label: string; amount: number; cantidad: number };

/* Helpers de línea: el ÚNICO lugar que sabe leer/serializar una línea. Antes el
   payload de `items` se armaba a mano en 8 lugares distintos; con monto libre eso
   serían 8 oportunidades de mandar mal la plata. */
const lineaId = (l: Linea): string => (l.tipo === "producto" ? l.producto.id : l.id);
const lineaNombre = (l: Linea): string => (l.tipo === "producto" ? l.producto.name : l.label);
const lineaPrecio = (l: Linea): number => (l.tipo === "producto" ? l.producto.price : l.amount);
const lineaEmoji = (l: Linea): string =>
  l.tipo === "producto" ? (l.producto.emoji ?? "📦") : "🧾";

/** Carrito → `items` de register_sale. product_id null = monto libre. */
function itemsDeCarrito(carrito: Linea[]) {
  return carrito.map((l) =>
    l.tipo === "producto"
      ? { product_id: l.producto.id, qty: l.cantidad }
      : { product_id: null, qty: l.cantidad, free_amount: l.amount, name: l.label },
  );
}
type Montos = { cash: string; card: string; transfer: string; qr: string };
type Pago = { method: string; amount: number };
/**
 * Pata electrónica de un split en curso (Paso 3). `pagos` = el reparto completo a
 * registrar al acreditar; `legAmount` = lo que cobra MP ahora; `fase` = en qué paso del
 * ruteo está (preguntar destino → cobrar por ese canal).
 */
type SplitLeg = {
  pagos: Pago[];
  legAmount: number;
  fase: "elegir-qr" | "elegir-tarjeta" | "qr-pantalla" | "qr-terminal" | "card-terminal";
  paymentType?: "credit_card" | "debit_card";
};

const MEDIOS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transfer.", icon: ArrowRightLeft },
  { key: "account", label: "Fiado", icon: UserRound },
  { key: "split", label: "Dividido", icon: Split },
] as const;

type Medio = (typeof MEDIOS)[number]["key"];

export function PosScreen({
  storeName,
  products,
  canSellOnCredit,
  canQuickAdd,
  margenDefault,
  margenMinimo,
  redondeo: redondeoPrecio,
  isOwner,
  mpConectado,
  posnetActivo,
  transferAlias,
  confirmMethods,
  categories,
  sinCategoria,
  totalProductos,
}: {
  storeName: string;
  /** Tiles curados: los más vendidos, ya rankeados por la base (escala Fase 2). */
  products: PosProduct[];
  canSellOnCredit: boolean;
  /** Espeja el gate del server de quickCreateProduct (owner || can_receive_stock):
      la UI no debe ser MÁS estricta — un cajero con permiso quedaba ante un
      diálogo muerto en plena venta. */
  canQuickAdd: boolean;
  /** Ganancia con la que la caja propone el precio al dar de alta (ajustes). */
  margenDefault: number;
  /** Umbral de aviso por margen corto (ajustes): advierte, no bloquea. */
  margenMinimo: number;
  /** Redondeo de precios del negocio (el mismo del remarcado masivo). */
  redondeo: number;
  isOwner: boolean;
  /** ¿El negocio conectó su cuenta de MercadoPago? Decide si el QR lo genera la app. */
  mpConectado: boolean;
  /** ¿Hay terminal Point configurada? Si sí, el cobro con MP pregunta terminal/pantalla. */
  posnetActivo: boolean;
  /** Alias/CVU del negocio para mostrar al cobrar por transferencia. */
  transferAlias: string | null;
  /** Perilla por método: ¿pedir confirmación antes de cobrar? (QR tiene su diálogo). */
  confirmMethods: { cash: boolean; card: boolean; transfer: boolean; account: boolean };
  /** Categorías con contador REAL, ya ordenadas por rotación (chips + alta rápida). */
  categories: { id: string; name: string; emoji: string | null; color: string | null; count: number }[];
  /** Productos sin categoría (la deuda del catálogo): habilita su filtro. */
  sinCategoria: number;
  /** Cuántos productos activos hay REALMENTE (el precargado está acotado a 500). */
  totalProductos: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<Medio>("cash");
  const [cobrandoQr, setCobrandoQr] = useState(false);
  /** Cobro con MP y posnet: pregunta terminal vs QR en pantalla antes de cobrar. */
  const [preguntandoCobro, setPreguntandoCobro] = useState(false);
  /** Cobro empujado a la terminal Point (Fase 2 QR / Fase 3 tarjeta). */
  const [cobrandoPoint, setCobrandoPoint] = useState(false);
  /** Tarjeta con posnet: pregunta débito/crédito antes de mandar a la terminal (Fase 3). */
  const [preguntandoTarjeta, setPreguntandoTarjeta] = useState(false);
  /** Tipo elegido; null = el cobro en terminal es QR, no tarjeta. */
  const [tipoTarjeta, setTipoTarjeta] = useState<"credit_card" | "debit_card" | null>(null);
  /** Reparto del pago dividido: cuánto va en cada medio (string por input). */
  const [montos, setMontos] = useState<Montos>({ cash: "", card: "", transfer: "", qr: "" });
  /** Pata electrónica de un split en curso (Paso 3): ask + diálogo + pagos a registrar. */
  const [splitLeg, setSplitLeg] = useState<SplitLeg | null>(null);
  /** Paso de confirmación (armar → confirmar) del pie del carrito. */
  const [confirmando, setConfirmando] = useState(false);
  /** Lockout anti-doble-tap: Confirmar no acepta input los primeros 250ms. */
  const [confirmReady, setConfirmReady] = useState(false);
  /** Efectivo: con cuánto paga el cliente (para calcular el vuelto y reconciliar). */
  const [tendered, setTendered] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  /** Consultando un código contra la base porque el caché local no lo tenía. */
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  /* ESCALA F2: resultados de la búsqueda server-side. null = no hay búsqueda activa
     (se muestran los destacados). Array vacío = buscó y no encontró nada. */
  const [resultados, setResultados] = useState<PosProduct[] | null>(null);
  const [totalResultados, setTotalResultados] = useState(0);
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  /** Diálogo de monto libre. `sugerencia` = lo que el cajero venía buscando. */
  const [montoLibre, setMontoLibre] = useState<{ sugerencia: string } | null>(null);
  /** Clientes de fiado: se cargan bajo demanda, no en cada render. */
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsCargados, setClientsCargados] = useState(false);
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
    /** Lo que dijo el CATÁLOGO (solo en el camino del escaneo). */
    sugerencia: { nombre: string; marca: string | null } | null;
    /** Lo que tipeó el cajero (camino de búsqueda sin resultados). */
    nombreInicial?: string;
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
  /* ESCALA F2 visual: los chips llegan del server con contador REAL
     (categorias_resumen) y ya ordenados por rotación de 14 días. Derivarlos del
     catálogo cargado (como antes) garantizaba contadores falsos con catálogo grande. */
  const categorias = categories;

  /* Orden por RITMO de venta, no alfabético: lo que se vende 20 veces por día
     queda en la primera fila y el cajero no lo busca. Empate → alfabético. */
  /* ESCALA FASE 2 — la búsqueda dejó de ser un filter() sobre el catálogo entero.
     Sin texto ni categoría: se muestran los destacados que ya vinieron rankeados de
     la base. Con texto o categoría: la lista la trae `buscarProductos` (server-side),
     con debounce para no disparar una query por tecla. */
  const buscando = busqueda.trim().length > 0 || cat !== null;

  useEffect(() => {
    const q = busqueda.trim();
    let vivo = true;
    // Todo el estado se toca DENTRO del timeout: nada de setState síncrono en el
    // effect (dispara renders en cascada).
    const t = setTimeout(() => {
      if (!vivo) return;
      if (!buscando) {
        setResultados(null);
        setTotalResultados(0);
        return;
      }
      setBuscandoProductos(true);
      buscarProductos({ q: q || null, categoria: cat, limit: 48, offset: 0 })
        .then((r) => {
          if (!vivo) return;
          setResultados(
            r.items.map((p) => ({
              id: p.id,
              name: p.name,
              emoji: p.emoji,
              color: p.color,
              price: p.price,
              stock: p.stock,
              categoryId: p.categoryId,
              categoryName: p.categoryName,
              barcodes: [],
              stockConfiable: p.stockConfiable,
              sold14d: p.sold14d,
            })),
          );
          setTotalResultados(r.total);
        })
        .catch(() => {
          if (vivo) setResultados([]);
        })
        .finally(() => {
          if (vivo) setBuscandoProductos(false);
        });
    }, 180);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busqueda, cat, buscando]);

  const visibles = buscando ? (resultados ?? []) : products;

  const total = carrito.reduce((a, l) => a + lineaPrecio(l) * l.cantidad, 0);
  const unidades = carrito.reduce((a, l) => a + l.cantidad, 0);
  const cliente = clienteId ? (clients.find((c) => c.id === clienteId) ?? null) : null;

  /* Los clientes de fiado se piden recién cuando el cajero elige ese medio: antes
     viajaban ~300 en CADA render del POS para un <select> que casi no se abre. */
  useEffect(() => {
    if (medio !== "account" || clientsCargados) return;
    let vivo = true;
    buscarClientes()
      .then((cs) => {
        if (!vivo) return;
        setClients(cs);
        setClientsCargados(true);
      })
      .catch(() => {
        if (vivo) setClientsCargados(true);
      });
    return () => {
      vivo = false;
    };
  }, [medio, clientsCargados]);

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
      // Solo se agrupan líneas de PRODUCTO: dos montos libres de $500 son dos
      // cobros distintos (dos fotocopias, dos servicios) y se listan por separado.
      const existente = prev.find((l) => l.tipo === "producto" && l.producto.id === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.tipo === "producto" && l.producto.id === producto.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l,
        );
      }
      return [...prev, { tipo: "producto", producto, cantidad: 1 }];
    });
  }, []);

  /**
   * Agrega una línea de MONTO LIBRE: cobra un importe sin crear producto.
   *
   * Es la válvula de escape contra la patología del RIESGO 0: si el cajero no
   * encuentra algo y solo tiene "darlo de alta", termina fabricando un producto
   * basura o duplicado para poder cobrar. Con esto cierra la venta y el catálogo
   * queda limpio. No mueve stock, no crea catálogo, y nunca se le ofrece alta.
   */
  const agregarMontoLibre = useCallback((amount: number, label: string) => {
    setConfirmando(false);
    setCarritoViejo(false);
    setCarrito((prev) => [
      ...prev,
      {
        tipo: "libre",
        id: `libre-${crypto.randomUUID()}`,
        label: label.trim() || "Monto libre",
        amount,
        cantidad: 1,
      },
    ]);
  }, []);

  /**
   * Un beep del lector o de la cámara entra por acá.
   *
   * DOS pasos, y el segundo es el que cierra el RIESGO 0 (`docs/inventario-escala-audit.md`):
   * el catálogo precargado está acotado (`limit(500)` por nombre), así que un producto
   * que EXISTE puede no estar en memoria. Antes eso caía derecho en "alta rápida" y el
   * cajero terminaba creando un DUPLICADO con stock 0. Ahora, si el caché no lo tiene,
   * se le pregunta a la BASE (`producto_por_codigo`) y recién si ahí tampoco está se
   * ofrece darlo de alta.
   *
   * El caché sigue primero a propósito: resuelve el 99% de los escaneos sin round-trip
   * y mantiene el cobro por debajo de los 15 segundos.
   */
  const onScan = useCallback(
    (code: string) => {
      /* El escáner se cierra solo cuando está en modo simple. Acá NO se cierra
         a ciegas: en continuo la venta se arma detrás de la cámara. Lo que sí
         cierra siempre es un código desconocido — el alta necesita la pantalla
         entera (más abajo). */
      const codigo = code.trim();
      if (!codigo) return;

      const encontrado = porCodigo.get(codigo);
      if (encontrado) {
        agregar(encontrado);
        setAviso({ tone: "ok", text: `${encontrado.name} agregado` });
        return;
      }

      // De acá para abajo puede terminar en el alta rápida: la cámara estorba.
      setCamaraAbierta(false);

      // No está en el precargado: puede ser que NO exista, o que exista y haya
      // quedado fuera del corte. Lo resuelve la base, no la memoria.
      setBuscandoCodigo(true);
      buscarProductoPorCodigo(codigo)
        .then(async (p) => {
          if (p) {
            if (p.archivado) {
              // Existe pero está dado de baja: avisamos en vez de ofrecer un alta
              // que lo duplicaría.
              setAviso({
                tone: "warn",
                text: `${p.name} está dado de baja. Activalo desde Productos para venderlo.`,
              });
              return;
            }
            agregar({
              id: p.id,
              name: p.name,
              emoji: p.emoji,
              color: p.color,
              price: p.price,
              stock: p.stock,
              categoryId: p.categoryId,
              categoryName: p.categoryName,
              barcodes: p.barcodes,
              stockConfiable: p.stockConfiable,
              sold14d: 0,
            });
            setAviso({ tone: "ok", text: `${p.name} agregado` });
            return;
          }
          // Ahora sí: no existe en el negocio. Se consulta el catálogo compartido
          // y se abre el alta, ya con el nombre puesto si lo reconocimos.
          const sug = await buscarEnCatalogo(codigo).catch(() => null);
          setAltaRapida({ barcode: codigo, sugerencia: sug });
        })
        .catch(() => {
          // Si la consulta falla (red), NO ofrecemos alta: crear un duplicado por un
          // problema de conexión es peor que pedirle al cajero que reintente.
          setAviso({
            tone: "error",
            text: "No pudimos verificar ese código. Probá de nuevo.",
          });
        })
        .finally(() => setBuscandoCodigo(false));
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
        .map((l) => (lineaId(l) === id ? { ...l, cantidad: l.cantidad + delta } : l))
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
      prev.map((l) => (lineaId(l) === id ? { ...l, cantidad: n } : l)).filter((l) => l.cantidad > 0),
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
      // Con terminal Point configurada, preguntamos primero: ¿pasás la tarjeta por la
      // terminal o mostrás el QR en pantalla? Esa pregunta es también la salida si la
      // terminal se traba. Sin posnet, va derecho al QR de siempre.
      if (posnetActivo) setPreguntandoCobro(true);
      else setCobrandoQr(true);
      return;
    }

    // Tarjeta con posnet: preguntamos débito/crédito y lo mandamos a la terminal ya
    // listo para ese tipo. Sin posnet, la tarjeta sigue siendo el cobro a mano de
    // siempre (cae en el paso de confirmación de abajo).
    if (medio === "card" && mpConectado && posnetActivo) {
      setPreguntandoTarjeta(true);
      return;
    }

    // Pago dividido: abre su propio "estado B" (el editor de reparto).
    if (medio === "split") {
      setMontos({ cash: "", card: "", transfer: "", qr: "" });
      setConfirmando(true);
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

  /**
   * Registra la venta. `intentId` viene del cobro con QR/terminal cuando lo hubo.
   * `metodo` permite forzar el medio: el cobro por terminal Point se asienta como
   * `card` (es una tarjeta), aunque el cajero lo haya arrancado desde el botón "QR".
   */
  function registrar(intentId: string | null, metodo: Medio = medio) {
    startTransition(async () => {
      const res = await registerSale({
        items: itemsDeCarrito(carrito),
        payment_method: metodo,
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

      // Deshacer se ofrece si NO hubo captura externa (QR pagado ya tiene la plata
      // en MP → anular descuadraría; para eso está la anulación en Caja).
      finalizarVenta(res, intentId === null);
    });
  }

  /**
   * Cierra una venta OK: limpia todo, beep y toast. Compartido por el cobro normal y
   * el pago dividido — solo estado de UI, sin lógica de plata (esa vive en las RPCs).
   */
  function finalizarVenta(
    res: { saleId: string; total: number; replayed: boolean; overLimit: boolean; negativeStock: { name: string }[] },
    ofrecerUndo: boolean,
  ) {
    setCobrandoQr(false);
    setCobrandoPoint(false);
    setPreguntandoCobro(false);
    setPreguntandoTarjeta(false);
    setTipoTarjeta(null);
    setConfirmando(false);
    setTendered(null);
    setMontos({ cash: "", card: "", transfer: "", qr: "" });
    setSplitLeg(null);
    setMontoLibre(null);
    setCarritoViejo(false);
    setEditandoQty(null);
    setCarrito([]);
    setClienteId(null);
    setMedio("cash");
    idempotencyKey.current = crypto.randomUUID();

    if (res.replayed) {
      setAviso({ tone: "warn", text: `Este cobro ya estaba registrado (${money(res.total)}).` });
      return;
    }

    beep();
    const undoId = ofrecerUndo ? res.saleId : undefined;

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
  }

  /**
   * Confirma un pago dividido. El reparto se valida acá para el feedback inmediato,
   * pero la verdad la impone la RPC atómica (suma == total server-side; si no, rollback
   * sin huérfana). Con una parte QR (Paso 2) el cobro se vuelve asíncrono: primero se
   * cobra ESA parte por MercadoPago y la venta se registra al acreditar.
   */
  function confirmarSplit() {
    if (pending) return;
    const pagos = (["cash", "card", "transfer", "qr"] as const)
      .map((m) => ({ method: m, amount: parseMonto(montos[m]) }))
      .filter((p) => p.amount > 0);
    const suma = pagos.reduce((a, p) => a + p.amount, 0);

    if (pagos.length < 2) {
      setAviso({ tone: "error", text: "Dividí en al menos dos medios." });
      return;
    }
    if (Math.abs(suma - total) > 0.01) {
      setAviso({ tone: "error", text: "Las partes no suman el total." });
      return;
    }

    // La pata electrónica se rutea por la config de posnet (Paso 3).
    const qr = pagos.find((p) => p.method === "qr");
    const card = pagos.find((p) => p.method === "card");

    // Parte QR (siempre asíncrona). Con posnet, preguntamos terminal o pantalla.
    if (qr) {
      setSplitLeg({ pagos, legAmount: qr.amount, fase: posnetActivo ? "elegir-qr" : "qr-pantalla" });
      return;
    }
    // Parte tarjeta CON posnet → asíncrona (terminal): preguntamos débito/crédito. Sin
    // posnet, la tarjeta es a mano (inmediata) y cae en el registro directo de abajo.
    if (posnetActivo && card) {
      setSplitLeg({ pagos, legAmount: card.amount, fase: "elegir-tarjeta" });
      return;
    }

    // Todo inmediato (efectivo / tarjeta a mano / transferencia): registra directo.
    registrarSplitOffline(pagos);
  }

  /** Registra un split sin captura externa (todo inmediato). Se puede deshacer. */
  function registrarSplitOffline(pagos: Pago[]) {
    startTransition(async () => {
      const res = await registerSplitSale({
        items: itemsDeCarrito(carrito),
        pagos,
        idempotency_key: idempotencyKey.current,
      });
      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }
      finalizarVenta(res, true);
    });
  }

  /**
   * La pata electrónica del split se acreditó (QR o terminal): registra la venta split
   * (paid) y la vincula al intento. Si la caja se cae acá, el intento queda 'aprobado sin
   * venta' con el reparto guardado → el banner de Caja lo re-arma. Sin deshacer: hubo
   * captura externa.
   */
  function finalizarSplitLeg(intentId: string | null) {
    const leg = splitLeg;
    if (!leg) return;
    startTransition(async () => {
      const res = await registerSplitSale({
        items: itemsDeCarrito(carrito),
        pagos: leg.pagos,
        idempotency_key: idempotencyKey.current,
        paid: true,
      });
      if (!res.ok) {
        setAviso({ tone: "error", text: res.error });
        return;
      }
      if (intentId) {
        try {
          await vincularVenta(intentId, res.saleId);
        } catch {
          /* la venta está; el banner de Caja reconcilia por la misma clave */
        }
      }
      finalizarVenta(res, false);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {camaraAbierta && (
        <CameraScanner
          onScan={onScan}
          onClose={() => setCamaraAbierta(false)}
          modoInicial="simple"
          permitirContinuo
          titulo={
            carrito.length === 0
              ? "Escaneá lo que lleva"
              : `${carrito.length} en el ticket · ${money(total)}`
          }
        />
      )}

      {cobrandoQr && (
        <CobroQrDialog
          amount={total}
          crear={() =>
            crearCobroQR({
              items: itemsDeCarrito(carrito),
              amount: total,
              idempotency_key: idempotencyKey.current,
              descripcion: carrito.map(lineaNombre).join(", "),
            })
          }
          onPagado={(intentId) => registrar(intentId)}
          onCerrar={() => setCobrandoQr(false)}
        />
      )}

      {/* Pata electrónica de un split (Paso 3): se rutea por la config de posnet. */}
      {splitLeg?.fase === "elegir-qr" && (
        <PreguntaModal
          titulo="¿Dónde cobrás el QR?"
          monto={splitLeg.legAmount}
          onCerrar={() => {
            idempotencyKey.current = crypto.randomUUID();
            setSplitLeg(null);
          }}
          opciones={[
            {
              icon: CreditCard,
              label: "En el posnet",
              sub: "El QR se genera en la terminal",
              primary: true,
              onClick: () => setSplitLeg({ ...splitLeg, fase: "qr-terminal" }),
            },
            {
              icon: QrCode,
              label: "En pantalla",
              sub: "Lo escanea con el celular",
              onClick: () => setSplitLeg({ ...splitLeg, fase: "qr-pantalla" }),
            },
          ]}
        />
      )}

      {splitLeg?.fase === "elegir-tarjeta" && (
        <PreguntaModal
          titulo="¿Débito o crédito?"
          monto={splitLeg.legAmount}
          onCerrar={() => {
            idempotencyKey.current = crypto.randomUUID();
            setSplitLeg(null);
          }}
          opciones={[
            {
              icon: CreditCard,
              label: "Débito",
              sub: "Apoyás o pasás la tarjeta en el posnet",
              primary: true,
              onClick: () => setSplitLeg({ ...splitLeg, fase: "card-terminal", paymentType: "debit_card" }),
            },
            {
              icon: CreditCard,
              label: "Crédito",
              sub: "Las cuotas se eligen en el posnet",
              onClick: () => setSplitLeg({ ...splitLeg, fase: "card-terminal", paymentType: "credit_card" }),
            },
          ]}
        />
      )}

      {splitLeg?.fase === "qr-pantalla" && (
        <CobroQrDialog
          amount={splitLeg.legAmount}
          crear={() =>
            crearCobroSplit({
              items: itemsDeCarrito(carrito),
              pagos: splitLeg.pagos,
              leg_amount: splitLeg.legAmount,
              idempotency_key: idempotencyKey.current,
              descripcion: carrito.map(lineaNombre).join(", "),
            })
          }
          onPagado={(intentId) => finalizarSplitLeg(intentId)}
          onCerrar={() => {
            idempotencyKey.current = crypto.randomUUID();
            setSplitLeg(null);
          }}
        />
      )}

      {(splitLeg?.fase === "qr-terminal" || splitLeg?.fase === "card-terminal") && (
        <CobroPointDialog
          amount={splitLeg.legAmount}
          paymentType={splitLeg.paymentType}
          crear={() =>
            crearCobroSplitPoint({
              items: itemsDeCarrito(carrito),
              pagos: splitLeg.pagos,
              leg_amount: splitLeg.legAmount,
              idempotency_key: idempotencyKey.current,
              descripcion: carrito.map(lineaNombre).join(", "),
              payment_type: splitLeg.paymentType,
            })
          }
          onPagado={(intentId) => finalizarSplitLeg(intentId)}
          onFallback={() => {
            idempotencyKey.current = crypto.randomUUID();
            if (splitLeg.fase === "qr-terminal") {
              // La terminal se trabó: mostramos el QR en pantalla por esa parte.
              setSplitLeg({ ...splitLeg, fase: "qr-pantalla", paymentType: undefined });
            } else {
              // Tarjeta a mano: cobrás en tu posnet y registramos el split como inmediato.
              const pagos = splitLeg.pagos;
              setSplitLeg(null);
              registrarSplitOffline(pagos);
            }
          }}
          fallbackLabel={splitLeg.fase === "qr-terminal" ? "Cobrar con QR en pantalla" : "Cobrar a mano"}
          onCerrar={() => {
            idempotencyKey.current = crypto.randomUUID();
            setSplitLeg(null);
          }}
        />
      )}

      {/* Con posnet configurado: elegí por dónde cobra el cliente. La misma pregunta
          es la salida si la terminal se traba (un toque → QR en pantalla). */}
      {preguntandoCobro && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">¿Cómo cobrás?</p>
                <p className="tabular text-2xl font-semibold">{money(total)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreguntandoCobro(false)}
                aria-label="Cerrar"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setPreguntandoCobro(false);
                  setCobrandoPoint(true);
                }}
                className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl bg-primary px-4 text-left text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <QrCode className="size-5 shrink-0" />
                <span>
                  En la terminal
                  <span className="block text-xs font-normal opacity-80">El QR se genera en el posnet</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreguntandoCobro(false);
                  setCobrandoQr(true);
                }}
                className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <QrCode className="size-5 shrink-0" />
                <span>
                  QR en pantalla
                  <span className="block text-xs font-normal text-muted-foreground">Lo escanea con el celular</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cobrandoPoint && (
        <CobroPointDialog
          amount={total}
          crear={() =>
            crearCobroPoint({
              items: itemsDeCarrito(carrito),
              amount: total,
              idempotency_key: idempotencyKey.current,
              descripcion: carrito.map(lineaNombre).join(", "),
              payment_type: tipoTarjeta ?? undefined,
            })
          }
          // Sin tipo → QR en el posnet (se asienta como QR). Con tipo → tarjeta (medio
          // ya es "card"). `registrar` toma el medio, así que el registro sale bien solo.
          paymentType={tipoTarjeta ?? undefined}
          onPagado={(intentId) => registrar(intentId)}
          onFallback={() => {
            // Clave nueva: la orden del Point quedó atada a la vieja por idempotencia.
            idempotencyKey.current = crypto.randomUUID();
            if (tipoTarjeta) {
              // Tarjeta: la terminal falló → cobrás a mano en tu posnet y registramos
              // la venta como tarjeta, sin push.
              setCobrandoPoint(false);
              setTipoTarjeta(null);
              registrar(null);
            } else {
              // QR: caemos al QR en pantalla.
              setCobrandoPoint(false);
              setCobrandoQr(true);
            }
          }}
          fallbackLabel={tipoTarjeta ? "Cobrar a mano" : "Cobrar con QR en pantalla"}
          onCerrar={() => {
            idempotencyKey.current = crypto.randomUUID();
            setCobrandoPoint(false);
            setTipoTarjeta(null);
          }}
        />
      )}

      {/* Tarjeta con posnet: ¿débito o crédito? El tipo viaja a la terminal; las cuotas
          y el interés los ofrece el posnet según lo configurado en la cuenta de MP. */}
      {preguntandoTarjeta && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">¿Débito o crédito?</p>
                <p className="tabular text-2xl font-semibold">{money(total)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreguntandoTarjeta(false)}
                aria-label="Cerrar"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setPreguntandoTarjeta(false);
                  setTipoTarjeta("debit_card");
                  setCobrandoPoint(true);
                }}
                className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl bg-primary px-4 text-left text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <CreditCard className="size-5 shrink-0" />
                <span>
                  Débito
                  <span className="block text-xs font-normal opacity-80">Apoyás o pasás la tarjeta en el posnet</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreguntandoTarjeta(false);
                  setTipoTarjeta("credit_card");
                  setCobrandoPoint(true);
                }}
                className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                <CreditCard className="size-5 shrink-0" />
                <span>
                  Crédito
                  <span className="block text-xs font-normal text-muted-foreground">Las cuotas se eligen en el posnet</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {montoLibre && (
        <MontoLibreDialog
          sugerencia={montoLibre.sugerencia}
          onCancel={() => setMontoLibre(null)}
          onAgregar={(amount, label) => {
            agregarMontoLibre(amount, label);
            setMontoLibre(null);
            setBusqueda("");
          }}
        />
      )}

      {altaRapida && (
        <AltaRapida
          barcode={altaRapida.barcode}
          sugerencia={altaRapida.sugerencia}
          nombreInicial={altaRapida.nombreInicial}
          categories={categories}
          canCreate={canQuickAdd}
          margenDefault={margenDefault}
          margenMinimo={margenMinimo}
          redondeo={redondeoPrecio}
          onCancel={() => setAltaRapida(null)}
          onCobrarSuelto={(etiqueta) => {
            setAltaRapida(null);
            setMontoLibre({ sugerencia: etiqueta });
          }}
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
              // Recién creado sin contar: el tile dice "sin contar", no "sin stock".
              stockConfiable: p.stockConfiable ?? false,
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
            {/* Acceso PERMANENTE al monto libre, no solo cuando una búsqueda falla:
                el fraccionado, el servicio y el "cobrame esto" no se buscan primero. */}
            <button
              type="button"
              onClick={() => setMontoLibre({ sugerencia: "" })}
              aria-label="Cobrar un monto suelto, sin producto"
              title="Cobrar un monto suelto"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <Banknote className="size-5" />
            </button>
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
            maxVisible={6}
            sinCategoria={sinCategoria}
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
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-danger/60 bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger-ink transition-colors hover:bg-danger/20 disabled:opacity-50"
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

        {/* Encabezado de la grilla: qué está viendo el cajero. Sin búsqueda son los
            más vendidos (ya no "los primeros 500 alfabéticos"); con búsqueda, cuántos
            resultados hay de verdad. La búsqueda server-side reemplazó al aviso de
            truncado de Fase 1: ya no hay catálogo recortado que confesar. */}
        <div className="mx-4 mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {buscando
              ? buscandoProductos
                ? "Buscando…"
                : `${totalResultados} ${totalResultados === 1 ? "resultado" : "resultados"}${
                    totalResultados > visibles.length ? ` · mostrando ${visibles.length}` : ""
                  }`
              : `Lo que más vendés · ${totalProductos} productos en el catálogo`}
          </span>
          {buscandoProductos && <LoaderCircle className="size-3.5 shrink-0 animate-spin" />}
        </div>

        {/* El código escaneado no estaba entre los destacados: se está resolviendo
            contra la base antes de decidir si ofrecer el alta. */}
        {buscandoCodigo && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground ring-1 ring-border">
            <LoaderCircle className="size-4 animate-spin" />
            Buscando el código…
          </div>
        )}

        {visibles.length === 0 && !buscandoProductos ? (
          /* ANCLADO ARRIBA, no centrado en el alto restante: con la grilla curada
             (24 tiles) el área libre es enorme y `place-items-center` dejaba el
             mensaje flotando en el medio del vacío, que se lee como un bug. Se
             centra en horizontal y arranca donde arrancaría la grilla. */
          <div className="flex flex-1 justify-center px-6 pt-8 text-center sm:pt-10">
            <div className="w-full max-w-sm">
              {totalProductos === 0 && (
                <EmptyArt name="productos" alt="Una repisa vacía con un escáner" />
              )}
              {totalProductos === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no cargaste productos. Escaneá uno y lo damos de alta en 10 segundos.
                </p>
              ) : (
                /* Sin resultados NO puede ser un cartel muerto: el cajero está con
                   gente esperando. Las dos salidas reales van acá, a un toque. */
                <>
                  <p className="mb-1 text-sm font-medium text-foreground">
                    No encontré “{busqueda.trim()}”
                  </p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Cobralo igual y seguí. Si es algo que vas a vender seguido, dalo de alta.
                  </p>
                  {/* ORDEN DELIBERADO: cobrar el monto suelto es la acción PRIMARIA.
                      "Darlo de alta" como happy path empuja a un cajero apurado a
                      fabricar un producto basura o duplicado con tal de poder cobrar
                      — justo la patología que abrió el RIESGO 0. Primero se cierra la
                      venta; el catálogo se ordena después, con calma. */}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMontoLibre({ sugerencia: busqueda.trim() })}
                      className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Banknote className="size-4" /> Cobrar monto suelto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        /* El catálogo NO reconoció nada: el nombre es el que
                           tipeó el cajero. Va como `nombreInicial` para no
                           anunciar un reconocimiento que no existió (y para que
                           el buscador por nombre siga funcionando acá). */
                        setAltaRapida({
                          barcode: null,
                          sugerencia: null,
                          nombreInicial: busqueda.trim(),
                        });
                      }}
                      className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <PackagePlus className="size-4" /> Darlo de alta
                    </button>
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      className="flex h-10 w-full cursor-pointer items-center justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Volver a los más vendidos
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Grilla densa: 3 columnas ya en 390px y ~6 en escritorio. Antes eran
             2 y 4 con cards de 250px — con 200 SKUs el cajero scrolleaba una
             cuadra para cobrar un alfajor. */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 p-4 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {visibles.map((p) => {
              /* "Sin stock" en rojo sobre un producto que nadie contó le dice al
                 cajero que no existe algo que acaba de vender. Sin conteo no se
                 afirma nada del stock (puesta en marcha, 038). */
              const sinControl = p.stockConfiable === false;
              const sinStock = !sinControl && p.stock <= 0;
              const poco = !sinControl && p.stock > 0 && p.stock <= 3;
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
                <li key={lineaId(l)} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-lg" aria-hidden>
                    {lineaEmoji(l)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{lineaNombre(l)}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {l.tipo === "libre" ? (
                        /* Marcado explícito: el cajero (y el dueño mirando la venta)
                           tienen que ver que eso NO salió del catálogo. */
                        <span className="text-warning-ink">Monto libre · sin producto</span>
                      ) : (
                        `${money(l.producto.price)} c/u`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label={`Quitar uno de ${lineaNombre(l)}`}
                      onClick={() => cambiar(lineaId(l), -1)}
                    >
                      {l.cantidad === 1 ? (
                        <Trash2 className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </IconBtn>
                    {editandoQty === lineaId(l) ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        defaultValue={l.cantidad}
                        aria-label={`Cantidad de ${lineaNombre(l)}`}
                        onBlur={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          if (Number.isFinite(n) && n > 0) setCantidadAbs(lineaId(l), n);
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
                        onClick={() => setEditandoQty(lineaId(l))}
                        aria-label={`Escribir la cantidad de ${lineaNombre(l)}`}
                        className="tabular h-7 w-8 cursor-pointer rounded-md text-center text-sm font-semibold transition-colors hover:bg-secondary"
                      >
                        {l.cantidad}
                      </button>
                    )}
                    <IconBtn
                      label={`Agregar uno de ${lineaNombre(l)}`}
                      onClick={() => cambiar(lineaId(l), 1)}
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
          <div className="mb-3 grid grid-cols-6 gap-1.5">
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
          ) : medio === "split" ? (
            <ReparteMontos
              total={total}
              montos={montos}
              setMontos={setMontos}
              qrDisponible={mpConectado}
              posnetActivo={posnetActivo}
              pending={pending}
              onConfirmar={confirmarSplit}
              onVolver={volverAComponer}
            />
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

/**
 * Monto libre: cobrar un importe SIN crear un producto.
 *
 * Un solo campo obligatorio (el monto) porque esto se usa con gente esperando. La
 * etiqueta es opcional y sirve para que la venta se entienda después en Caja
 * ("Fotocopias", "Flete") — si no la ponen, queda "Monto libre".
 *
 * NO crea catálogo, NO mueve stock y NUNCA ofrece alta rápida: esa es justamente la
 * diferencia con darlo de alta, y la razón de que exista.
 */
function MontoLibreDialog({
  sugerencia,
  onCancel,
  onAgregar,
}: {
  /** Lo que el cajero venía buscando, para arrancar la etiqueta puesta. */
  sugerencia: string;
  onCancel: () => void;
  onAgregar: (amount: number, label: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [label, setLabel] = useState(sugerencia);
  const valor = parseMonto(monto);
  const listo = valor > 0;

  function confirmar() {
    if (!listo) return;
    onAgregar(valor, label);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center">
      <div className="w-full rounded-t-2xl border border-border bg-popover p-5 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent">
            <Banknote className="size-5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Cobrar un monto</h2>
            <p className="text-xs text-muted-foreground">Sin cargarlo al catálogo</p>
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

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="ml-monto" className="text-sm font-medium">
              ¿Cuánto le cobrás?
            </label>
            <input
              id="ml-monto"
              autoFocus
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
              inputMode="decimal"
              placeholder="1500"
              className="tabular h-12 w-full rounded-lg border border-input bg-background px-3 text-lg font-semibold outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ml-label" className="text-sm font-medium">
              ¿Qué es? <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="ml-label"
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 60))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
              placeholder="Monto libre"
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={!listo}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Agregar {listo ? money(valor) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Alta rápida: el catálogo se arma VENDIENDO (onboarding orgánico, docs §H).
 *
 * Regla de oro del mostrador: **confirmar, no tipear**. El cajero pone lo que le
 * cuesta —dato que el kiosquero sabe de memoria— y el precio sale calculado con
 * la ganancia del negocio. Un precio mal tipeado con gente esperando se cobra
 * mal en cada venta futura; un costo mal tipeado solo ensucia un margen.
 *
 * Un solo campo numérico con selector Costo/Precio: dos inputs numéricos en la
 * caja se confunden entre sí y duplican el barrido visual.
 */
function AltaRapida({
  barcode,
  sugerencia,
  nombreInicial,
  categories,
  canCreate,
  margenDefault,
  margenMinimo,
  redondeo,
  onCancel,
  onCreated,
  onCobrarSuelto,
}: {
  barcode: string | null;
  /** Identidad que aportó el CATÁLOGO público. null = el catálogo no lo conoce. */
  sugerencia: { nombre: string; marca: string | null } | null;
  /** Lo que tipeó el cajero al buscar. No es un reconocimiento: no lo anunciamos como tal. */
  nombreInicial?: string;
  /** Categorías EXISTENTES. Acá no se crean nuevas (eso es Fase 2, con el índice único). */
  categories: { id: string; name: string; emoji: string | null }[];
  canCreate: boolean;
  /** Ganancia con la que se PROPONE el precio (sobre el precio, como el resto de la app). */
  margenDefault: number;
  /** Umbral de aviso por margen corto: solo para advertir, nunca para bloquear. */
  margenMinimo: number;
  redondeo: number;
  onCancel: () => void;
  onCreated: (p: {
    id: string;
    name: string;
    price: number;
    /** ¿Se contó la góndola al darlo de alta? Sin conteo, el tile no afirma stock. */
    stockConfiable?: boolean;
  }) => void;
  /** Escape del mostrador: cobrar sin cargar, con la etiqueta ya puesta. */
  onCobrarSuelto: (etiqueta: string) => void;
}) {
  /* La sugerencia llega YA resuelta desde el padre: la búsqueda en el catálogo
     ocurre antes de abrir este diálogo. Así no hay estado de carga acá adentro
     ni un efecto que sincronice props con estado. */
  const [name, setName] = useState(sugerencia?.nombre ?? nombreInicial ?? "");
  /* `modo` decide qué significa el número que se tipea. Arranca en costo: es el
     dato que el kiosquero tiene en la cabeza y el que deja el margen sano. */
  const [modo, setModo] = useState<"costo" | "precio">("costo");
  const [costo, setCosto] = useState("");
  const [price, setPrice] = useState("");
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [mostrarCantidad, setMostrarCantidad] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [mostrarCategoria, setMostrarCategoria] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delCatalogo, setDelCatalogo] = useState(!!sugerencia);
  const [opciones, setOpciones] = useState<
    { ean: string; nombre: string; marca: string | null }[]
  >([]);
  const [catalogoRef, setCatalogoRef] = useState<string | null>(null);
  /* Categoría del producto nuevo. Opcional a propósito: obligar a elegir hace que el
     cajero invente una o abandone el alta con gente esperando. Pero ofrecerla acá
     corta la fábrica de "Sin categoría" que hoy sabotea el agrupado. */
  const [categoryId, setCategoryId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  /* Si el código no se reconoció, buscar por nombre mientras escribe. Es el
     camino de los cigarrillos —que el dataset del Estado no publica— y de
     cualquier producto que falte: elige de la lista y su escaneo aporta el
     código real que nadie tenía mapeado. */
  function alEscribirNombre(v: string) {
    setName(v);
    setDelCatalogo(false);
    setCatalogoRef(null);
    if (v.trim().length < 2) {
      setOpciones([]);
      return;
    }
    buscarPorNombre(v)
      .then(setOpciones)
      .catch(() => setOpciones([]));
  }

  /* Precio propuesto = costo con la ganancia del negocio, redondeado hacia
     arriba con el mismo redondeo que usa el remarcado masivo. Sobre el PRECIO,
     igual que el margen que muestra cada ficha: precio = costo / (1 - m/100). */
  const costoNum = Number(costo);
  const paso = redondeo > 0 ? redondeo : 1;
  const precioSugerido =
    costoNum > 0 && margenDefault > 0 && margenDefault < 100
      ? Math.ceil(costoNum / (1 - margenDefault / 100) / paso) * paso
      : 0;
  const precioFinal = modo === "costo" ? precioSugerido : Number(price);
  const margenReal =
    costoNum > 0 && precioFinal > 0 ? ((precioFinal - costoNum) / precioFinal) * 100 : null;
  const listo = !!name.trim() && precioFinal > 0;

  /** Pasar a tipear el precio: arranca con el sugerido, nunca en blanco —
      confirmar-con-retoque tiene que seguir siendo más barato que tipear. */
  function pasarAPrecio() {
    if (modo === "precio") return;
    setPrice(precioSugerido > 0 ? String(precioSugerido) : "");
    setModo("precio");
  }

  function guardar() {
    startTransition(async () => {
      const res = await quickCreateProduct({
        name,
        price: precioFinal,
        cost: costoNum > 0 ? costoNum : null,
        // "" = no contó; "0" tipeado SÍ es un conteo legítimo ("se vendió el último").
        cantidad: mostrarCantidad && cantidad !== "" ? Number(cantidad) : null,
        barcode,
        catalogoRef,
        category_id: categoryId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      /* `existing`: el código ya estaba en el negocio y el server devolvió ESE
         producto en vez de crear un duplicado. Para el cajero es lo mismo —se suma
         al carrito y sigue vendiendo—; la diferencia es que el catálogo no se ensució. */
      onCreated({
        id: res.id,
        name: res.name,
        price: res.price,
        stockConfiable: res.stockConfiable,
      });
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
                  Lo reconocimos. Poné cuánto te cuesta y calculamos el precio.
                </p>
              )}

              {/* Con hit del catálogo el nombre NO es un input: es una línea que
                  se confirma. Gana altura con el teclado abierto y saca un campo
                  del barrido visual. Si hace falta, "Cambiar" lo vuelve editable. */}
              {delCatalogo && !editandoNombre ? (
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
                  <button
                    type="button"
                    onClick={() => setEditandoNombre(true)}
                    className="shrink-0 cursor-pointer text-xs font-medium text-primary hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
              <div className="space-y-1.5">
                <label htmlFor="qp-name" className="text-sm font-medium">
                  ¿Qué es?
                </label>
                <input
                  id="qp-name"
                  value={name}
                  onChange={(e) => alEscribirNombre(e.target.value)}
                  autoFocus={!barcode || editandoNombre}
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
              )}

              {/* UN solo campo numérico. El selector dice qué estás poniendo:
                  el costo (y el precio sale solo) o el precio directo, para
                  cuando no sabés lo que te cuesta. */}
              <div className="space-y-2">
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  {(["costo", "precio"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => (m === "precio" ? pasarAPrecio() : setModo("costo"))}
                      aria-pressed={modo === m}
                      className={cn(
                        "h-8 flex-1 cursor-pointer rounded-md text-xs font-semibold transition-colors",
                        modo === m
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m === "costo" ? "Costo" : "Precio"}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="qp-num" className="text-sm font-medium">
                    {modo === "costo" ? "¿Cuánto te cuesta?" : "¿A cuánto lo vendés?"}
                  </label>
                  <input
                    id="qp-num"
                    autoFocus={!!barcode && !editandoNombre}
                    value={modo === "costo" ? costo : price}
                    /* Cota de 7 dígitos: si el cajero escanea el próximo producto
                       sin cerrar el diálogo, el lector vuelca el EAN acá adentro.
                       Con el cap, un código no se convierte en un precio de
                       7 millones. */
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
                      if (modo === "costo") setCosto(v);
                      else setPrice(v);
                    }}
                    inputMode="numeric"
                    placeholder={modo === "costo" ? "900" : "1800"}
                    className="tabular h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                {/* El número grande es la confirmación: lo que se va a cobrar. */}
                <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Se vende a</p>
                      <p className="tabular text-2xl font-bold leading-tight">
                        {precioFinal > 0 ? money(precioFinal) : "$ —"}
                      </p>
                    </div>
                    {modo === "costo" && precioSugerido > 0 && (
                      <button
                        type="button"
                        onClick={pasarAPrecio}
                        className="shrink-0 cursor-pointer rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        Otro precio
                      </button>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      margenReal !== null && margenReal < margenMinimo
                        ? "text-warning-ink"
                        : "text-muted-foreground",
                    )}
                  >
                    {precioFinal <= 0
                      ? modo === "costo"
                        ? "Poné cuánto te cuesta y calculamos el precio."
                        : "Poné el precio de venta."
                      : margenReal === null
                        ? "Sin costo cargado. Lo ponés después, cuando tengas la factura."
                        : margenReal < 0
                          ? "Así lo estarías vendiendo a pérdida."
                          : margenReal < margenMinimo
                            ? `Ojo: te queda ${margenReal.toFixed(0)}% de ganancia, menos de tu mínimo (${margenMinimo}%).`
                            : modo === "costo"
                              ? `${margenDefault}% de ganancia · redondeado a ${money(paso)}`
                              : `Te queda ${margenReal.toFixed(0)}% de ganancia`}
                  </p>
                </div>
              </div>

              {/* Opcionales como chips: no cuestan nada al camino rápido y
                  siguen estando a un toque. El default es NO contar — un campo
                  vacío a la vista invita a inventar un número, y una base falsa
                  es peor que ninguna. */}
              <div className="flex flex-wrap gap-2">
                {!mostrarCantidad && (
                  <button
                    type="button"
                    onClick={() => setMostrarCantidad(true)}
                    className="h-8 cursor-pointer rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    + ¿Cuántos tenés?
                  </button>
                )}
                {!mostrarCategoria && categories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarCategoria(true)}
                    className="h-8 cursor-pointer rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    + Categoría
                  </button>
                )}
              </div>

              {mostrarCantidad && (
                <div className="space-y-1.5">
                  <label htmlFor="qp-cant" className="text-sm font-medium">
                    ¿Cuántos tenés ahora?{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    id="qp-cant"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="12"
                    className="tabular h-11 w-24 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si lo contás, desde ahora te avisamos cuando se esté por acabar.
                  </p>
                </div>
              )}

              {mostrarCategoria && categories.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="qp-cat" className="text-sm font-medium">
                    Categoría <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <select
                    id="qp-cat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={guardar}
                disabled={pending || !listo}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                Guardar y agregar{precioFinal > 0 ? ` ${money(precioFinal)}` : ""}
              </button>

              {/* La salida cuando hay cola: cobra igual y el nombre queda como
                  etiqueta, alimentando la lista de lo que falta cargar. Antes la
                  única salida de este diálogo era la X, sin cobrar nada. */}
              <button
                type="button"
                onClick={() => onCobrarSuelto(name.trim() || sugerencia?.nombre || "")}
                className="w-full cursor-pointer py-1 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cobrar sin cargarlo
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

/** Parseo tolerante de un monto tipeado: dígitos + un punto decimal. */
function parseMonto(s: string): number {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const SPLIT_ROWS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transferencia", icon: ArrowRightLeft },
] as const;

// El QR se ofrece solo si el negocio conectó MercadoPago (es una parte asíncrona).
const QR_ROW = { key: "qr", label: "QR", icon: QrCode } as const;

/**
 * Modal de dos opciones (terminal/pantalla, débito/crédito). Reusable para los "ask"
 * de la pata electrónica de un split.
 */
function PreguntaModal({
  titulo,
  monto,
  onCerrar,
  opciones,
}: {
  titulo: string;
  monto: number;
  onCerrar: () => void;
  opciones: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    sub: string;
    primary?: boolean;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="tabular text-2xl font-semibold">{money(monto)}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {opciones.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={o.onClick}
              className={cn(
                "flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-colors",
                o.primary
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border text-foreground hover:bg-secondary",
              )}
            >
              <o.icon className="size-5 shrink-0" />
              <span>
                {o.label}
                <span
                  className={cn(
                    "block text-xs font-normal",
                    o.primary ? "opacity-80" : "text-muted-foreground",
                  )}
                >
                  {o.sub}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Reparto del pago dividido (Paso 1). El cajero pone cuánto va en cada medio; el
 * botón "Resto" completa lo que falta (maneja los centavos exactos). Confirmar se
 * habilita solo cuando la suma da el total y hay al menos dos partes — pero la RPC
 * atómica revalida la suma server-side, así que esto es feedback, no la autoridad.
 */
function ReparteMontos({
  total,
  montos,
  setMontos,
  qrDisponible,
  posnetActivo,
  pending,
  onConfirmar,
  onVolver,
}: {
  total: number;
  montos: Montos;
  setMontos: (m: Montos) => void;
  qrDisponible: boolean;
  posnetActivo: boolean;
  pending: boolean;
  onConfirmar: () => void;
  onVolver: () => void;
}) {
  const rows = qrDisponible ? [...SPLIT_ROWS, QR_ROW] : SPLIT_ROWS;
  const suma = rows.reduce((a, r) => a + parseMonto(montos[r.key]), 0);
  const resto = Math.round((total - suma) * 100) / 100;
  const partes = rows.filter((r) => parseMonto(montos[r.key]) > 0).length;
  const cuadra = Math.abs(resto) < 0.01;
  // Con posnet, tarjeta Y QR son las dos asíncronas (van a la terminal): una venta lleva
  // una sola parte electrónica (dos = análisis aparte). Sin posnet, la tarjeta es a mano.
  const dosElectronicas = posnetActivo && parseMonto(montos.card) > 0 && parseMonto(montos.qr) > 0;
  const listo = cuadra && partes >= 2 && !dosElectronicas;

  function set(key: keyof Montos, v: string) {
    setMontos({ ...montos, [key]: v.replace(/[^\d.]/g, "") });
  }
  function llenarResto(key: keyof Montos) {
    const otros = rows
      .filter((r) => r.key !== key)
      .reduce((a, r) => a + parseMonto(montos[r.key]), 0);
    const falta = Math.round((total - otros) * 100) / 100;
    setMontos({ ...montos, [key]: falta > 0 ? String(falta) : "" });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver
        </button>
        <span className="text-xs text-muted-foreground">Repartí el total entre los medios</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <div className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <r.icon className="size-4" /> {r.label}
            </div>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                inputMode="decimal"
                value={montos[r.key]}
                onChange={(e) => set(r.key, e.target.value)}
                placeholder="0"
                aria-label={`Monto en ${r.label}`}
                className="tabular h-11 w-full rounded-lg border border-input bg-background pl-6 pr-3 text-right text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => llenarResto(r.key)}
              className="h-11 shrink-0 cursor-pointer rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              Resto
            </button>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-sm ring-1",
          listo
            ? "bg-success/10 text-success-ink ring-success/25"
            : "bg-secondary/60 text-muted-foreground ring-border",
        )}
      >
        <span>
          {listo
            ? "Listo"
            : dosElectronicas
              ? "Con posnet, una sola parte electrónica por venta"
              : !cuadra
                ? resto > 0
                  ? "Falta"
                  : "Te pasaste"
                : "Usá al menos dos medios"}
        </span>
        {!cuadra && !dosElectronicas && (
          <span className="tabular font-semibold">{money(Math.abs(resto))}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onConfirmar}
        disabled={!listo || pending}
        className="mt-3 flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Confirmar {money(total)}
      </button>
    </div>
  );
}
