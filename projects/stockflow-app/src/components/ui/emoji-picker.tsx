"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Selector de ícono de producto.
 *
 * Antes era un input de texto donde había que PEGAR un emoji: en la computadora
 * eso obliga a conocer `Win + .`, que casi nadie sabe, y en el teléfono a buscar
 * entre miles. Acá van los de kiosco agrupados por rubro, con buscador en
 * castellano, y queda el campo libre para cualquier otro.
 */

type Grupo = { nombre: string; emojis: { e: string; k: string }[] };

const GRUPOS: Grupo[] = [
  {
    nombre: "Bebidas",
    emojis: [
      { e: "🥤", k: "gaseosa vaso refresco coca" },
      { e: "💧", k: "agua mineral botella" },
      { e: "🧃", k: "jugo caja exprimido" },
      { e: "🍺", k: "cerveza birra chopp" },
      { e: "🍷", k: "vino tinto copa" },
      { e: "🥂", k: "champagne sidra brindis" },
      { e: "🧉", k: "mate yerba termo" },
      { e: "☕", k: "cafe te infusion" },
      { e: "🥛", k: "leche lacteo" },
      { e: "🧋", k: "licuado batido" },
      { e: "🍾", k: "botella espumante" },
      { e: "🫗", k: "bebida servir" },
    ],
  },
  {
    nombre: "Golosinas",
    emojis: [
      { e: "🍫", k: "chocolate alfajor barra" },
      { e: "🍬", k: "caramelo golosina dulce" },
      { e: "🍭", k: "chupetin paleta" },
      { e: "🍪", k: "galletita cookie dulce" },
      { e: "🧁", k: "cupcake magdalena budin" },
      { e: "🍩", k: "dona rosquilla" },
      { e: "🍦", k: "helado palito" },
      { e: "🍮", k: "flan postre" },
      { e: "🍯", k: "miel dulce" },
      { e: "🫐", k: "chicle pastilla" },
    ],
  },
  {
    nombre: "Cigarrillos",
    emojis: [
      { e: "🚬", k: "cigarrillo tabaco puchos" },
      { e: "🔥", k: "encendedor fosforo yesquero" },
      { e: "🍃", k: "tabaco armar" },
    ],
  },
  {
    nombre: "Almacén",
    emojis: [
      { e: "🍚", k: "arroz grano" },
      { e: "🍝", k: "fideos pasta tallarines" },
      { e: "🥫", k: "lata conserva tomate" },
      { e: "🧂", k: "sal condimento especias" },
      { e: "🫙", k: "frasco mermelada dulce" },
      { e: "🥣", k: "cereal avena polenta" },
      { e: "🌽", k: "choclo maiz" },
      { e: "🫒", k: "aceite oliva aceituna" },
      { e: "🥔", k: "papa fritas snack" },
      { e: "🍿", k: "pochoclo palomitas" },
      { e: "🥜", k: "mani frutos secos" },
      { e: "🧄", k: "ajo cebolla verdura" },
    ],
  },
  {
    nombre: "Fiambres",
    emojis: [
      { e: "🥓", k: "panceta jamon fiambre" },
      { e: "🧀", k: "queso cremoso rallado" },
      { e: "🍖", k: "carne salame" },
      { e: "🥩", k: "carne milanesa bife" },
      { e: "🌭", k: "salchicha pancho" },
      { e: "🥚", k: "huevo docena" },
    ],
  },
  {
    nombre: "Panadería",
    emojis: [
      { e: "🍞", k: "pan lactal molde" },
      { e: "🥐", k: "medialuna factura" },
      { e: "🥖", k: "flauta baguette pan" },
      { e: "🥯", k: "rosca bagel" },
      { e: "🎂", k: "torta cumpleanos" },
      { e: "🥧", k: "tarta pascualina" },
    ],
  },
  {
    nombre: "Limpieza",
    emojis: [
      { e: "🧼", k: "jabon detergente lavandina" },
      { e: "🧽", k: "esponja virulana" },
      { e: "🧴", k: "shampoo crema perfume" },
      { e: "🧹", k: "escoba secador" },
      { e: "🪣", k: "balde trapo" },
      { e: "🧻", k: "papel higienico rollo servilleta" },
      { e: "🪥", k: "cepillo dientes pasta" },
      { e: "🧺", k: "ropa lavar suavizante" },
    ],
  },
  {
    nombre: "Varios",
    emojis: [
      { e: "📦", k: "generico caja otro" },
      { e: "🔋", k: "pila bateria" },
      { e: "💡", k: "lampara foco luz" },
      { e: "🩹", k: "curita farmacia remedio" },
      { e: "✏️", k: "lapiz libreria escolar" },
      { e: "📱", k: "carga celular credito" },
      { e: "🧦", k: "media ropa" },
      { e: "🎈", k: "globo fiesta cotillon" },
      { e: "🃏", k: "carta naipes juego" },
      { e: "🎁", k: "regalo" },
      { e: "🐕", k: "perro mascota alimento" },
      { e: "🐈", k: "gato mascota" },
    ],
  },
];

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return GRUPOS;
    return GRUPOS.map((g) => ({
      ...g,
      emojis: g.emojis.filter((x) => x.k.includes(q) || g.nombre.toLowerCase().includes(q)),
    })).filter((g) => g.emojis.length > 0);
  }, [busqueda]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Elegir ícono del producto"
        aria-expanded={abierto}
        className="h-11 w-full cursor-pointer rounded-lg border border-input bg-background text-center text-xl outline-none transition-colors hover:border-primary focus:border-primary"
      >
        {value || "📦"}
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar tocando afuera */}
          <button
            type="button"
            aria-label="Cerrar selector"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-xl">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar: agua, alfajor, jabón…"
                aria-label="Buscar ícono"
                autoFocus
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {resultados.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nada con ese nombre. Podés pegar cualquier emoji abajo.
              </p>
            ) : (
              resultados.map((g) => (
                <div key={g.nombre} className="mb-2 last:mb-0">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">{g.nombre}</p>
                  <div className="grid grid-cols-7 gap-0.5">
                    {g.emojis.map((x) => (
                      <button
                        key={x.e}
                        type="button"
                        onClick={() => {
                          onChange(x.e);
                          setAbierto(false);
                          setBusqueda("");
                        }}
                        title={x.k.split(" ")[0]}
                        className={cn(
                          "grid size-8 cursor-pointer place-items-center rounded-md text-lg transition-colors hover:bg-secondary",
                          value === x.e && "bg-accent ring-1 ring-primary",
                        )}
                      >
                        {x.e}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Escapatoria: cualquier emoji que no esté en la lista. */}
            <div className="mt-2 border-t border-border pt-2">
              <input
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, 4))}
                placeholder="…o pegá otro"
                aria-label="Pegar un emoji"
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-center text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
