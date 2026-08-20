"use client";

import { LayoutList, CalendarCheck, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/app/login/actions";

export type Vista = "cartera" | "cobranza";

/** Los recortes de la cartera. `todos` no es un filtro: es la ausencia de uno. */
export type Filtro = "todos" | "deben" | "prueba" | "sin_plan" | "sin_vender" | "de_baja";

/**
 * Los filtros, AGRUPADOS POR EJE.
 *
 * Antes eran una lista plana de seis y mezclaba dos preguntas distintas:
 * "Deben" y "Sin plan" hablan de la relación COMERCIAL, "Sin vender" habla de
 * si el negocio USA el producto. Un cliente puede estar al día y no vender
 * hace un mes —de hecho es el caso más peligroso, porque se va a dar de baja
 * y todavía no te debe nada— y con los seis chips en fila esa diferencia no se
 * leía: parecían seis variantes de lo mismo.
 *
 * Los grupos no son decoración; son las dos preguntas que se hacen en la
 * sentada semanal: ¿quién me debe? y ¿quién se está por ir?
 */
export const GRUPOS: { titulo: string; filtros: { id: Filtro; label: string }[] }[] = [
  {
    titulo: "Cobranza",
    filtros: [
      { id: "deben", label: "Deben" },
      { id: "prueba", label: "En prueba" },
      { id: "sin_plan", label: "Sin plan" },
      { id: "de_baja", label: "De baja" },
    ],
  },
  {
    titulo: "Uso",
    filtros: [
      /* La señal de retención más temprana que hay: un cliente que dejó de
         vender se da de baja ANTES de deberte plata. */
      { id: "sin_vender", label: "Sin vender" },
    ],
  },
];

/** Plano, para los conteos y para cualquiera que necesite recorrerlos todos. */
export const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  ...GRUPOS.flatMap((g) => g.filtros),
];

/**
 * La identidad del panel de plataforma.
 *
 * Se exporta para que la FICHA de un cliente use exactamente ésta y no una
 * copia parecida. Que las dos pantallas se vean iguales no es prolijidad: el
 * error caro de este panel es operar sobre el negocio equivocado, y saber en
 * qué sistema estás parado es la primera prevención. Una ficha sin cromo se
 * parece demasiado al panel de un cliente.
 */
export function IdentidadSyntra({
  email,
  salirVisible = "",
}: {
  email: string | null;
  salirVisible?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4 lg:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">SYNTRA</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      {/* En el rail de mobile el "Salir" del pie queda oculto: sin esto no
          habria forma de cerrar sesion desde el telefono. En la ficha se
          muestra siempre. */}
      <form action={signOut} className={salirVisible}>
        <button
          type="submit"
          aria-label="Salir"
          className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/**
 * El rail del panel de plataforma.
 *
 * POR QUÉ SIDEBAR Y NO TABS. La recomendación del `design-director` era tabs:
 * con 4 destinos y uso semanal, una sidebar de navegación es un mueble con
 * cuatro cajones robándole 240px a la tabla, que es lo que quiere ancho. Tenía
 * razón sobre la NAVEGACIÓN — pero lo que el owner pidió no era eso: quería un
 * lugar donde ir sumando filtros. Eso no es un rail de navegación, es un rail
 * de FILTROS, y ése sí se justifica con dos destinos: los filtros son
 * persistentes, se combinan con lo que estás mirando y no tienen dónde vivir en
 * una fila de tabs.
 *
 * Así que el rail hace las dos cosas y la navegación es la parte chica.
 *
 * SE VE DISTINTO DEL PANEL DEL CLIENTE a propósito: el del dueño es white-label
 * con el accent de su negocio; éste es fijo, marca SYNTRA. El error caro de
 * esta pantalla es operar sobre el negocio equivocado, y saber en qué sistema
 * estás parado es prevención, no branding.
 */
export function SuperSidebar({
  email,
  vista,
  onVista,
  filtro,
  onFiltro,
  conteos,
}: {
  email: string | null;
  vista: Vista;
  onVista: (v: Vista) => void;
  filtro: Filtro;
  onFiltro: (f: Filtro) => void;
  conteos: Record<Filtro, number>;
}) {
  const navs: { id: Vista; label: string; icon: typeof LayoutList }[] = [
    { id: "cartera", label: "Cartera", icon: LayoutList },
    { id: "cobranza", label: "Cobranza", icon: CalendarCheck },
  ];

  return (
    <aside
      className={cn(
        "shrink-0 border-border bg-card",
        /* Mobile: barra superior con lo mínimo. El panel es de escritorio —se
           usa sentado, una vez por semana— así que en teléfono no se pelea por
           reproducir el rail: se colapsa a navegación y los filtros pasan a ser
           una tira scrolleable. */
        "border-b lg:h-dvh lg:w-60 lg:border-b-0 lg:border-r",
        "lg:sticky lg:top-0 lg:flex lg:flex-col",
      )}
    >
      <IdentidadSyntra email={email} salirVisible="lg:hidden" />

      <nav className="flex gap-1 px-3 pb-3 lg:flex-col lg:px-3">
        {navs.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onVista(n.id)}
            aria-current={vista === n.id ? "page" : undefined}
            className={cn(
              "flex h-9 flex-1 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm transition-colors lg:flex-none",
              vista === n.id
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <n.icon className="size-4 shrink-0" aria-hidden />
            {n.label}
          </button>
        ))}
      </nav>

      {/* Los filtros son de la CARTERA: en la grilla de cobranza no recortan
          nada, así que se ocultan en vez de quedar ahí sin efecto. Un control
          visible que no hace nada enseña a desconfiar de los que sí hacen. */}
      {vista === "cartera" && (
        <div className="min-h-0 flex-1 overflow-x-auto px-3 pb-3 lg:overflow-x-visible lg:overflow-y-auto">
          <div className="flex items-stretch gap-1.5 lg:flex-col lg:gap-0">
            <Chip
              filtro={{ id: "todos", label: "Todos" }}
              activo={filtro === "todos"}
              n={conteos.todos}
              onClick={() => onFiltro("todos")}
            />

            {GRUPOS.map((g) => {
              /* Un grupo entero en cero no se muestra: "Uso · Sin vender 0"
                 ocupa dos renglones para decir que no hay nada. Se conserva si
                 el filtro activo vive adentro, para no borrar de la pantalla el
                 control que el usuario acaba de tocar. */
              const visibles = g.filtros.filter((f) => conteos[f.id] > 0 || filtro === f.id);
              if (visibles.length === 0) return null;
              return (
                <div key={g.titulo} className="contents lg:block">
                  <p className="hidden px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:block">
                    {g.titulo}
                  </p>
                  {/* En mobile el rail es una tira horizontal y los títulos de
                      grupo no entran; se separa con una línea vertical para que
                      igual se lea que son dos familias. */}
                  <span
                    aria-hidden
                    className="my-1 w-px shrink-0 self-stretch bg-border lg:hidden"
                  />
                  {visibles.map((f) => (
                    <Chip
                      key={f.id}
                      filtro={f}
                      activo={filtro === f.id}
                      n={conteos[f.id]}
                      onClick={() => onFiltro(f.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form action={signOut} className="hidden px-3 pb-4 lg:block">
        <button
          type="submit"
          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden /> Salir
        </button>
      </form>
    </aside>
  );
}

/**
 * Un filtro.
 *
 * `h-10` y no `h-8`: es un objetivo táctil y 32px queda por debajo del mínimo
 * accesible. En un rail vertical el alto extra no cuesta nada.
 *
 * El conteo va `tabular` para que los números queden en columna entre chips —
 * con cifras proporcionales, un 1 y un 11 desalinean toda la lista.
 */
function Chip({
  filtro,
  activo,
  n,
  onClick,
}: {
  filtro: { id: Filtro; label: string };
  activo: boolean;
  n: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex h-10 shrink-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "lg:w-full",
        activo
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      <span>{filtro.label}</span>
      <span className={cn("tabular text-xs", activo ? "text-foreground" : "text-muted-foreground")}>
        {n}
      </span>
    </button>
  );
}
