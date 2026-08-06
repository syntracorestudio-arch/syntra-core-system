/**
 * hechos.ts — la frontera entre los números del negocio y el modelo de lenguaje.
 *
 * Dos responsabilidades, las dos puras (por eso son testeables y no fallan en
 * silencio):
 *
 *   1. QUÉ SALE. `hechosDelReporte` arma el payload que viaja a la API: solo
 *      agregados ya calculados, de UN negocio, sin nombres de clientes ni del
 *      propio negocio. Nunca filas crudas — eso lo garantiza la forma del tipo,
 *      no la buena voluntad del prompt.
 *
 *   2. QUÉ VUELVE. `valoresPermitidos` + `verificarNarrativa` son el antídoto
 *      contra la alucinación: toda cifra del texto generado tiene que ser un
 *      número que ya computamos (o un redondeo honesto de uno). Si aparece una
 *      que nadie calculó, el párrafo entero se descarta. El modelo REDACTA;
 *      calcular no es su trabajo.
 */

import type { DatosMensuales, Margenes, ReporteMensual } from "./composer.ts";
import type { TipoAccion, Verdad } from "./analisis.ts";
import type { Mercado } from "./mercado.ts";

export type Hechos = {
  rubro: string;
  periodo: string;
  mes: {
    facturado: number;
    gananciaBruta: number;
    gananciaNeta: number | null;
    gastos: number;
    tieneGastos: boolean;
    /** Calculado acá: si lo estima el modelo, es una cifra inventada. */
    margenPct: number | null;
    coberturaCostoPct: number;
    tickets: number;
    /**
     * La comparación ya resuelta en palabras ("subió 75% contra junio"). Un
     * porcentaje pelado es ambiguo — un modelo real leyó `vsMesAnteriorPct: 75`
     * como "quedó en el 75% del mes anterior", que es lo contrario. El
     * verificador no puede atajar eso (75 es una cifra legítima), así que la
     * dirección se decide acá y no allá.
     */
    vsMesAnterior: string | null;
    mesAnterior: string | null;
    facturadoPrev: number;
  };
  oportunidades: { tipo: string; monto: number; cantidad: number; sujeto: string | null }[];
  masVendidos: { nombre: string; ganancia: number; unidades: number }[];
  medios: { metodo: string; total: number }[];
  gastos: { categoria: string; total: number }[];
  alertas: { porVencer: number; stockBajo: number };
  /**
   * El detalle accionable. Es lo que separa un análisis de un resumen: sin el
   * precio sugerido por producto, lo único que se puede decir es "conviene
   * remarcar", que es exactamente lo que el email ya muestra en una tarjeta.
   */
  fugas?: {
    remarcar: {
      totalPorMes: number;
      margenObjetivoPct: number | null;
      productos: {
        nombre: string;
        precioHoy: number;
        precioSugerido: number;
        margenHoyPct: number;
        plataPorMes: number;
        unidades30d: number;
      }[];
    };
    stockMuerto: { total: number; productos: { nombre: string; stock: number; plataParada: number }[] };
    fiado: { atrasado: number; clientes: number; diasDelMasViejo: number; dadoEsteMes: number; cobradoEsteMes: number };
    merma: number;
  };
  /** Dónde el dato es flojo. Decir "acá no sé" es una función, no una disculpa. */
  saludDelDato?: { coberturaCostoPct: number; productosSinCosto: number; preciosViejos: number };
  /**
   * Inflación oficial del rubro (INDEC). El ÚNICO dato que no calculamos: deja
   * comparar lo que subió el mercado contra lo que el dueño remarcó.
   */
  mercado?: Mercado;
  /** El ritmo del negocio: qué categorías y qué franjas lo mueven. */
  ritmo?: {
    categorias: { nombre: string; facturado: number; ganancia: number }[];
    franjas: { nombre: string; facturado: number; tickets: number }[];
  };
};

/** Los datos crudos que el email no renderiza pero el análisis necesita. */
export type Crudos = { datos: DatosMensuales; margenes: Margenes };

/** Ventana de "hace cuánto que no se mueve" que usa todo el producto. */
const VENTANA_DIAS = 30;

/* La plata va redondeada al peso: es como la ve el dueño en el email. Mandarle
   2484107.5 al modelo es invitarlo a escribir "$2.484.107,5" — y además haría que
   la cifra del texto no coincida con la del reporte. */
const $ = (x: number): number => Math.round(x);

const num = (v: unknown): number => {
  const x = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
};

/** El detalle accionable, armado desde los JSON crudos de las RPCs. */
function fugasDe(c: Crudos): NonNullable<Hechos["fugas"]> {
  const res = c.datos.resumen;
  const atrasados = res.credit?.overdue ?? [];
  return {
    remarcar: {
      totalPorMes: $(num(c.margenes.total_por_mes)),
      margenObjetivoPct: c.margenes.min_margen == null ? null : num(c.margenes.min_margen),
      productos: (c.margenes.productos ?? []).slice(0, 6).map((p) => ({
        nombre: p.name,
        precioHoy: $(num(p.precio)),
        precioSugerido: $(num(p.precio_sugerido)),
        margenHoyPct: Math.round(num(p.margen_hoy)),
        plataPorMes: $(num(p.plata_por_mes)),
        unidades30d: num(p.unidades_30d),
      })),
    },
    stockMuerto: {
      total: $(num(res.dead_stock?.total)),
      productos: (res.dead_stock?.items ?? []).slice(0, 5).map((p) => ({
        nombre: p.name,
        stock: num(p.stock),
        plataParada: $(num(p.parado)),
      })),
    },
    fiado: {
      atrasado: $(atrasados.reduce((s, x) => s + num(x.owed), 0)),
      clientes: atrasados.length,
      // Viene ordenado por antigüedad: el primero es el más viejo, no el que más debe.
      diasDelMasViejo: num(atrasados[0]?.dias),
      dadoEsteMes: $(num(res.credit?.given)),
      cobradoEsteMes: $(num(res.credit?.collected)),
    },
    merma: $(num(res.waste?.total)),
  };
}

export function hechosDelReporte(r: ReporteMensual, crudos?: Crudos, mercado?: Mercado | null): Hechos {
  const { resumen } = r;
  const salud = crudos?.datos.resumen.data_health;
  return {
    ...(mercado ? { mercado } : {}),
    ...(crudos
      ? {
          fugas: fugasDe(crudos),
          saludDelDato: {
            coberturaCostoPct: Math.round(num(salud?.cost_coverage)),
            productosSinCosto: num(salud?.products_without_cost),
            preciosViejos: num(salud?.stale_prices),
          },
          ritmo: {
            categorias: (crudos.datos.resumen.by_category ?? []).slice(0, 5).map((c) => ({
              nombre: c.name,
              facturado: $(num(c.revenue)),
              ganancia: $(num(c.profit)),
            })),
            franjas: (crudos.datos.resumen.by_slot ?? []).map((s) => ({
              nombre: s.name,
              facturado: $(num(s.total)),
              tickets: num(s.tickets),
            })),
          },
        }
      : {}),
    rubro: r.negocio.rubro,
    periodo: r.negocio.periodoLabel,
    mes: {
      facturado: $(resumen.facturado),
      gananciaBruta: $(resumen.gananciaBruta),
      gananciaNeta: resumen.gananciaNeta === null ? null : $(resumen.gananciaNeta),
      gastos: $(resumen.gastos),
      tieneGastos: resumen.tieneGastos,
      margenPct: resumen.facturado > 0 ? Math.round((resumen.gananciaBruta / resumen.facturado) * 100) : null,
      coberturaCostoPct: Math.round(resumen.coberturaCostoPct),
      tickets: resumen.tickets,
      vsMesAnterior:
        resumen.vsMesAnteriorPct == null || !resumen.mesAnteriorLabel
          ? null
          : `${resumen.vsMesAnteriorPct >= 0 ? "subió" : "bajó"} ${Math.abs(resumen.vsMesAnteriorPct)}% contra ${resumen.mesAnteriorLabel}`,
      mesAnterior: resumen.mesAnteriorLabel,
      facturadoPrev: $(resumen.facturadoPrev),
    },
    oportunidades: r.oportunidades.map((o) => ({
      tipo: o.tipo,
      monto: $(o.monto),
      cantidad: o.cantidad,
      /* El deudor de fiado se va con su nombre propio en el email al dueño, pero
         NUNCA en el prompt: es el único dato personal de un tercero en el reporte.
         Los productos sí viajan — sin ellos no hay insight que escribir. */
      sujeto: o.tipo === "fiado" ? null : o.sujeto,
    })),
    masVendidos: r.detalle.topGanancia.map((t) => ({
      nombre: t.nombre,
      ganancia: $(t.ganancia),
      unidades: t.unidades,
    })),
    medios: r.detalle.medios.map((m) => ({ metodo: m.metodo, total: $(m.total) })),
    gastos: r.detalle.gastosPorCategoria.map((g) => ({ categoria: g.categoria, total: $(g.total) })),
    alertas: { porVencer: r.alertas.porVencer.length, stockBajo: r.alertas.stockBajo.length },
  };
}

/** Toda cifra que el análisis tiene derecho a citar. */
export function valoresPermitidos(r: ReporteMensual, crudos?: Crudos, mercado?: Mercado | null): number[] {
  const h = hechosDelReporte(r, crudos, mercado);
  const v = new Set<number>([VENTANA_DIAS]);

  const sumar = (x: number | null | undefined) => {
    if (typeof x === "number" && Number.isFinite(x)) v.add(Math.abs(x));
  };

  sumar(h.mes.facturado);
  sumar(h.mes.gananciaBruta);
  sumar(h.mes.gananciaNeta);
  sumar(h.mes.gastos);
  sumar(h.mes.margenPct);
  sumar(h.mes.coberturaCostoPct);
  sumar(h.mes.tickets);
  sumar(r.resumen.vsMesAnteriorPct);
  sumar(h.mes.facturadoPrev);
  for (const o of h.oportunidades) {
    sumar(o.monto);
    sumar(o.cantidad);
  }
  for (const t of h.masVendidos) {
    sumar(t.ganancia);
    sumar(t.unidades);
  }
  for (const m of h.medios) sumar(m.total);
  for (const g of h.gastos) sumar(g.total);
  sumar(h.alertas.porVencer);
  sumar(h.alertas.stockBajo);
  // El año del período: "julio de 2026" es una fecha, no una cifra del negocio.
  sumar(Number(r.negocio.desde.slice(0, 4)));

  // Todo el detalle accionable: precios, márgenes, unidades, plata parada.
  if (h.fugas) {
    sumar(h.fugas.remarcar.totalPorMes);
    sumar(h.fugas.remarcar.margenObjetivoPct);
    for (const p of h.fugas.remarcar.productos) {
      sumar(p.precioHoy);
      sumar(p.precioSugerido);
      sumar(p.margenHoyPct);
      sumar(p.plataPorMes);
      sumar(p.unidades30d);
      // La suba en pesos y en porcentaje son cuentas que el dueño va a hacer:
      // se las damos hechas para que el modelo no tenga que calcularlas.
      sumar(p.precioSugerido - p.precioHoy);
      if (p.precioHoy > 0) sumar(Math.round(((p.precioSugerido - p.precioHoy) / p.precioHoy) * 100));
    }
    sumar(h.fugas.stockMuerto.total);
    for (const p of h.fugas.stockMuerto.productos) {
      sumar(p.stock);
      sumar(p.plataParada);
    }
    for (const x of Object.values(h.fugas.fiado)) sumar(x);
    sumar(h.fugas.merma);
  }
  if (h.saludDelDato) for (const x of Object.values(h.saludDelDato)) sumar(x);
  // La inflación del rubro: es cifra citable como cualquier otra.
  for (const d of h.mercado?.divisiones ?? []) sumar(d.variacionPct);
  if (h.ritmo) {
    for (const c of h.ritmo.categorias) {
      sumar(c.facturado);
      sumar(c.ganancia);
    }
    for (const f of h.ritmo.franjas) {
      sumar(f.facturado);
      sumar(f.tickets);
    }
  }

  return [...v];
}

/** Nombres propios que el texto puede contener (y que traen dígitos: "Coca 500ml"). */
export function nombresPermitidos(r: ReporteMensual, crudos?: Crudos): string[] {
  const h = hechosDelReporte(r, crudos);
  const n = [
    ...r.oportunidades.filter((o) => o.tipo !== "fiado").map((o) => o.sujeto),
    ...r.detalle.topGanancia.map((t) => t.nombre),
    ...r.alertas.porVencer.map((e) => e.nombre),
    ...r.alertas.stockBajo.map((s) => s.nombre),
    ...(h.fugas?.remarcar.productos ?? []).map((p) => p.nombre),
    ...(h.fugas?.stockMuerto.productos ?? []).map((p) => p.nombre),
    ...(h.ritmo?.categorias ?? []).map((c) => c.nombre),
  ];
  return n.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/**
 * Contra qué se verifica el análisis. `fugas` lista SOLO las que este negocio
 * tiene de verdad: si no hay fiado atrasado, una acción de tipo "fiado" es un
 * invento y se descarta, por más razonable que suene.
 */
export function verdadDelReporte(r: ReporteMensual, crudos?: Crudos, mercado?: Mercado | null): Verdad {
  const h = hechosDelReporte(r, crudos, mercado);
  const fugas: TipoAccion[] = [];
  if ((h.fugas?.remarcar.totalPorMes ?? 0) > 0) fugas.push("remarcar");
  if ((h.fugas?.stockMuerto.total ?? 0) > 0) fugas.push("stock_muerto");
  if ((h.fugas?.fiado.atrasado ?? 0) > 0) fugas.push("fiado");
  if ((h.saludDelDato?.productosSinCosto ?? 0) > 0 || (h.saludDelDato?.preciosViejos ?? 0) > 0) fugas.push("datos");
  return { numeros: valoresPermitidos(r, crudos, mercado), productos: nombresPermitidos(r, crudos), fugas };
}

export type Veredicto = { ok: true } | { ok: false; motivo: string };

const LARGO_MAX = 700;
const LARGO_MIN = 20;

/** Números escritos a la argentina: $12.480.300 · 12,5 · 12% · "12,5 millones". */
const CIFRA = /(\d[\d.]*(?:,\d+)?)\s*(millones|millón|mill(?:\.|ones)?|mil)?/gi;

function aNumero(crudo: string, escala: string | undefined): number | null {
  let s = crudo;
  // 12.480.300 → miles a la argentina. 1.5 (un decimal con punto) NO es eso.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/\.(?=\d{3}\b)/g, "");
  s = s.replace(",", ".");
  const x = Number(s);
  if (!Number.isFinite(x)) return null;
  const e = (escala ?? "").toLowerCase();
  if (e.startsWith("mill")) return x * 1_000_000;
  if (e === "mil") return x * 1_000;
  return x;
}

/** ¿`x` es el valor `v`, o un redondeo honesto suyo ("casi 12,5 millones")? */
function coincide(x: number, v: number): boolean {
  if (x === v) return true;
  if (v === 0) return false;
  const exp = Math.floor(Math.log10(Math.abs(v)));
  for (let sig = 1; sig <= 12; sig++) {
    const paso = Math.pow(10, exp - sig + 1);
    const redondeado = Math.round(v / paso) * paso;
    if (Math.abs(redondeado - x) < Math.max(1e-6, Math.abs(x) * 1e-9)) return true;
  }
  return false;
}

/**
 * @param nombres nombres propios a ignorar antes de buscar cifras — "Coca 500ml"
 * no es el número 500.
 */
/**
 * SOLO el control de cifras, sin reglas de largo. Existe separado porque el
 * análisis lo aplica a campos cortos ("Fiado atrasado" son 14 caracteres) y las
 * cotas de un párrafo entero no tienen nada que ver con las de un título.
 */
export function cifrasVerificables(texto: string, permitidos: number[], nombres: string[] = []): Veredicto {
  const limpio = texto.trim();
  // Los nombres propios salen del texto ANTES de buscar cifras.
  let sinNombres = limpio;
  for (const n of [...nombres].sort((a, b) => b.length - a.length)) {
    sinNombres = sinNombres.split(n).join(" ");
  }

  for (const m of sinNombres.matchAll(CIFRA)) {
    const x = aNumero(m[1], m[2]);
    if (x === null) continue;
    if (!permitidos.some((v) => coincide(x, v))) {
      return { ok: false, motivo: `numero_inventado:${x}` };
    }
  }
  return { ok: true };
}

/**
 * El control completo para un párrafo suelto: cifras + largo + higiene.
 * @param nombres nombres propios a ignorar — "Coca 500ml" no es el número 500.
 */
export function verificarNarrativa(texto: string, permitidos: number[], nombres: string[] = []): Veredicto {
  const limpio = texto.trim();
  if (limpio.length < LARGO_MIN) return { ok: false, motivo: "vacia" };
  if (limpio.length > LARGO_MAX) return { ok: false, motivo: `larga:${limpio.length}` };
  if (/<[^>]+>/.test(limpio)) return { ok: false, motivo: "html" };
  if (/https?:\/\/|www\./i.test(limpio)) return { ok: false, motivo: "link" };
  return cifrasVerificables(limpio, permitidos, nombres);
}
