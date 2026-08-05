/**
 * analisis.ts — la forma del análisis que escribe el modelo, y su verificación.
 *
 * El cambio de fondo respecto del párrafo suelto: **pedimos campos, no prosa**.
 * En texto libre solo se pueden verificar los números, así que una afirmación sin
 * cifras pasa siempre — y es la que más caro sale, porque el dueño no tiene cómo
 * detectarla. Con campos, cada pieza se contrasta contra algo que la app calculó:
 * el producto tiene que existir, el monto tiene que ser UN valor computado, y el
 * tipo de acción tiene que corresponder a una fuga que este negocio realmente
 * tiene. Lo que no se puede verificar, no se acepta.
 */

import { cifrasVerificables } from "./hechos.ts";

/** Las fugas de plata que el sistema sabe detectar y cuantificar. */
export type TipoAccion = "remarcar" | "stock_muerto" | "fiado" | "datos";

export type Accion = {
  tipo: TipoAccion;
  /** Qué hacer, en una línea, con el número adentro. */
  texto: string;
  /** Producto sobre el que se actúa; debe existir en el negocio. */
  producto: string | null;
  /** Plata en juego; debe ser un valor que calculó la app. */
  monto: number | null;
};

export type Analisis = {
  /** El problema más caro del mes y su causa. */
  dolor: { titulo: string; porque: string };
  /** Qué hacer. Sin al menos una, el diagnóstico no sirve de nada. */
  acciones: Accion[];
  /** Un patrón o riesgo que no está en las tarjetas del email. */
  fuga: string | null;
  /** Datos faltantes que invalidan conclusiones. Decir "no sé" es una función. */
  huecos: string | null;
};

/** Lo que la app calculó de verdad. El análisis se contrasta contra esto. */
export type Verdad = {
  numeros: number[];
  productos: string[];
  fugas: readonly TipoAccion[];
};

export type VeredictoAnalisis = { ok: true; analisis: Analisis } | { ok: false; motivo: string };

const LARGO = { titulo: 90, porque: 260, texto: 200, fuga: 260, huecos: 260 } as const;

/** Un campo de texto: ni vacío, ni desmedido, ni con markup, ni con cifras inventadas. */
function textoValido(valor: string, max: number, verdad: Verdad, campo: string): string | null {
  const s = (valor ?? "").trim();
  if (s.length === 0) return `${campo}_vacio`;
  if (s.length > max) return `${campo}_largo:${s.length}`;
  if (/<[^>]+>/.test(s)) return `${campo}_html`;
  if (/https?:\/\/|www\./i.test(s)) return `${campo}_link`;
  /* El MISMO control de cifras que el párrafo, sin sus cotas de largo: cada campo
     tiene la suya (un título no se mide con la vara de un párrafo). */
  const cifras = cifrasVerificables(s, verdad.numeros, verdad.productos);
  return cifras.ok ? null : `${campo}_${cifras.motivo}`;
}

/**
 * Los modelos mandan el monto como "$57.910" o "57910" aunque el esquema pida un
 * número. Se normaliza la FORMA; el valor sigue teniendo que coincidir con uno
 * calculado.
 */
function aNumeroDeMonto(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  // "$57.910" -> "57910": se sacan el signo, los espacios y los puntos de miles.
  const s = v
    .replace(/[$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

/** Comparación de nombres tolerante a mayúsculas y espacios, no a inventos. */
const mismoNombre = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es-AR") === b.trim().toLocaleLowerCase("es-AR");

export function verificarAnalisis(a: Analisis, verdad: Verdad): VeredictoAnalisis {
  if (!a || typeof a !== "object" || !a.dolor || !Array.isArray(a.acciones)) {
    return { ok: false, motivo: "forma_invalida" };
  }

  /* El dolor es ESTRICTO: es el encabezado del análisis y lo que le da sentido a
     todo lo de abajo. Si no se puede verificar, no hay análisis que mostrar. */
  for (const [campo, valor, max] of [
    ["titulo", a.dolor.titulo, LARGO.titulo],
    ["porque", a.dolor.porque, LARGO.porque],
  ] as const) {
    const mal = textoValido(valor, max, verdad, campo);
    if (mal) return { ok: false, motivo: mal };
  }

  /* Las acciones se filtran de a una: que se caiga la que menciona un producto
     inventado no es razón para tirar las dos que estaban bien. */
  const acciones: Accion[] = [];
  let ultimoMotivo = "sin_acciones";
  for (const acc of a.acciones) {
    if (!acc || !verdad.fugas.includes(acc.tipo)) {
      ultimoMotivo = `tipo_desconocido:${acc?.tipo}`;
      continue;
    }
    const mal = textoValido(acc.texto, LARGO.texto, verdad, "accion");
    if (mal) {
      ultimoMotivo = mal;
      continue;
    }
    if (acc.producto != null && !verdad.productos.some((p) => mismoNombre(p, acc.producto as string))) {
      ultimoMotivo = `producto_inexistente:${acc.producto}`;
      continue;
    }
    let monto: number | null = null;
    if (acc.monto != null) {
      const m = aNumeroDeMonto(acc.monto);
      /* El valor sigue teniendo que ser UNO de los calculados: acá solo se
         tolera la forma ("$57.910" en vez de 57910), que es lo que mandan los
         modelos aunque el esquema pida un número. */
      if (m === null || !verdad.numeros.includes(m)) {
        ultimoMotivo = `monto_no_calculado:${acc.monto}`;
        continue;
      }
      monto = m;
    }
    acciones.push({ tipo: acc.tipo, texto: acc.texto.trim(), producto: acc.producto ?? null, monto });
  }

  // Un diagnóstico sin nada que hacer no es un análisis: es una queja.
  if (acciones.length === 0) return { ok: false, motivo: ultimoMotivo };

  const extras: { campo: "fuga" | "huecos"; valor: string | null }[] = [
    { campo: "fuga", valor: a.fuga ?? null },
    { campo: "huecos", valor: a.huecos ?? null },
  ];
  const limpios: Record<string, string | null> = { fuga: null, huecos: null };
  for (const { campo, valor } of extras) {
    if (valor == null || valor.trim() === "") continue;
    const mal = textoValido(valor, LARGO[campo], verdad, campo);
    if (mal) return { ok: false, motivo: mal };
    limpios[campo] = valor.trim();
  }

  return {
    ok: true,
    analisis: {
      dolor: { titulo: a.dolor.titulo.trim(), porque: a.dolor.porque.trim() },
      acciones,
      fuga: limpios.fuga,
      huecos: limpios.huecos,
    },
  };
}
