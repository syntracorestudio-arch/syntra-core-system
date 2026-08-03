/**
 * composer.ts — arma el reporte mensual DETERMINISTA (sin LLM) a partir de los
 * JSON que ya devuelven las RPCs. No recalcula nada: los números salen idénticos
 * a la página de Reportes. Devuelve un objeto priorizado y acotado (NO los 12
 * bloques de reportes_summary): resumen ejecutivo → 3 oportunidades → detalle →
 * alertas. La plantilla de email consume esto.
 */

import { ctaOportunidad, rutaOportunidad } from "./enlaces.ts";
import { verticalConfig, type Vertical } from "./verticals.ts";

// ── Formas de entrada (lo que devuelven las RPCs; numeric llega como string) ────

type Num = number | string | null | undefined;

export type DatosMensuales = {
  owner: { email: string | null; name: string | null };
  resumen: {
    money: {
      sold: Num; tickets: Num; units: Num; profit: Num; margin_pct: Num;
      cost_coverage: Num; prev_sold: Num; vs_prev_pct: Num;
    };
    top_profit: { name: string; emoji: string | null; profit: Num; units: Num; margin_pct: Num }[];
    dead_stock: { total: Num; items: { name: string; emoji: string | null; stock: Num; parado: Num }[] };
    /** Días desde la primera venta. Gobierna qué métricas ya significan algo. */
    period?: { days_of_use?: Num };
    credit: { given: Num; collected: Num; overdue: { name: string; owed: Num; dias: Num }[] };
  };
  medios: { by_method: { method: string; total: Num; count: Num }[]; on_credit: Num };
  gastos: {
    expenses: Num;
    expenses_by_category: { category: string; total: Num }[];
    expenses_loaded_ever: boolean;
  };
};

export type Alertas = {
  low_stock: { name: string; emoji: string | null; stock: Num }[];
  expiring: { name: string; emoji: string | null; days_left: Num }[];
};

export type Margenes = {
  productos: { name: string; emoji: string | null; plata_por_mes: Num }[];
  total_por_mes: Num;
};

// ── Forma de salida (lo que renderiza el email) ────────────────────────────────

export type Oportunidad = {
  tipo: "remarcar" | "stock_muerto" | "fiado";
  titulo: string;
  detalle: string;
  monto: number;
  /** Cuántos casos hay detrás. Va en el texto del botón: el número es el gancho. */
  cantidad: number;
  /** Pantalla donde se resuelve (relativa; el email la vuelve absoluta). */
  ruta: string;
  cta: string;
};

export type ReporteMensual = {
  /** `desde` = primer día del período, para que los links abran ESE mes. */
  negocio: { nombre: string; rubro: string; periodoLabel: string; desde: string };
  resumen: {
    facturado: number;
    gananciaBruta: number;
    gastos: number;
    gananciaNeta: number | null; // null → no cargó gastos: mostrar bruto + nudge
    tieneGastos: boolean;
    coberturaCosto: number; // 0..1 — si es baja, el margen es parcial
    tickets: number;
    vsMesAnteriorPct: number | null;
    facturadoPrev: number;
  };
  oportunidades: Oportunidad[];
  detalle: {
    topGanancia: { nombre: string; emoji: string | null; ganancia: number; unidades: number }[];
    medios: { metodo: string; total: number }[];
    gastosPorCategoria: { categoria: string; total: number }[];
  };
  alertas: {
    porVencer: { nombre: string; emoji: string | null; diasRestantes: number }[];
    stockBajo: { nombre: string; emoji: string | null; stock: number }[];
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const n = (v: Num): number => {
  const x = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(x) ? (x as number) : 0;
};

/** Etiqueta del período tipo "Julio 2026" en la zona del negocio (UTC noon safe). */
function periodoLabel(from: string): string {
  const d = new Date(`${from}T12:00:00Z`);
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1); // "julio de 2026" → "Julio de 2026"
}

const NOMBRE_METODO: Record<string, string> = {
  cash: "Efectivo", qr: "QR", card: "Tarjeta", transfer: "Transferencia", account: "Fiado",
};
const NOMBRE_CATEGORIA: Record<string, string> = {
  rent: "Alquiler", utilities: "Servicios", salary: "Sueldos", taxes: "Impuestos",
  supplies: "Insumos", maintenance: "Mantenimiento", other: "Otros",
};

// ── Construcción ────────────────────────────────────────────────────────────────

export function construirReporte(
  datos: DatosMensuales,
  alertas: Alertas,
  margenes: Margenes,
  meta: { storeName: string; vertical: Vertical | string; from: string },
): ReporteMensual {
  const vc = verticalConfig(meta.vertical);
  const money = datos.resumen.money;

  const facturado = n(money.sold);
  const gananciaBruta = n(money.profit);
  const gastos = n(datos.gastos.expenses);
  // Degradación honesta: net solo si el dueño CARGÓ gastos este mes. Si no, se
  // muestra el bruto y la plantilla pone el nudge — nunca net = bruto.
  const tieneGastos = datos.gastos.expenses_loaded_ever && gastos > 0;
  const gananciaNeta = tieneGastos ? gananciaBruta - gastos : null;

  // Oportunidades: se arman las que tienen valor real y se ordenan por plata.
  const oportunidades: Oportunidad[] = [];

  const remarcarMonto = n(margenes.total_por_mes);
  if (remarcarMonto > 0 && margenes.productos.length > 0) {
    const top = margenes.productos[0];
    const cant = margenes.productos.length;
    const resto = cant - 1;
    oportunidades.push({
      tipo: "remarcar",
      titulo: "Remarcá precios que quedaron viejos",
      detalle:
        resto > 0
          ? `${top.name} y ${resto} ${resto === 1 ? "producto" : "productos"} más quedaron por debajo de tu margen.`
          : `${top.name} quedó por debajo de tu margen.`,
      monto: remarcarMonto,
      cantidad: cant,
      ruta: rutaOportunidad("remarcar", { desde: meta.from }),
      cta: ctaOportunidad("remarcar", cant, vc.productos),
    });
  }

  /* La misma cota que usa Reportes (UMBRALES.stockMuerto): antes de 30 días de
     uso, "no se vendió en 30 días" no distingue un producto parado de uno que
     recién entró. Además el botón caería en un panel que dice "faltan N días"
     — verificado en el navegador. Si la RPC no informa los días, no se suprime:
     perder la oportunidad es peor que ofrecerla temprano. */
  const diasDeUso = datos.resumen.period?.days_of_use;
  const muertoMedible = diasDeUso == null || n(diasDeUso) >= 30;

  const muertoTotal = n(datos.resumen.dead_stock.total);
  if (muertoMedible && muertoTotal > 0 && datos.resumen.dead_stock.items.length > 0) {
    const top = datos.resumen.dead_stock.items[0];
    const cant = datos.resumen.dead_stock.items.length;
    oportunidades.push({
      tipo: "stock_muerto",
      titulo: "Tenés plata parada en el estante",
      detalle: `${cant} ${cant === 1 ? vc.productos.replace(/s$/, "") : vc.productos} sin vender hace +30 días. El más caro: ${top.name}.`,
      monto: muertoTotal,
      cantidad: cant,
      ruta: rutaOportunidad("stock_muerto", { desde: meta.from }),
      cta: ctaOportunidad("stock_muerto", cant, vc.productos),
    });
  }

  const fiadoAtrasado = datos.resumen.credit.overdue.reduce((s, c) => s + n(c.owed), 0);
  if (fiadoAtrasado > 0 && datos.resumen.credit.overdue.length > 0) {
    const top = datos.resumen.credit.overdue[0];
    const cant = datos.resumen.credit.overdue.length;
    oportunidades.push({
      tipo: "fiado",
      titulo: "Fiado atrasado para salir a cobrar",
      detalle:
        cant > 1
          ? `${cant} clientes con deuda vieja. El mayor: ${top.name}, hace ${n(top.dias)} días.`
          : `${top.name} debe hace ${n(top.dias)} días.`,
      monto: fiadoAtrasado,
      cantidad: cant,
      ruta: rutaOportunidad("fiado", { desde: meta.from }),
      cta: ctaOportunidad("fiado", cant, vc.productos),
    });
  }

  oportunidades.sort((a, b) => b.monto - a.monto);

  return {
    negocio: {
      nombre: meta.storeName,
      rubro: vc.label,
      periodoLabel: periodoLabel(meta.from),
      desde: meta.from,
    },
    resumen: {
      facturado,
      gananciaBruta,
      gastos,
      gananciaNeta,
      tieneGastos,
      coberturaCosto: n(money.cost_coverage),
      tickets: n(money.tickets),
      vsMesAnteriorPct: money.vs_prev_pct == null ? null : n(money.vs_prev_pct),
      facturadoPrev: n(money.prev_sold),
    },
    oportunidades: oportunidades.slice(0, 3),
    detalle: {
      topGanancia: datos.resumen.top_profit.slice(0, 5).map((t) => ({
        nombre: t.name,
        emoji: t.emoji,
        ganancia: n(t.profit),
        unidades: n(t.units),
      })),
      medios: datos.medios.by_method
        .filter((m) => n(m.total) > 0)
        .map((m) => ({ metodo: NOMBRE_METODO[m.method] ?? m.method, total: n(m.total) })),
      gastosPorCategoria: datos.gastos.expenses_by_category.map((g) => ({
        categoria: NOMBRE_CATEGORIA[g.category] ?? g.category,
        total: n(g.total),
      })),
    },
    alertas: {
      porVencer: (vc.vencimientosSensible ? alertas.expiring : alertas.expiring.slice(0, 5)).map((e) => ({
        nombre: e.name,
        emoji: e.emoji,
        diasRestantes: n(e.days_left),
      })),
      stockBajo: alertas.low_stock.slice(0, 5).map((s) => ({
        nombre: s.name,
        emoji: s.emoji,
        stock: n(s.stock),
      })),
    },
  };
}
