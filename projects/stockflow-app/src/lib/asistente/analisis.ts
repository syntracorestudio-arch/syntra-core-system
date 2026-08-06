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
  /** La fuga #1 del ranking por plata al año. Si existe, ninguna acción puede ignorarla. */
  principal?: TipoAccion | null;
};

export type VeredictoAnalisis = { ok: true; analisis: Analisis } | { ok: false; motivo: string };

/* Topes generosos a propósito: en la comparación real, dos de tres análisis de
   Haiku se descartaron por pasarse de 260 caracteres en `porque` — y eran los
   buenos, los que conectaban tres hechos. Un tope que corta la explicación
   castiga justo lo que queremos. El email tiene lugar de sobra. */
const LARGO = { titulo: 90, porque: 380, texto: 240, fuga: 320, huecos: 340 } as const;

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

/**
 * Un producto nombrado a medias es un producto inventado.
 *
 * El chequeo del campo `producto` no alcanza: un nombre puede aparecer solo en
 * el TEXTO de la acción, y ahí nadie lo estaba mirando. Si el modelo deforma una
 * marca real ("Chesterfield" + un formato que ese producto no tiene), manda al
 * dueño a buscar algo que no está en el estante.
 *
 * La regla: si el texto menciona la primera palabra de un producto del catálogo
 * (la marca), tiene que aparecer el nombre COMPLETO de alguno. No detecta nombres
 * inventados de la nada — no hay cómo saber cuáles son — pero sí el caso que
 * importa, que es deformar uno real.
 */
function nombreDeformado(texto: string, productos: string[]): string | null {
  const t = texto.toLocaleLowerCase("es-AR");
  for (const p of productos) {
    const marca = p.trim().split(/\s+/)[0]?.toLocaleLowerCase("es-AR");
    if (!marca || marca.length < 4) continue; // "Coca" sí, "x6" no
    if (!t.includes(marca)) continue;
    if (!productos.some((q) => t.includes(q.toLocaleLowerCase("es-AR")))) return p;
  }
  return null;
}

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
    const deformado = nombreDeformado(acc.texto, verdad.productos);
    if (deformado) {
      ultimoMotivo = `producto_deformado:${deformado}`;
      continue;
    }
    if (acc.producto != null && !verdad.productos.some((p) => mismoNombre(p, acc.producto as string))) {
      ultimoMotivo = `producto_inexistente:${acc.producto}`;
      continue;
    }
    /* "Ajustá los precios" vale la mitad que "ajustá los precios y recuperás
       $57.910 por mes": el monto es lo que convierte un consejo en una decisión.
       Se exige en las fugas de plata; en las de datos no hay plata que contar. */
    if (acc.tipo !== "datos" && acc.monto == null) {
      ultimoMotivo = `accion_sin_monto:${acc.tipo}`;
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

  /* COBERTURA. En una corrida real el modelo devolvió tres acciones de fiado y
     dejó afuera $57.910 por mes de margen mal puesto. Un análisis que mira una
     sola fuga teniendo varias es medio análisis, y el dueño no tiene cómo darse
     cuenta de lo que no le dijeron. Si el negocio tiene una sola, con esa basta.

     Se mide sobre lo que el modelo PROPUSO, no sobre lo que sobrevivió al
     filtro: son dos cosas distintas. La cobertura juzga si se tomó el trabajo de
     mirar todo el negocio; el filtro de arriba juzga si lo que dijo es cierto.
     Descartar un análisis completo porque una de sus acciones citó mal un
     producto sería castigar la verdad con la vara del esfuerzo. */
  const fugasDePlata = verdad.fugas.filter((f) => f !== "datos");
  const propuestas = new Set(
    a.acciones.filter((x) => x && verdad.fugas.includes(x.tipo) && x.tipo !== "datos").map((x) => x.tipo),
  );
  if (fugasDePlata.length >= 2 && propuestas.size < 2) {
    return { ok: false, motivo: `cobertura_insuficiente:${[...propuestas].join(",") || "ninguna"}` };
  }

  /* La fuga MÁS CARA no puede quedar sin qué-hacer. Pasó en una corrida real:
     el dolor nombraba el remarcado como problema #1 y las acciones cubrían las
     otras dos fugas — cobertura formalmente cumplida, botón principal ausente.
     Igual que la cobertura, se mide sobre lo PROPUESTO. */
  if (verdad.principal && verdad.fugas.includes(verdad.principal)) {
    const atacada = a.acciones.some((x) => x && x.tipo === verdad.principal);
    if (!atacada) return { ok: false, motivo: `sin_accion_principal:${verdad.principal}` };
  }

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
