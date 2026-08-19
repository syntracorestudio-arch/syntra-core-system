import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStore } from "@/lib/push";
import { registrarOFallar } from "@/lib/auditoria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Escalera de cobranza de la suscripción (Vercel Cron, diario).
 *
 * UN SOLO CRON que mira qué día es, en vez de cuatro entradas en `vercel.json`
 * (7, 12, 18, 25): los meses no tienen todos los mismos días, el dedupe ya
 * resuelve la repetición, y así la escalera se lee entera en un archivo.
 * Qué escalón corresponde lo decide `cobranza_escalon` en SQL (060), que es
 * donde vive el resto de la regla de negocio y donde se puede probar con
 * fechas inyectadas.
 *
 * LOS AVISOS SON DEL DUEÑO Y DE NADIE MÁS. Un cajero viendo "tu jefe debe la
 * suscripción" es humillante para el cliente. Se cumple por dos caminos
 * independientes:
 *   · `memberId` acota el push a los dispositivos del dueño (`push.ts:59`);
 *   · la policy de `notifications` sólo deja leer la fila a su destinatario.
 *
 * TONO: son mensajes de cobranza a alguien que está laburando. Nada de
 * mayúsculas, signos de admiración ni "¡ATENCIÓN!". El día 18 dice la fecha del
 * corte porque una fecha explícita es más respetuosa que una amenaza vaga.
 */

type Escalon = {
  /* Los cuatro que devuelve la RPC, más los tres que decide el cron según lo
     que efectivamente pasó (061). */
  escalon:
    | "ninguno" | "aviso_previo" | "recordatorio" | "escalada" | "corte"
    | "por_suspender" | "suspendido" | "falta_poco";
  member_id?: string;
  periodo?: string;
  monto?: number;
  vence?: string;
  deuda?: number;
  meses_impagos?: number;
  dias_de_atraso?: number;
  parcial?: boolean;
  suspende_el?: string;
  precio?: number;
  /* 061 · falso cuando debe menos de un mes completo: eso no lo corta un cron. */
  corte_seguro?: boolean;
};

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

/** El texto que ve el dueño en la burbuja del teléfono. */
function mensaje(e: Escalon, negocio: string): { title: string; body: string } | null {
  switch (e.escalon) {
    case "aviso_previo":
      return {
        title: "Tu suscripción vence el 10",
        body: `${pesos(e.monto ?? 0)} por ${negocio}. Si ya la pagaste, ignorá este aviso.`,
      };
    case "recordatorio":
      return {
        title: "¿Pagaste la suscripción?",
        /* Se admite explícitamente que podemos no haberlo visto: el cobro es
           por transferencia y la conciliación es manual. */
        body: `Nos figura ${pesos(e.deuda ?? 0)} sin registrar. Si ya transferiste, puede que todavía no lo hayamos cargado.`,
      };
    case "escalada":
      return {
        title: "Tu suscripción está vencida",
        body: `${pesos(e.deuda ?? 0)} pendientes. Si no se regulariza, el ${diaDe(e.suspende_el)} se suspende el acceso.`,
      };
    /* 061 · DOS mensajes distintos para el día 25, y ésa es la corrección.
       Antes había uno solo que decía "se suspendió el acceso" y salía SIEMPRE
       —incluso con el corte automático apagado, que es el default—, así que el
       kiosquero leía que lo cortamos mientras su caja funcionaba perfecto.
       Todos los meses. Es el peor lugar para perder credibilidad: el mensaje
       que le pide plata. */
    case "por_suspender":
      return {
        title: "Tu acceso está por suspenderse",
        body: `${pesos(e.deuda ?? 0)} sin registrar. Escribinos hoy y lo resolvemos.`,
      };
    case "suspendido":
      return {
        title: "Se suspendió el acceso",
        body: `Por ${pesos(e.deuda ?? 0)} sin registrar. Escribinos y lo reactivamos en el momento.`,
      };
    case "falta_poco":
      /* Le falta menos de un mes: no es un moroso, es una diferencia. Tratarlo
         como deudor pleno rompe una relación por una comisión bancaria. */
      return {
        title: "Te falta completar un pago",
        body: `Quedan ${pesos(e.deuda ?? 0)} del mes. Si ya lo mandaste, avisanos y lo cargamos.`,
      };
    default:
      return null;
  }
}

/** "2026-09-25" → "25/9". Una fecha corta se lee de un vistazo en una burbuja. */
function diaDe(iso?: string): string {
  if (!iso) return "fin de mes";
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  /* El corte automático viaja APAGADO por defecto, igual que el reembolso.
     El motivo es concreto y no es prudencia genérica: los pagos se marcan A
     MANO. Si el owner tarda dos días en cargar una transferencia que sí llegó,
     un corte automático le apaga la caja a un cliente que YA PAGÓ — y eso no
     se arregla reactivando, porque el daño fue no poder vender esa mañana.
     Se prende recién cuando la conciliación demuestre ser puntual. */
  const corteAutomatico = process.env.STOCKFLOW_CORTE_AUTOMATICO === "1";

  const admin = createAdminClient();
  const { data: stores, error } = await admin
    .from("stores")
    .select("id, name")
    .eq("status", "active")
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "stores_query_failed" }, { status: 500 });
  }

  let avisados = 0;
  let suspendidos = 0;
  let paraRevisar = 0;

  for (const store of stores ?? []) {
    const { data, error: eEsc } = await admin.rpc("cobranza_escalon", { p_store_id: store.id });
    if (eEsc || !data) continue;

    const e = data as Escalon;
    if (e.escalon === "ninguno" || !e.member_id) continue;

    /* 061 · PRIMERO SE ACTÚA, DESPUÉS SE AVISA — y ése es el arreglo.
       Antes el mensaje salía siempre y la suspensión dependía de un flag, así
       que con el default (apagado) le decíamos "se suspendió el acceso" a un
       cliente cuya caja funcionaba. Y al revés: si el aviso ya se había
       consumido por dedupe, el corte real ocurría EN SILENCIO. El mensaje
       ahora describe lo que efectivamente pasó. */
    let tipo: string = e.escalon;

    if (e.escalon === "corte") {
      if (e.corte_seguro === false) {
        /* Le falta menos de un mes. No lo corta un cron: puede ser una comisión
           bancaria o un monto mal tipeado, y ninguna de esas cosas justifica
           apagarle la caja a un comercio abierto. */
        tipo = "falta_poco";
        paraRevisar++;
      } else if (!corteAutomatico) {
        tipo = "por_suspender";
        paraRevisar++;
      } else {
        try {
          await registrarOFallar({
            actorId: null,
            actorEmail: "cron@stockflow",
            accion: "negocio_suspendido",
            motivo: `Suspensión automática por falta de pago: ${e.meses_impagos} mes(es), ${pesos(e.deuda ?? 0)} sin registrar.`,
            storeId: store.id,
            etiqueta: store.name,
          });
          await admin.from("stores").update({ status: "suspended" }).eq("id", store.id);
          suspendidos++;
          tipo = "suspendido";
        } catch {
          /* Si la bitácora falla, NO se suspende: un negocio cortado sin una
             fila que se lo explique es lo que 055 vino a impedir. Y el mensaje
             acompaña: no se le anuncia un corte que no ocurrió. */
          tipo = "por_suspender";
          paraRevisar++;
        }
      }
    }

    const texto = mensaje({ ...e, escalon: tipo } as Escalon, store.name);
    if (!texto) continue;

    /* Dedupe por (negocio, período, TIPO DE MENSAJE) — no por escalón. Si fuera
       por escalón, el "por_suspender" del día 25 con el flag apagado se comería
       la clave y el "se suspendió" posterior nunca saldría: el cliente quedaría
       cortado sin que se lo dijéramos. */
    const enviado = await notifyStore(store.id, {
      type: "cobranza",
      title: texto.title,
      body: texto.body,
      memberId: e.member_id,
      dedupeKey: `cobranza:${e.periodo}:${tipo}`,
    });
    if (enviado) avisados++;
  }

  return NextResponse.json({ ok: true, avisados, suspendidos, paraRevisar });
}
