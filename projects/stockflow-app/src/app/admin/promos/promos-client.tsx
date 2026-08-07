"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Tag,
  Clock,
  Pencil,
  LoaderCircle,
  TriangleAlert,
  Printer,
  Plus,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import {
  fechaCorta,
  margenPct,
  diasEntre,
} from "@/lib/promos";
import { AvisoBanner } from "@/components/ui/aviso";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button, ButtonLink } from "@/components/ui/button";
import { CardHero, Card, CardList } from "@/components/ui/card-system";
import { CountUp } from "@/components/ui/count-up";
import { Hoja, BajoCosto } from "./hoja";
import { crearPromo, terminarPromo } from "./actions";
import { NuevaPromo } from "./nueva-promo";

/* ═══════════════════════════════════════════════════════════════════════════
   Tipos: espejo de lo que devuelven `promos_listado` y `promos_sugeridas`.
   Los numéricos de Postgres llegan como string por el driver — de ahí el
   `string | number` y el `Number()` en cada lectura.
   ═════════════════════════════════════════════════════════════════════════ */

export type PromoRow = {
  id: string;
  estado: "activa" | "programada" | "terminada";
  product_id: string;
  product_name: string;
  product_emoji: string | null;
  promo_price: string | number;
  list_price: string | number;
  precio_actual: string | number;
  starts_on: string;
  ends_on: string;
  dias_restantes: number;
  origin: "manual" | "sugerida";
  below_cost_ok: boolean;
  expiry_id: string | null;
  lote_vence: string | null;
  ended_at: string | null;
  ended_reason: "manual" | "vencimiento" | "reemplazo" | null;
  unidades: string | number;
  cobrado: string | number | null;
  ganancia_recuperada: string | number | null;
  costo_promo: string | number | null;
  lote_qty: string | number | null;
  lote_al_costo: string | number | null;
  cost_at_start: string | number | null;
};

export type Sugerencia = {
  expiry_id: string;
  product_id: string;
  name: string;
  emoji: string | null;
  expiry_date: string;
  dias: number;
  stock: string | number;
  lote_qty: string | number;
  price: string | number;
  list_price: string | number;
  cost: string | number | null;
  sugerido: string | number;
  pct: number;
  ritmo_actual: string | number;
  ritmo_necesario: string | number;
  margen_unitario: string | number | null;
  plata_en_riesgo: string | number | null;
  es_reescalon: boolean;
  promo_vigente_id: string | null;
  promo_price_actual: string | number | null;
  promo_starts_on: string | null;
  promo_ends_on: string | null;
  unidades_desde_promo: string | number;
  aplicable: boolean;
};

type Aviso = { tone: "ok" | "error"; text: string } | null;

/** Urgencia por días — misma tabla que Vencimientos: el color refuerza, el texto informa. */
function urgencia(dias: number): { label: string; tone: "danger" | "warning" | "muted" } {
  if (dias <= 0) return { label: "vence hoy", tone: "danger" };
  if (dias === 1) return { label: "vence mañana", tone: "danger" };
  if (dias <= 7) return { label: `en ${dias} días`, tone: "warning" };
  return { label: `en ${dias} días`, tone: "muted" };
}

/** "~1,2 por día" — un decimal, coma decimal, sin falsa precisión. */
function ritmo(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} por día`;
}

/** Cuántas sugerencias se ven antes de plegar. A 390px, más no se llega a leer. */
const TOPE_VISIBLE = 3;

export function PromosClient({
  promos,
  sugerencias,
  hoy,
  margenMinimo,
  tieneVencimientos,
}: {
  promos: PromoRow[];
  sugerencias: Sugerencia[];
  hoy: string;
  margenMinimo: number;
  tieneVencimientos: boolean;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Sugerencia | null>(null);
  const [terminando, setTerminando] = useState<PromoRow | null>(null);
  /* Descartes de SESIÓN, sin tabla: persistirlos es el riesgo 11 del plan y
     está marcado "Después". Silenciar para siempre una sugerencia necesita más
     pensamiento del que entra en este PR. */
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [verTodas, setVerTodas] = useState(false);
  const [, startTransition] = useTransition();

  const programadas = promos.filter((p) => p.estado === "programada");
  const terminadas = promos.filter((p) => p.estado === "terminada");

  /* Una sugerencia por PRODUCTO, no por lote: dos lotes del mismo producto dan
     dos filas y renderizar las dos sería pedir dos veces la misma decisión.
     Gana la más urgente. */
  const visibles = useMemo(() => {
    const porProducto = new Map<string, Sugerencia>();
    for (const s of sugerencias) {
      if (!s.aplicable || ocultas.has(s.product_id)) continue;
      const previa = porProducto.get(s.product_id);
      if (!previa || s.dias < previa.dias) porProducto.set(s.product_id, s);
    }
    return [...porProducto.values()].sort((a, b) => a.dias - b.dias);
  }, [sugerencias, ocultas]);

  const mostradas = verTodas ? visibles : visibles.slice(0, TOPE_VISIBLE);

  /* Una promo con re-escalón propuesto NO se repite abajo: la card de arriba
     ya dice a cuánto está, desde cuándo y cuánto vendió. Mostrar las dos es
     pedir la misma decisión en dos lugares, y la de abajo tiene un botón
     («Terminar») que no es lo que el sistema está proponiendo. */
  const conReescalon = new Set(
    mostradas.filter((s) => s.es_reescalon).map((s) => s.product_id),
  );
  const activas = promos.filter(
    (p) => p.estado === "activa" && !conReescalon.has(p.product_id),
  );

  /* La plata del hero: lo que está en juego en lo que HAY QUE DECIDIR, al
     COSTO. Decirla al precio de venta inflaría la pérdida — mismo criterio que
     "Perdiste por vencimientos" en Reportes. */
  const enRiesgo = visibles.reduce((a, s) => a + Number(s.plata_en_riesgo ?? 0), 0);

  function poner(s: Sugerencia, precio: number, belowCostOk = false) {
    setPendiente(s.product_id);
    setAviso(null);
    startTransition(async () => {
      const r = await crearPromo({
        productId: s.product_id,
        promoPrice: precio,
        startsOn: hoy,
        /* La fecha de fin se DERIVA del vencimiento del lote: es lo que hace
           verdadero el "termina el sáb 14 y vuelve solo", y de paso cumple la
           regla de duración por construcción, sin preguntar nada. */
        endsOn: s.expiry_date,
        expiryId: s.expiry_id,
        origin: "sugerida",
        belowCostOk,
        reemplazar: s.es_reescalon,
      });
      setPendiente(null);
      setEditando(null);
      if (!r.ok) {
        setAviso({ tone: "error", text: r.error });
        return;
      }
      setAviso({
        tone: "ok",
        /* El aviso confirma el hecho de CAJA, no el registro: "Promo creada" no
           le dice al dueño lo único que quiere saber. */
        text: `Listo. La caja ya cobra ${money(precio)} el ${s.name}. Termina el ${fechaCorta(
          s.expiry_date,
        )} y vuelve solo a ${money(Number(s.list_price))}.`,
      });
    });
  }

  function terminar(p: PromoRow) {
    setPendiente(p.id);
    startTransition(async () => {
      const r = await terminarPromo(p.id);
      setPendiente(null);
      setTerminando(null);
      if (!r.ok) {
        setAviso({ tone: "error", text: r.error });
        return;
      }
      setAviso({
        tone: "ok",
        text: `Terminó la promo de ${p.product_name}. La caja vuelve a cobrar ${money(
          r.data.vuelveA,
        )}.`,
      });
    });
  }

  const vacia =
    visibles.length === 0 && activas.length === 0 && programadas.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Promos"
          subtitle="Bajás el precio por unos días y la caja lo cobra sola."
          icon={Tag}
          /* `BrandArt` todavía no tiene pieza propia de promos: se reusa la de
             Precios (la etiqueta colgando), que temáticamente cierra. Cambiarla
             después es una tarea de asset, no de código. */
          art="precios"
        >
          {activas.length > 0 && (
            <ButtonLink href="/admin/promos/carteles" variant="secondary" className="bg-background/60">
              <Printer className="size-4" /> Carteles de hoy
            </ButtonLink>
          )}
          <Button variant="secondary" className="bg-background/60" onClick={() => setCreando(true)}>
            <Plus className="size-4" /> Nueva promo
          </Button>
        </PageHeader>
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      {enRiesgo > 0 && (
        <CardHero glow="danger" className="mb-4">
          <p className="text-sm text-muted-foreground">Tenés por vencer, y no sale al ritmo actual</p>
          <p className="text-3xl font-semibold tabular text-danger-ink lg:text-4xl">
            <CountUp value={enRiesgo} prefix="$ " />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Es lo que te costó esa mercadería, no lo que ibas a cobrar por ella.
          </p>
        </CardHero>
      )}

      {vacia ? (
        <VacioSegunElCaso tieneVencimientos={tieneVencimientos} hayLotes={sugerencias.length > 0} />
      ) : (
        <div className="space-y-6">
          {mostradas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Para decidir</h2>
              <ul className="space-y-2.5">
                {mostradas.map((s) =>
                  s.es_reescalon ? (
                    <li key={s.product_id}>
                      <ReescalonCard
                        s={s}
                        hoy={hoy}
                        margenMinimo={margenMinimo}
                        pendiente={pendiente === s.product_id}
                        bloqueado={pendiente !== null}
                        onPoner={(precio, bajo) => poner(s, precio, bajo)}
                        onOtroPrecio={() => setEditando(s)}
                        onDejar={() =>
                          setOcultas((o) => new Set(o).add(s.product_id))
                        }
                      />
                    </li>
                  ) : (
                    <li key={s.product_id}>
                      <SugerenciaCard
                        s={s}
                        margenMinimo={margenMinimo}
                        pendiente={pendiente === s.product_id}
                        bloqueado={pendiente !== null}
                        onPoner={(precio, bajo) => poner(s, precio, bajo)}
                        onOtroPrecio={() => setEditando(s)}
                      />
                    </li>
                  ),
                )}
              </ul>
              {visibles.length > TOPE_VISIBLE && !verTodas && (
                <button
                  type="button"
                  onClick={() => setVerTodas(true)}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Ver {visibles.length - TOPE_VISIBLE} más
                </button>
              )}
            </section>
          )}

          {activas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">En promo ahora</h2>
              <ul className="space-y-2.5">
                {activas.map((p) => (
                  <li key={p.id}>
                    <PromoActivaCard
                      p={p}
                      hoy={hoy}
                      bloqueado={pendiente !== null}
                      onTerminar={() => setTerminando(p)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {programadas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Programadas</h2>
              <ul className="space-y-2.5">
                {programadas.map((p) => (
                  <li key={p.id}>
                    <PromoActivaCard
                      p={p}
                      hoy={hoy}
                      bloqueado={pendiente !== null}
                      onTerminar={() => setTerminando(p)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {terminadas.length > 0 && <Terminadas promos={terminadas} />}
        </div>
      )}

      {creando && (
        <NuevaPromo
          hoy={hoy}
          margenMinimo={margenMinimo}
          onClose={() => setCreando(false)}
          onDone={(texto) => {
            setCreando(false);
            setAviso({ tone: "ok", text: texto });
          }}
        />
      )}

      {editando && (
        <OtroPrecioPromo
          s={editando}
          margenMinimo={margenMinimo}
          pendiente={pendiente !== null}
          onCancel={() => setEditando(null)}
          onAplicar={(precio, bajo) => poner(editando, precio, bajo)}
        />
      )}

      {terminando && (
        <TerminarPromo
          p={terminando}
          pendiente={pendiente !== null}
          onCancel={() => setTerminando(null)}
          onConfirmar={() => terminar(terminando)}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Card de sugerencia — el corazón de la sección.

   Tres bloques de sentido separados por UN hairline: situación (hechos) ·
   propuesta (opinión del sistema) · compromiso (los botones y la fecha). El
   hairline no es decoración: marca dónde termina lo que pasó y empieza lo que
   el sistema opina. Sin él, las seis líneas se leen como un párrafo.

   Cuatro tallas tipográficas en toda la card y ni una más. El peso y el color
   hacen el trabajo que en otras pantallas haría el tamaño.
   ─────────────────────────────────────────────────────────────────────────── */

function SugerenciaCard({
  s,
  margenMinimo,
  pendiente,
  bloqueado,
  onPoner,
  onOtroPrecio,
}: {
  s: Sugerencia;
  margenMinimo: number;
  pendiente: boolean;
  bloqueado: boolean;
  onPoner: (precio: number, belowCostOk: boolean) => void;
  onOtroPrecio: () => void;
}) {
  const u = urgencia(s.dias);
  const sugerido = Number(s.sugerido);
  const lista = Number(s.list_price);
  const costo = s.cost === null ? null : Number(s.cost);
  const margen = margenPct(sugerido, costo);
  const bajoCosto = costo !== null && sugerido < costo;

  return (
    <Card className="p-4 lg:p-4">
      <Encabezado emoji={s.emoji} nombre={s.name} chip={u} />

      {/* SITUACIÓN — hechos. */}
      <div className="mt-2 space-y-1 text-sm text-muted-foreground lg:max-w-[52ch]">
        <p>
          Te quedan <strong className="tabular text-foreground">{Number(s.stock)} u.</strong> y vencen
          el {fechaCorta(s.expiry_date)}.
        </p>
        <p>
          {Number(s.ritmo_actual) <= 0 ? (
            <>No vendiste ninguna en las últimas dos semanas.</>
          ) : (
            <>
              Vendés{" "}
              <strong className="tabular text-foreground">~{ritmo(Number(s.ritmo_actual))}</strong>:
              a ese ritmo no salen todas.
            </>
          )}
        </p>
        {s.plata_en_riesgo !== null && (
          <p>
            Si los tirás perdés{" "}
            <strong className="tabular text-danger-ink">{money(Number(s.plata_en_riesgo))}</strong> de
            lo que te costaron.
          </p>
        )}
      </div>

      {/* PROPUESTA — opinión del sistema. */}
      <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground lg:max-w-[52ch]">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>
            A <strong className="tabular text-foreground">{money(sugerido)}</strong>
          </span>
          <ChipPct pct={s.pct} />
          {margen !== null && (
            <span>
              te queda{" "}
              <strong
                className={cn(
                  "tabular",
                  bajoCosto
                    ? "text-danger-ink"
                    : margen < margenMinimo
                      ? "text-warning-ink"
                      : "text-foreground",
                )}
              >
                {money(sugerido - (costo ?? 0))}
              </strong>{" "}
              por unidad · {margen}% de margen
            </span>
          )}
        </p>
        {/* La frase que separa una sugerencia de una promesa: el sistema PUEDE
            calcular el ritmo que haría falta; NO puede saber que con -30% se
            vende. Nunca dice "vas a vender los 8". */}
        <p>
          Para venderlos todos necesitás{" "}
          <strong className="tabular text-foreground">~{ritmo(Number(s.ritmo_necesario))}</strong>.
        </p>
      </div>

      {/* COMPROMISO — sin hairline: un segundo corte convertiría la card en formulario. */}
      <Acciones
        etiqueta={`Poner a ${money(sugerido)}`}
        nombre={s.name}
        pendiente={pendiente}
        bloqueado={bloqueado}
        bajoCosto={bajoCosto}
        onPrimaria={() => onPoner(sugerido, bajoCosto)}
        onOtroPrecio={onOtroPrecio}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Termina el {fechaCorta(s.expiry_date)} y el precio vuelve solo a {money(lista)}.
      </p>
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Card de re-escalón.

   Es la card de "en promo ahora" con una franja arriba, NO una sugerencia
   nueva: abre nombrando lo que el dueño ya decidió. El owner firma cada
   escalón, así que la UI no puede empujar — `Dejar como está` tiene el mismo
   peso visual que `Bajar a $X` (los dos `secondary`, mismo ancho, misma
   altura) y ninguno lleva relleno.

   Dos botones iguales se leerían indecisos SIN contexto; acá el contexto es la
   card: hay un hecho nombrado arriba y una razón medida. Con eso, la paridad
   se lee como respeto. La línea de abajo cierra el círculo: sin ella, "Dejar
   como está" parece un callejón sin salida y el dueño toca el otro por miedo.
   ─────────────────────────────────────────────────────────────────────────── */

function ReescalonCard({
  s,
  hoy,
  margenMinimo,
  pendiente,
  bloqueado,
  onPoner,
  onOtroPrecio,
  onDejar,
}: {
  s: Sugerencia;
  hoy: string;
  margenMinimo: number;
  pendiente: boolean;
  bloqueado: boolean;
  onPoner: (precio: number, belowCostOk: boolean) => void;
  onOtroPrecio: () => void;
  onDejar: () => void;
}) {
  const sugerido = Number(s.sugerido);
  const vigente = Number(s.promo_price_actual ?? s.price);
  const costo = s.cost === null ? null : Number(s.cost);
  const margen = margenPct(sugerido, costo);
  const bajoCosto = costo !== null && sugerido < costo;
  const vendidas = Number(s.unidades_desde_promo);
  const diasDePromo = s.promo_starts_on ? (diasEntre(s.promo_starts_on, hoy) ?? 0) : 0;

  return (
    <CardList className="relative p-4 lg:p-4">
      {/* Ámbar acá NO es "oferta": es la urgencia del vencimiento, mismo léxico
          que Vencimientos. El rojo y el ámbar nunca tocan el precio ni un botón. */}
      <div className="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 rounded-t-xl border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning-ink lg:-mx-5 lg:-mt-5 lg:px-5">
        <TriangleAlert className="size-3.5 shrink-0" />
        <span>
          {urgencia(s.dias).label === "vence hoy"
            ? "Vence hoy"
            : `Faltan ${s.dias} día${s.dias === 1 ? "" : "s"}`}{" "}
          y van {vendidas} de {Number(s.lote_qty)}.
        </span>
      </div>

      <Encabezado emoji={s.emoji} nombre={s.name} />

      <div className="mt-2 space-y-1 text-sm text-muted-foreground lg:max-w-[52ch]">
        <p>
          Lo pusiste a <strong className="tabular text-foreground">{money(vigente)}</strong>
          {s.promo_starts_on && diasDePromo > 0 && (
            <> hace {diasDePromo} día{diasDePromo === 1 ? "" : "s"}</>
          )}
          . Vendiste <strong className="tabular text-foreground">{vendidas}</strong>.
        </p>
        <p>
          Te quedan <strong className="tabular text-foreground">{Number(s.stock)} u.</strong> y para
          que salgan todas necesitás{" "}
          <strong className="tabular text-foreground">~{ritmo(Number(s.ritmo_necesario))}</strong>.
        </p>
      </div>

      <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground lg:max-w-[52ch]">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>
            Bajar a <strong className="tabular text-foreground">{money(sugerido)}</strong>
          </span>
          <ChipPct pct={s.pct} />
          {margen !== null && (
            <span>
              te deja{" "}
              <strong
                className={cn(
                  "tabular",
                  bajoCosto
                    ? "text-danger-ink"
                    : margen < margenMinimo
                      ? "text-warning-ink"
                      : "text-foreground",
                )}
              >
                {money(sugerido - (costo ?? 0))}
              </strong>{" "}
              por unidad · {margen}% de margen
            </span>
          )}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {/* Apilados por debajo de 400px. En dos columnas, «Bajar a $ 2.250» no
            entra y se trunca a «Bajar a $ 2.25…» — que se lee $2,25. Un precio
            cortado en un botón que cambia el precio es el peor lugar posible
            para ahorrar dos líneas. Apilados siguen teniendo el MISMO peso
            visual, que es lo que la decisión del owner exige. */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => onPoner(sugerido, bajoCosto)}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-40"
          >
            {pendiente && <LoaderCircle className="size-4 animate-spin" />}
            <span className="truncate">Bajar a {money(sugerido)}</span>
          </button>
          <button
            type="button"
            disabled={bloqueado}
            onClick={onDejar}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border px-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-40"
          >
            Dejar como está
          </button>
        </div>
        <BotonOtroPrecio nombre={s.name} bloqueado={bloqueado} onClick={onOtroPrecio} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Si la dejás, te volvemos a avisar cuando falte menos. Reemplaza la promo de{" "}
        {money(vigente)} y termina el {fechaCorta(s.promo_ends_on ?? s.expiry_date)} igual.
      </p>
    </CardList>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Card de "en promo ahora" (y de programadas).

   Se distingue de una sugerencia SIN usar un segundo color, con tres señales a
   la vez: el precio vive en el ENCABEZADO (no adentro de un botón, que es
   donde vive una propuesta) · la superficie es un paso más oscura (lo resuelto
   retrocede) · cero botones con relleno.
   ─────────────────────────────────────────────────────────────────────────── */

function PromoActivaCard({
  p,
  hoy,
  bloqueado,
  onTerminar,
}: {
  p: PromoRow;
  hoy: string;
  bloqueado: boolean;
  onTerminar: () => void;
}) {
  const precio = Number(p.promo_price);
  const lista = Number(p.list_price);
  const actual = Number(p.precio_actual);
  const programada = p.estado === "programada";
  const dias = p.dias_restantes;
  const unidades = Number(p.unidades);

  return (
    <CardList className="p-4 lg:p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg">
          {p.product_emoji ?? "📦"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium">{p.product_name}</p>
          {/* El precio en el encabezado: acá es un HECHO, no una propuesta. */}
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tabular text-base font-semibold">{money(precio)}</span>
            <s className="tabular text-xs font-medium text-info-ink">
              <span className="sr-only">antes </span>
              {money(lista)}
            </s>
          </p>
        </div>
        <span className="shrink-0 text-right text-xs text-muted-foreground">
          {programada ? (
            <>arranca el {fechaCorta(p.starts_on)}</>
          ) : (
            <>
              hasta el {fechaCorta(p.ends_on)}
              <br />
              <span className="tabular">
                {dias === 0 ? "último día" : `${dias} día${dias === 1 ? "" : "s"}`}
              </span>
            </>
          )}
        </span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {programada ? (
          <>Todavía no la cobra la caja.</>
        ) : unidades > 0 ? (
          <>
            Vendiste <strong className="tabular text-foreground">{unidades}</strong> desde que
            arrancó.
          </>
        ) : (
          <>Todavía no vendiste ninguna en promo.</>
        )}
        {p.origin === "sugerida" && <span className="text-xs"> · sugerida</span>}
      </p>

      <div className="mt-3">
        <Button
          variant="secondary"
          disabled={bloqueado}
          onClick={onTerminar}
          className="w-full sm:w-auto"
        >
          {programada ? "Cancelar · todavía no arrancó" : `Terminar · vuelve a ${money(actual)}`}
        </Button>
      </div>

      {/* El precio del producto cambió mientras la promo corría: el "vuelve a"
          sale de `products.price` de HOY, así que hay que decir que no coincide
          con el tachado o el dueño lee dos números distintos sin explicación. */}
      {actual !== lista && (
        <p className="mt-2 text-xs text-muted-foreground">
          Le cambiaste el precio a {money(actual)} mientras la promo corría: es a ese al que vuelve.
        </p>
      )}
      {hoy === p.ends_on && !programada && (
        <p className="mt-2 text-xs text-warning-ink">Termina hoy — acordate de sacar el cartel.</p>
      )}
    </CardList>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Terminadas — libro mayor, no vitrina.

   DESVIACIÓN DELIBERADA DEL LÉXICO DE LA APP, y hay que dejarla escrita o la
   próxima persona la "arregla": en el resto de StockFlow la plata cobrada tira
   a verde y la pérdida a rojo. Acá las tres cifras son del MISMO tamaño, del
   MISMO color y sin flechas ni porcentajes de mejora.

   El motivo: la medición no puede fingir causalidad. Se puede afirmar que se
   vendieron 6 unidades y que se resignaron $3.600 de margen — no se puede
   afirmar que la promo causó esas ventas. Un verde en "cobraste" convertiría
   la sección en propaganda de sí misma, y el margen resignado se muestra
   SIEMPRE, también cuando salió bien: es lo único que impide eso.
   ─────────────────────────────────────────────────────────────────────────── */

function Terminadas({ promos }: { promos: PromoRow[] }) {
  return (
    /* `details` nativo: plegado sin JS ni estado, mismo patrón que el menú "Más"
       de la barra mobile. El summary NO lleva cifra agregada — "$12.400
       recuperados" sería propaganda y "$5.200 resignados" un reproche. */
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
        Terminadas (últimos 30 días) · {promos.length}
      </summary>

      <CardList className="mt-2 p-0 lg:p-0">
        <ul className="divide-y divide-border">
          {promos.map((p) => {
            const unidades = Number(p.unidades);
            const cobrado = p.cobrado === null ? null : Number(p.cobrado);
            const resignado = p.costo_promo === null ? null : Number(p.costo_promo);
            const loteQty = p.lote_qty === null ? null : Number(p.lote_qty);
            const loteCosto = p.lote_al_costo === null ? null : Number(p.lote_al_costo);

            return (
              <li key={p.id} className="p-4">
                {/* El motivo de fin baja de renglón: en la misma línea que las
                    fechas comía tanto ancho que a 390px el nombre quedaba en
                    «Aceite Coci…», que no identifica nada. Acá el nombre solo
                    IDENTIFICA (no hay acción que tomar), así que truncar está
                    bien — truncar hasta lo ilegible, no. */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    <span aria-hidden>{p.product_emoji ?? "📦"} </span>
                    {p.product_name}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fechaCorta(p.starts_on)} → {fechaCorta(p.ends_on)}
                  </span>
                </div>
                {p.ended_reason !== "manual" && p.ended_reason !== null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.ended_reason === "reemplazo"
                      ? "La reemplazaste por otra."
                      : "Terminó cuando resolviste el lote."}
                  </p>
                )}

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Cifra valor={String(unidades)} caption="unidades vendidas" />
                  <Cifra valor={cobrado === null ? "—" : money(cobrado)} caption="cobraste" />
                  <Cifra valor={resignado === null ? "—" : money(resignado)} caption="resignaste" />
                </div>

                {/* El lote NO se cruza con las unidades: sin FIFO por lote,
                    "vendiste 6 de las 8 del lote" sería una atribución que el
                    dato no tiene. Se dicen como dos hechos separados. */}
                {loteQty !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    El lote era de <span className="tabular">{loteQty} u.</span>
                    {loteCosto !== null && <> (<span className="tabular">{money(loteCosto)}</span> al costo)</>}
                  </p>
                )}
                {unidades === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Nadie la compró.</p>
                )}
              </li>
            );
          })}
        </ul>

        <p className="border-t border-border p-4 text-xs text-muted-foreground">
          «Resignaste» es la diferencia entre el precio de lista y lo que cobraste. Se muestra
          siempre, salga como salga.
        </p>
      </CardList>
    </details>
  );
}

/** Las tres celdas son tipográficamente IDÉNTICAS: el reproche se fabrica con jerarquía. */
function Cifra({ valor, caption }: { valor: string; caption: string }) {
  return (
    <div className="min-w-0">
      <p className="tabular truncate text-sm font-semibold text-foreground">{valor}</p>
      <p className="text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Piezas compartidas
   ─────────────────────────────────────────────────────────────────────────── */

function Encabezado({
  emoji,
  nombre,
  chip,
}: {
  emoji: string | null;
  nombre: string;
  chip?: { label: string; tone: "danger" | "warning" | "muted" };
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-lg">
        {emoji ?? "📦"}
      </span>
      {/* `line-clamp-2` y NUNCA `truncate`: acá el nombre DECIDE. Dos productos
          que difieren sólo en el final (sabor, tamaño) se verían idénticos y el
          dueño bajaría el precio del equivocado — y en góndola eso no se
          deshace con un toque. */}
      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">{nombre}</p>
      {chip && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            chip.tone === "danger" && "bg-danger/15 text-danger-ink ring-1 ring-danger/30",
            chip.tone === "warning" && "bg-warning/15 text-warning-ink ring-1 ring-warning/30",
            chip.tone === "muted" && "text-muted-foreground",
          )}
        >
          <Clock className="size-3" />
          {chip.label}
        </span>
      )}
    </div>
  );
}

/** El único índigo de la card — misma clase literal que el badge del tile del POS. */
function ChipPct({ pct }: { pct: number }) {
  return (
    <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[11px] font-semibold text-info-ink ring-1 ring-info/30">
      −{pct}%
    </span>
  );
}

function BotonOtroPrecio({
  nombre,
  bloqueado,
  onClick,
}: {
  nombre: string;
  bloqueado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={bloqueado}
      onClick={onClick}
      aria-label={`Poner otro precio de promo a ${nombre}`}
      /* `size-11` y no `size-10`: el dueño decide esto parado y con una mano.
         44px es el piso táctil que ya fija el sistema de botones. */
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
    >
      <Pencil className="size-4" />
    </button>
  );
}

function Acciones({
  etiqueta,
  nombre,
  pendiente,
  bloqueado,
  bajoCosto,
  onPrimaria,
  onOtroPrecio,
}: {
  etiqueta: string;
  nombre: string;
  pendiente: boolean;
  bloqueado: boolean;
  bajoCosto: boolean;
  onPrimaria: () => void;
  onOtroPrecio: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={bloqueado}
        onClick={onPrimaria}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40",
          /* Bajo costo: el primario cambia de tono para que el segundo tap no
             sea una sorpresa. La confirmación en pesos vive en la hoja. */
          bajoCosto
            ? "border border-danger/40 bg-danger/10 text-danger-ink"
            : "bg-primary text-primary-foreground",
        )}
      >
        {pendiente && <LoaderCircle className="size-4 animate-spin" />}
        <span className="truncate">{etiqueta}</span>
      </button>
      <BotonOtroPrecio nombre={nombre} bloqueado={bloqueado} onClick={onOtroPrecio} />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Estados vacíos — cuatro casos, una sola caja.

   El cuarto (hay vencimientos pero todos se venden solos) no estaba en el plan
   y es el más importante: sin él, un dueño con 12 vencimientos cargados ve
   "no tenés nada para liquidar" y concluye que el motor está roto, cuando en
   realidad el motor decidió NO sugerir para no regalar margen.
   ─────────────────────────────────────────────────────────────────────────── */

function VacioSegunElCaso({
  tieneVencimientos,
  hayLotes,
}: {
  tieneVencimientos: boolean;
  hayLotes: boolean;
}) {
  if (!tieneVencimientos) {
    return (
      <Vacio
        titulo="Todavía no cargaste vencimientos"
        texto="Las promos salen de lo que está por vencer. Cargá una fecha cuando recibas mercadería y esta pantalla se llena sola."
        accion={{ href: "/admin/vencimientos", label: "Ir a Vencimientos", primaria: true }}
      />
    );
  }

  if (hayLotes) {
    return (
      <Vacio
        titulo="Nada que liquidar por ahora"
        texto="Tenés productos por vencer, pero al ritmo al que se venden salen a tiempo. Rebajarlos sería regalar margen."
        accion={{ href: "/admin/vencimientos", label: "Ver vencimientos", primaria: false }}
      />
    );
  }

  return (
    <Vacio
      titulo="No tenés nada para liquidar"
      texto="Ningún producto está cerca del vencimiento. Cuando alguno se acerque y no se venda al ritmo necesario, te lo proponemos acá."
    />
  );
}

function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: { href: string; label: string; primaria: boolean };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <EmptyArt name="precios" alt="Una etiqueta de precio colgando" />
      <p className="text-sm font-medium">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>
      {accion && (
        <ButtonLink
          href={accion.href}
          variant={accion.primaria ? "primary" : "secondary"}
          className="mt-4"
        >
          <CalendarClock className="size-4" /> {accion.label}
        </ButtonLink>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   Hojas de decisión
   ─────────────────────────────────────────────────────────────────────────── */

/** Poner un precio propio en vez del sugerido. El toque único es un default, no un veredicto. */
function OtroPrecioPromo({
  s,
  margenMinimo,
  pendiente,
  onCancel,
  onAplicar,
}: {
  s: Sugerencia;
  margenMinimo: number;
  pendiente: boolean;
  onCancel: () => void;
  onAplicar: (precio: number, belowCostOk: boolean) => void;
}) {
  const [valor, setValor] = useState(String(Math.round(Number(s.sugerido))));
  const [confirmandoBajoCosto, setConfirmandoBajoCosto] = useState(false);
  const precio = Number(valor);
  const costo = s.cost === null ? null : Number(s.cost);
  const lista = Number(s.list_price);
  const stock = Number(s.stock);
  const margen = margenPct(precio, costo);
  const bajoCosto = costo !== null && precio < costo;
  const valido = Number.isFinite(precio) && precio > 0 && precio < lista;

  if (confirmandoBajoCosto && costo !== null) {
    return (
      <BajoCosto
        costo={costo}
        precio={precio}
        stock={stock}
        pendiente={pendiente}
        onVolver={() => setConfirmandoBajoCosto(false)}
        onConfirmar={() => onAplicar(precio, true)}
      />
    );
  }

  return (
    <Hoja>
      <h2 className="mb-1 text-sm font-semibold">{s.name}</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Hoy lo vendés a {money(lista)}. Termina el {fechaCorta(s.expiry_date)}.
      </p>

      <label htmlFor="promo-otro" className="text-sm font-medium">
        Precio de promo
      </label>
      <input
        id="promo-otro"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        autoFocus
        className="tabular mt-1.5 h-12 w-full rounded-lg border border-input bg-background px-3 text-lg outline-none focus:border-primary"
      />
      <p className="mt-1.5 text-sm text-muted-foreground">
        {!Number.isFinite(precio) || precio <= 0 ? (
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

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Volver
        </Button>
        <button
          type="button"
          disabled={!valido || pendiente}
          onClick={() => (bajoCosto ? setConfirmandoBajoCosto(true) : onAplicar(precio, false))}
          className={cn(
            "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40",
            bajoCosto
              ? "border border-danger/40 bg-danger/10 text-danger-ink"
              : "bg-primary text-primary-foreground",
          )}
        >
          {pendiente && <LoaderCircle className="size-4 animate-spin" />}
          <span className="truncate">Poner a {money(precio || 0)}</span>
        </button>
      </div>
    </Hoja>
  );
}

/**
 * Terminar antes de tiempo.
 *
 * Merece un beat porque es un cambio de precio invisible para quien atiende: el
 * cajero no se entera hasta que la caja cobra distinto. Las dos cosas que el
 * copy no puede omitir son a cuánto vuelve —en pesos— y que las ventas ya
 * hechas no se tocan.
 */
function TerminarPromo({
  p,
  pendiente,
  onCancel,
  onConfirmar,
}: {
  p: PromoRow;
  pendiente: boolean;
  onCancel: () => void;
  onConfirmar: () => void;
}) {
  const actual = Number(p.precio_actual);
  const unidades = Number(p.unidades);
  const programada = p.estado === "programada";

  return (
    <Hoja>
      <h2 className="text-sm font-semibold">
        {programada ? "¿Cancelar" : "¿Terminar"} la promo de {p.product_name}?
      </h2>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {programada ? (
          /* Una programada nunca cobró nada: hablar de "vuelve a" sería inventar
             un cambio que no existe. */
          <p>
            Iba a arrancar el {fechaCorta(p.starts_on)} a{" "}
            <strong className="tabular text-foreground">{money(Number(p.promo_price))}</strong>. Si
            la cancelás, no llega a aplicarse nunca.
          </p>
        ) : (
          <>
            <p>
              Desde ahora la caja vuelve a cobrar{" "}
              <strong className="tabular text-foreground">{money(actual)}</strong>.
            </p>
            <p>
              {unidades > 0 ? (
                <>
                  Las <strong className="tabular text-foreground">{unidades}</strong> que ya
                  vendiste a {money(Number(p.promo_price))} quedan como están.
                </>
              ) : (
                <>No vendiste ninguna en promo, así que no cambia nada de lo registrado.</>
              )}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Volver
        </Button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onConfirmar}
          className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pendiente && <LoaderCircle className="size-4 animate-spin" />}
          {programada ? "Cancelar promo" : "Terminar promo"}
        </button>
      </div>
    </Hoja>
  );
}
