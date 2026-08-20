"use client";

import { cn } from "@/lib/cn";
import type { StoreRow } from "./super-client";

export type CeldaCobranza = {
  storeId: string;
  mes: string;
  estado: "pagado" | "parcial" | "impago" | "en_termino" | "prueba" | "sin_plan" | "no_aplica" | "de_baja";
  pagado: number;
  precio: number | null;
};

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return `${MES_CORTO[m - 1]} ${String(a).slice(2)}`;
}

/* El color ES la información: la grilla se lee de un vistazo o no sirve. Los
   estados que NO son deuda se apagan a propósito para que lo rojo salte. */
const ESTILO: Record<CeldaCobranza["estado"], { clase: string; texto: string }> = {
  pagado: { clase: "bg-success/25 text-success-ink", texto: "Pagado" },
  parcial: { clase: "bg-warning/30 text-warning-ink", texto: "Pago parcial" },
  impago: { clase: "bg-danger/35 text-danger-ink", texto: "Impago" },
  en_termino: { clase: "bg-secondary text-muted-foreground", texto: "Todavía no vence" },
  prueba: { clase: "bg-primary/15 text-primary-ink", texto: "Mes de prueba" },
  /* Casi invisibles pero NO transparentes: en transparente la fila queda hueca
     y el ojo pierde la alineación de las columnas — con 12 meses ya no se sabe
     cuál celda es cuál. Tienen que estar sin pesar. */
  sin_plan: { clase: "bg-secondary/30", texto: "Sin plan" },
  no_aplica: { clase: "bg-secondary/25", texto: "No se le cobraba" },
  de_baja: { clase: "bg-secondary/30", texto: "De baja" },
};

/**
 * La cobranza de los últimos meses, negocio por negocio.
 *
 * POR QUÉ ESTO Y NO UN GRÁFICO. Es lo único de todo el panel que distingue al
 * cliente que se atrasó UNA vez del que se atrasa TODOS los meses, y son dos
 * conversaciones opuestas: a uno se lo llama para preguntarle qué le pasó, al
 * otro para decidir si sigue. El badge "debe" de la cartera borra esa
 * diferencia por completo, porque sólo mira el presente.
 *
 * No es un gráfico: es una tabla de cuadraditos. Por eso sirve con tres
 * clientes —donde cualquier gráfico de distribución sería decoración— y sigue
 * sirviendo con treinta.
 *
 * Se lee en HORIZONTAL (la historia de un negocio) y en VERTICAL (cómo venimos
 * cobrando un mes). Las dos lecturas son útiles y por eso es una grilla y no
 * una lista ordenada por deuda.
 */
export function CobranzaGrilla({
  stores,
  celdas,
}: {
  stores: StoreRow[];
  celdas: CeldaCobranza[];
}) {
  const meses = [...new Set(celdas.map((c) => c.mes))].sort();
  const porNegocio = new Map<string, Map<string, CeldaCobranza>>();
  for (const c of celdas) {
    if (!porNegocio.has(c.storeId)) porNegocio.set(c.storeId, new Map());
    porNegocio.get(c.storeId)!.set(c.mes, c);
  }

  /* Ordenado por deuda descendente y no alfabético: la grilla se mira para
     decidir a quién llamar, así que arriba va el que más debe. */
  const orden = [...stores].sort((a, b) => {
    const da = a.suscripcion.estado === "debe" ? a.suscripcion.deuda : 0;
    const db = b.suscripcion.estado === "debe" ? b.suscripcion.deuda : 0;
    return db - da;
  });

  if (meses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <p className="text-sm font-medium">Todavía no hay historial</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando empiecen a correr los meses, acá vas a ver quién paga en fecha y quién no.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* La tabla scrollea DENTRO de su caja: con 12 meses y nombres largos, el
          que desborda tiene que ser este contenedor y nunca la página. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {/* `border-separate` con spacing 0: `border-collapse: collapse` y
            `position: sticky` en celdas no conviven bien —el sticky se
            despega— y visualmente queda idéntico. */}
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-full bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground"
              >
                Negocio
              </th>
              {meses.map((m) => (
                <th
                  key={m}
                  scope="col"
                  className="w-20 px-2 py-3 text-center text-xs font-medium text-muted-foreground"
                >
                  {etiquetaMes(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orden.map((s) => {
              const fila = porNegocio.get(s.id);
              return (
                <tr key={s.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[14rem] truncate border-t border-border bg-card px-4 py-2.5 text-left font-medium"
                    title={s.name}
                  >
                    {s.name}
                  </th>
                  {meses.map((m) => {
                    const c = fila?.get(m);
                    const est = c?.estado ?? "no_aplica";
                    const e = ESTILO[est];
                    /* El title carga el detalle en plata: el color contesta
                       "¿hay problema?" y el hover contesta "¿de cuánto?". */
                    const detalle =
                      c && (est === "parcial" || est === "impago")
                        ? `${e.texto} · ${pesos(c.pagado)} de ${pesos(c.precio ?? 0)}`
                        : e.texto;
                    return (
                      <td key={m} className="border-t border-border px-1.5 py-2 text-center">
                        <span
                          title={`${s.name} · ${etiquetaMes(m)} — ${detalle}`}
                          /* `relative` no es cosmético: el `sr-only` de adentro
                             se posiciona ABSOLUTO, y sin un ancestro posicionado
                             escapa hasta el bloque contenedor inicial. Medido a
                             390: estiraba el documento 166px y aparecía una
                             barra horizontal de PÁGINA — con `body` sin
                             desbordar, que es lo que hacía imposible de
                             encontrar. */
                          className={cn("relative mx-auto block h-7 w-14 rounded-md", e.clase)}
                        >
                          <span className="sr-only">{detalle}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda: sin esto son cuadraditos de colores. Sólo los estados que de
          verdad aparecen — una leyenda con entradas que no están en pantalla
          obliga a buscar algo que no existe. */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
        {(["pagado", "parcial", "impago", "en_termino", "prueba"] as const)
          .filter((e) => celdas.some((c) => c.estado === e))
          .map((e) => (
            <li key={e} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded", ESTILO[e].clase)} />
              {ESTILO[e].texto}
            </li>
          ))}
      </ul>
    </div>
  );
}
