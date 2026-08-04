/**
 * email.ts — plantilla HTML del reporte mensual. Email-safe: layout en tablas,
 * estilos inline, sin dependencias de CSS externo (los clientes de mail no lo
 * cargan). White-label: la banda de encabezado usa el acento del negocio.
 *
 * Fondo claro a propósito: la app es dark, pero un email dark se rompe en muchos
 * clientes (Gmail/Outlook invierten mal). El reporte se lee mejor en claro.
 */

import type { ReporteMensual } from "./composer.ts";
import { absolutizar } from "./enlaces.ts";
import type { Analisis } from "./analisis.ts";

const TINTA = "#0f172a";
const SUAVE = "#64748b";
const LINEA = "#e2e8f0";
const FONDO = "#f1f5f9";

function pesos(nro: number): string {
  const signo = nro < 0 ? "-" : "";
  return `${signo}$${Math.round(Math.abs(nro)).toLocaleString("es-AR")}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chip(emoji: string | null, texto: string): string {
  return `${emoji ? `${esc(emoji)} ` : ""}${esc(texto)}`;
}

const ICONO_OPORTUNIDAD: Record<string, string> = {
  remarcar: "🏷️",
  stock_muerto: "📦",
  fiado: "🧾",
};

export function asuntoReporte(r: ReporteMensual): string {
  return `Tu resumen de ${r.negocio.periodoLabel} — ${r.negocio.nombre}`;
}

/**
 * @param baseUrl URL pública de la app (NEXT_PUBLIC_APP_URL). Si falta, el
 * reporte se manda igual pero sin botones: mejor sin acción que con un link roto.
 * @param analisis Diagnóstico del asistente (Fase 2). Opcional por diseño: si el
 * modelo no está disponible o dijo algo que no pasó la verificación, el reporte
 * sale exactamente como antes.
 */
export function renderReporteHTML(
  r: ReporteMensual,
  accent: string,
  baseUrl?: string | null,
  analisis?: Analisis | null,
): string {
  const acento = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#2E6BFF";
  const { resumen } = r;
  const inicio = absolutizar(baseUrl, "/admin");

  // Ganancia: neta si cargó gastos; si no, bruta + nudge honesto.
  const gananciaLabel = resumen.tieneGastos ? "Ganancia neta" : "Ganancia bruta";
  const gananciaValor = resumen.tieneGastos ? resumen.gananciaNeta ?? 0 : resumen.gananciaBruta;
  // Una pérdida NO se muestra en el color de acento (lee como algo bueno): va en rojo.
  const gananciaColor = gananciaValor < 0 ? "#dc2626" : acento;

  // "vs. junio ($13.400.000)" en vez de "vs. mes anterior": el mes con nombre y
  // el número al lado es lo que hace que la variación signifique algo.
  const contra = resumen.mesAnteriorLabel
    ? `vs. ${esc(resumen.mesAnteriorLabel)} (${pesos(resumen.facturadoPrev)})`
    : "vs. mes anterior";
  const vs =
    resumen.vsMesAnteriorPct == null
      ? ""
      : resumen.vsMesAnteriorPct >= 0
        ? `<span style="color:#16a34a">▲ ${resumen.vsMesAnteriorPct}%</span> ${contra}`
        : `<span style="color:#dc2626">▼ ${Math.abs(resumen.vsMesAnteriorPct)}%</span> ${contra}`;

  const nudgeGastos = resumen.tieneGastos
    ? ""
    : `<tr><td style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e">
         💡 Estás viendo la <strong>ganancia bruta</strong>. Cargá tus gastos del mes (alquiler, luz, sueldos) para ver tu <strong>ganancia real</strong>.
       </td></tr><tr><td style="height:14px"></td></tr>`;

  /* El diagnóstico va DESPUÉS de los números y ANTES de las oportunidades:
     primero el dueño ve cuánto hizo, después por qué, y recién ahí qué hacer.
     Todo se escapa — el texto viene de un modelo, no del código, y no tiene por
     qué poder inyectar HTML en el email de nadie. */
  const lectura = !analisis
    ? ""
    : `<tr><td style="padding:16px 18px;background:#f8fafc;border-left:3px solid ${acento};border-radius:0 12px 12px 0">
         <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${SUAVE}">Tu análisis del mes</div>
         <div style="font-size:16px;font-weight:700;color:${TINTA};margin-top:8px;line-height:1.35">${esc(analisis.dolor.titulo)}</div>
         <div style="font-size:14px;color:${TINTA};margin-top:6px;line-height:1.6">${esc(analisis.dolor.porque)}</div>
         <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${SUAVE};margin-top:16px">Qué hacer esta semana</div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
           ${analisis.acciones
             .map(
               (a) => `<tr>
             <td style="width:16px;vertical-align:top;font-size:14px;line-height:1.6;color:${acento}">&bull;</td>
             <td style="font-size:14px;line-height:1.6;color:${TINTA};padding-bottom:4px">${esc(a.texto)}</td>
           </tr>`,
             )
             .join("")}
         </table>
         ${
           analisis.fuga
             ? `<div style="font-size:13px;color:${SUAVE};margin-top:14px;padding-top:12px;border-top:1px solid ${LINEA};line-height:1.6">${esc(
                 analisis.fuga,
               )}</div>`
             : ""
         }
         ${
           analisis.huecos
             ? `<div style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-top:12px;line-height:1.55">${esc(
                 analisis.huecos,
               )}</div>`
             : ""
         }
       </td></tr><tr><td style="height:20px"></td></tr>`;

  /* La RPC manda la cobertura en 0..100, no en 0..1: compararla contra 0,8 dejaba
     esta nota muda SIEMPRE (91 >= 0,8), y si alguna vez hubiera entrado habría
     dicho "9100%". El umbral es el mismo que usa la página de Reportes. */
  const notaCobertura =
    resumen.coberturaCostoPct >= 90 || resumen.facturado === 0
      ? ""
      : `<p style="margin:6px 0 0;font-size:12px;color:${SUAVE}">Margen calculado sobre el ${Math.round(
          resumen.coberturaCostoPct,
        )}% de tus ventas con costo cargado.</p>`;

  /* Botón email-safe: el fondo va en el <td> (Outlook ignora background sobre <a>)
     y el padding en el <a> (así toda el área es clickeable, no solo el texto). */
  const boton = (url: string, texto: string): string => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px">
      <tr><td style="background:${acento};border-radius:8px">
        <a href="${esc(url)}" style="display:inline-block;padding:10px 16px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none">${esc(
          texto,
        )} &rarr;</a>
      </td></tr>
    </table>`;

  const oportunidades =
    r.oportunidades.length === 0
      ? `<p style="margin:0;font-size:14px;color:${SUAVE}">Sin oportunidades urgentes este mes. Buen trabajo. 👌</p>`
      : r.oportunidades
          .map((o) => {
            const url = absolutizar(baseUrl, o.ruta);
            return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
          <tr>
            <td style="padding:14px 16px;background:#ffffff;border:1px solid ${LINEA};border-radius:12px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:20px;width:30px;vertical-align:top">${ICONO_OPORTUNIDAD[o.tipo] ?? "•"}</td>
                  <td>
                    <div style="font-size:14px;font-weight:600;color:${TINTA}">${esc(o.titulo)}</div>
                    <div style="font-size:13px;color:${SUAVE};margin-top:2px">${esc(o.detalle)}</div>
                  </td>
                  <td style="text-align:right;vertical-align:top;white-space:nowrap;font-size:15px;font-weight:700;color:${acento}">${pesos(
                    o.monto,
                  )}</td>
                </tr>
                ${url ? `<tr><td></td><td colspan="2">${boton(url, o.cta)}</td></tr>` : ""}
              </table>
            </td>
          </tr>
        </table>`;
          })
          .join("");

  const filas = (items: { izq: string; der: string }[]): string =>
    items
      .map(
        (i, idx) => `
      <tr>
        <td style="padding:8px 0;${idx > 0 ? `border-top:1px solid ${LINEA};` : ""}font-size:13px;color:${TINTA}">${i.izq}</td>
        <td style="padding:8px 0;${idx > 0 ? `border-top:1px solid ${LINEA};` : ""}text-align:right;font-size:13px;font-weight:600;color:${TINTA}">${i.der}</td>
      </tr>`,
      )
      .join("");

  const seccion = (titulo: string, contenido: string): string => `
    <tr><td style="height:22px"></td></tr>
    <tr><td style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${SUAVE}">${esc(titulo)}</td></tr>
    <tr><td style="height:10px"></td></tr>
    <tr><td>${contenido}</td></tr>`;

  const topGanancia =
    r.detalle.topGanancia.length === 0
      ? `<p style="margin:0;font-size:13px;color:${SUAVE}">Sin datos de ganancia (faltan costos cargados).</p>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(
          r.detalle.topGanancia.map((t) => ({
            izq: chip(t.emoji, t.nombre),
            der: `${pesos(t.ganancia)} <span style="color:${SUAVE};font-weight:400">· ${t.unidades} u.</span>`,
          })),
        )}</table>`;

  const medios =
    r.detalle.medios.length === 0
      ? ""
      : seccion(
          "Cómo te pagaron",
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(
            r.detalle.medios.map((m) => ({ izq: esc(m.metodo), der: pesos(m.total) })),
          )}</table>`,
        );

  const gastosCat =
    r.detalle.gastosPorCategoria.length === 0
      ? ""
      : seccion(
          "En qué gastaste",
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(
            r.detalle.gastosPorCategoria.map((g) => ({ izq: esc(g.categoria), der: pesos(g.total) })),
          )}</table>`,
        );

  const alertaLista = (items: string[]): string =>
    `<p style="margin:0;font-size:13px;color:${TINTA};line-height:1.7">${items.join(" · ")}</p>`;

  const porVencer =
    r.alertas.porVencer.length === 0
      ? ""
      : seccion(
          "Por vencer",
          alertaLista(
            r.alertas.porVencer.map(
              (e) =>
                `${chip(e.emoji, e.nombre)} <span style="color:${SUAVE}">(${e.diasRestantes <= 0 ? "vencido" : `${e.diasRestantes}d`})</span>`,
            ),
          ),
        );

  const stockBajo =
    r.alertas.stockBajo.length === 0
      ? ""
      : seccion(
          "Stock bajo",
          alertaLista(
            r.alertas.stockBajo.map(
              (s) => `${chip(s.emoji, s.nombre)} <span style="color:${SUAVE}">(${s.stock <= 0 ? "sin stock" : `${s.stock}`})</span>`,
            ),
          ),
        );

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    asuntoReporte(r),
  )}</title></head>
<body style="margin:0;padding:0;background:${FONDO};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <!-- Encabezado white-label -->
        <tr><td style="background:${acento};border-radius:16px 16px 0 0;padding:24px 24px 20px">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.75)">StockFlow · Resumen del mes</div>
          <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:4px">${esc(r.negocio.nombre)}</div>
          <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:2px">${esc(r.negocio.periodoLabel)}</div>
        </td></tr>
        <!-- Cuerpo -->
        <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <!-- Resumen ejecutivo -->
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:50%;vertical-align:top">
                    <div style="font-size:12px;color:${SUAVE}">Facturado</div>
                    <div style="font-size:24px;font-weight:800;color:${TINTA}">${pesos(resumen.facturado)}</div>
                    <div style="font-size:12px;color:${SUAVE};margin-top:2px">${vs}</div>
                  </td>
                  <td style="width:50%;vertical-align:top">
                    <div style="font-size:12px;color:${SUAVE}">${gananciaLabel}</div>
                    <div style="font-size:24px;font-weight:800;color:${gananciaColor}">${pesos(gananciaValor)}</div>
                    <div style="font-size:12px;color:${SUAVE};margin-top:2px">${resumen.tickets} ventas</div>
                  </td>
                </tr>
              </table>
              ${notaCobertura}
            </td></tr>
            <tr><td style="height:16px"></td></tr>
            ${lectura}
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${nudgeGastos}</table>
            </td></tr>

            <!-- Oportunidades -->
            <tr><td style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${SUAVE}">Para ganar más este mes</td></tr>
            <tr><td style="height:10px"></td></tr>
            <tr><td>${oportunidades}</td></tr>

            <!-- Detalle -->
            ${seccion("Lo que más te dejó", topGanancia)}
            ${medios}
            ${gastosCat}
            ${porVencer}
            ${stockBajo}

            <tr><td style="height:26px"></td></tr>
            <tr><td style="border-top:1px solid ${LINEA};padding-top:16px;font-size:12px;color:${SUAVE};text-align:center">
              ${
                inicio
                  ? `<a href="${esc(inicio)}" style="color:${acento};text-decoration:none;font-weight:600">Abrir StockFlow</a><br><br>`
                  : ""
              }Reporte automático de StockFlow · Se genera el 1° de cada mes.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
