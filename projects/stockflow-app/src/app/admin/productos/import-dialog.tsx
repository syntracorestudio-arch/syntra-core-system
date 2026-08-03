"use client";

import { useRef, useState, useTransition } from "react";
import { X, Upload, LoaderCircle, FileSpreadsheet, TriangleAlert, Download } from "lucide-react";
import { money } from "@/lib/format";
import { importarProductos, type ImportResultado } from "./actions";
import {
  decodificar,
  parsearFilas,
  detectarFilaEncabezado,
  sugerirMapeo,
  armar,
  MAX_FILAS,
  type Campo,
  type FilaCruda,
} from "@/lib/csv-import";

/**
 * Import de catálogo desde planilla.
 *
 * La regla de todo el diálogo: **el archivo no se adivina, se muestra.** Lo que
 * detectamos (fila del encabezado, qué es cada columna, formato de los números)
 * son sugerencias que la persona confirma viendo las primeras filas ya
 * interpretadas. Es la única defensa real contra el error caro: si el lector
 * confunde `1.250` con uno con veinticinco, se carga toda la góndola a un peso.
 *
 * El archivo se lee y se trocea EN EL NAVEGADOR: no se sube a ningún lado y el
 * lector no engorda el bundle del mostrador.
 */

const CAMPOS: { valor: Campo; label: string }[] = [
  { valor: "nombre", label: "Nombre" },
  { valor: "precio", label: "Precio de venta" },
  { valor: "costo", label: "Costo" },
  { valor: "codigo", label: "Código de barras" },
  { valor: "stock", label: "Stock" },
  { valor: "ignorar", label: "Ignorar" },
];

/** Se manda de a 200: tandas chicas dan avance visible en catálogos grandes. */
const TANDA = 200;

export function ImportDialog({
  margenDefault,
  redondeo,
  onClose,
  onDone,
}: {
  margenDefault: number;
  redondeo: number;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [filas, setFilas] = useState<FilaCruda[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [encabezadoEn, setEncabezadoEn] = useState(0);
  const [mapeo, setMapeo] = useState<Campo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function alElegirArchivo(file: File) {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo es muy grande (máximo 10 MB).");
      return;
    }
    const texto = decodificar(await file.arrayBuffer());
    const f = parsearFilas(texto);
    if (f.length < 2) {
      setError("No pudimos leer filas en ese archivo. ¿Está guardado como CSV?");
      return;
    }
    const enc = detectarFilaEncabezado(f);
    setFilas(f);
    setNombreArchivo(file.name);
    // Sin encabezado reconocible arrancamos en la primera fila y lo elige la persona.
    setEncabezadoEn(enc >= 0 ? enc : 0);
    setMapeo(sugerirMapeo(f[enc >= 0 ? enc : 0]));
  }

  const resultado = filas ? armar(filas, encabezadoEn, mapeo) : null;
  const tieneNombre = mapeo.includes("nombre");
  const muestra = resultado?.productos.slice(0, 5) ?? [];

  function importar() {
    if (!resultado || resultado.productos.length === 0) return;
    startTransition(async () => {
      const total = resultado.productos.length;
      const acumulado: ImportResultado = { creados: 0, yaExistian: 0, fallados: 0 };

      for (let i = 0; i < total; i += TANDA) {
        setProgreso({ hechos: i, total });
        const res = await importarProductos({
          productos: resultado.productos.slice(i, i + TANDA).map((p) => ({
            nombre: p.nombre.slice(0, 80),
            precio: p.precio,
            costo: p.costo,
            codigo: p.codigo,
            stock: p.stock,
          })),
          margenPct: margenDefault,
          redondeo,
        });
        if (!res.ok) {
          setProgreso(null);
          setError(res.error);
          return;
        }
        acumulado.creados += res.resultado.creados;
        acumulado.yaExistian += res.resultado.yaExistian;
        acumulado.fallados += res.resultado.fallados;
      }

      setProgreso(null);
      const partes = [`${acumulado.creados} productos cargados`];
      if (acumulado.yaExistian > 0) partes.push(`${acumulado.yaExistian} ya los tenías`);
      if (acumulado.fallados > 0) partes.push(`${acumulado.fallados} no se pudieron cargar`);
      onDone(partes.join(" · ") + ".");
    });
  }

  function bajarRechazos() {
    if (!resultado) return;
    const csv = [
      "fila,motivo,contenido",
      ...resultado.rechazos.map((r) => `${r.fila},"${r.motivo}","${r.contenido.replace(/"/g, '""')}"`),
    ].join("\n");
    descargar(csv, "filas-no-cargadas.csv");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Traer productos de una planilla</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-ink ring-1 ring-danger/25">
            {error}
          </p>
        )}

        {!filas ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50"
            >
              <Upload className="size-7 text-muted-foreground" />
              <span className="text-sm font-medium">Elegí el archivo CSV</span>
              <span className="text-xs text-muted-foreground">
                Si tenés un Excel, abrilo y usá &quot;Guardar como → CSV&quot;
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) alElegirArchivo(f);
              }}
            />
            <button
              type="button"
              onClick={() =>
                descargar(
                  "nombre,precio,costo,codigo,stock\nCoca-Cola 2.25L,3500,2400,7790895000997,\n",
                  "plantilla-stockflow.csv",
                )
              }
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <Download className="size-3.5" /> Bajar una plantilla de ejemplo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{nombreArchivo}</span>
              <button
                type="button"
                onClick={() => setFilas(null)}
                className="shrink-0 cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
              >
                cambiar
              </button>
            </p>

            {/* Fila del encabezado: las listas reales arrancan con título y fecha. */}
            <div className="space-y-1.5">
              <label htmlFor="imp-enc" className="text-xs font-medium">
                ¿En qué fila están los títulos de las columnas?
              </label>
              <select
                id="imp-enc"
                value={encabezadoEn}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEncabezadoEn(n);
                  setMapeo(sugerirMapeo(filas[n]));
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {filas.slice(0, 15).map((f, i) => (
                  <option key={i} value={i}>
                    Fila {i + 1}: {f.filter(Boolean).slice(0, 4).join(" · ").slice(0, 60) || "(vacía)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Mapeo: una fila por columna del archivo. */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium">¿Qué es cada columna?</p>
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {filas[encabezadoEn].map((celda, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {celda || `(columna ${i + 1})`}
                    </span>
                    <select
                      value={mapeo[i] ?? "ignorar"}
                      onChange={(e) => {
                        const m = [...mapeo];
                        m[i] = e.target.value as Campo;
                        setMapeo(m);
                      }}
                      aria-label={`Qué es la columna ${celda || i + 1}`}
                      className="h-9 w-40 shrink-0 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                    >
                      {CAMPOS.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {!tieneNombre ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink ring-1 ring-warning/25">
                Marcá cuál es la columna del <strong>nombre</strong>: sin eso no hay producto que
                cargar.
              </p>
            ) : (
              <>
                {/* La vista previa es el seguro: los números se muestran YA
                    interpretados, así un error de formato se ve antes de cargar
                    800 productos a un peso. */}
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Así van a quedar las primeras filas
                  </p>
                  <ul className="space-y-1.5">
                    {muestra.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                        {p.precio !== null ? (
                          <span className="tabular shrink-0 font-semibold">{money(p.precio)}</span>
                        ) : p.costo !== null ? (
                          /* Sin `shrink-0`: este texto mide ~190px y, al negarse
                             a achicarse, dejaba ~98px (unos 12 caracteres) para
                             el nombre del producto y desbordaba la fila. Que se
                             recorte él antes que el nombre. */
                          <span className="tabular min-w-0 shrink truncate text-xs text-muted-foreground">
                            costo {money(p.costo)} · {margenDefault}%
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-warning-ink">sin precio</span>
                        )}
                      </li>
                    ))}
                    {muestra.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        No encontramos filas para cargar con este mapeo.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Resumen honesto ANTES de tocar nada. */}
                {resultado && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="tabular font-semibold text-foreground">
                        {resultado.productos.length}
                      </span>{" "}
                      productos para cargar
                      {resultado.productos.length >= MAX_FILAS && " (tope de 5000 por archivo)"}
                      {mapeo.includes("stock") &&
                        resultado.productos.filter((p) => (p.stock ?? 0) > 0).length > 0 &&
                        ` · ${resultado.productos.filter((p) => (p.stock ?? 0) > 0).length} con stock`}
                    </p>
                    {resultado.productos.filter((p) => p.codigoIlegible).length > 0 && (
                      <p className="flex items-start gap-1.5 text-warning-ink">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        {resultado.productos.filter((p) => p.codigoIlegible).length} códigos que
                        Excel guardó como número y ya no se pueden leer: esos productos entran sin
                        código y se lo pegás escaneando.
                      </p>
                    )}
                    {resultado.codigosDuplicados > 0 && (
                      <p>{resultado.codigosDuplicados} códigos repetidos en el archivo (queda el primero)</p>
                    )}
                    {resultado.rechazos.length > 0 && (
                      <p>
                        {resultado.rechazos.length} filas que no se cargan ·{" "}
                        <button
                          type="button"
                          onClick={bajarRechazos}
                          className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                        >
                          ver cuáles
                        </button>
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={importar}
                  disabled={pending || (resultado?.productos.length ?? 0) === 0}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {pending && <LoaderCircle className="size-4 animate-spin" />}
                  {progreso
                    ? `Cargando ${progreso.hechos} de ${progreso.total}…`
                    : `Cargar ${resultado?.productos.length ?? 0} productos`}
                </button>
                <p className="text-xs text-muted-foreground">
                  {mapeo.includes("stock")
                    ? "Entran con el stock de la planilla ya cargado (después lo podés corregir a mano). Sin categoría: eso se asigna después en bloque."
                    : "Entran sin categoría y sin stock contado. Si tu planilla tiene una columna de cantidad, marcala arriba y la cargamos."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function descargar(contenido: string, nombre: string) {
  // BOM: sin él, Excel abre el CSV en Latin-1 y rompe los acentos.
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
