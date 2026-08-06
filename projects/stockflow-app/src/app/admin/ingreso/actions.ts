"use server";

import { requireSession } from "@/lib/session";
import { buscarParaIngreso, type IngresoBuscado } from "@/app/admin/productos/actions";
import { leerRemito } from "@/lib/asistente/leer-remito";
import { prepararImagen } from "@/lib/asistente/remito";

/**
 * Una línea del remito, ya cruzada contra el catálogo del negocio.
 *
 * `candidatos` y no `producto`: el modelo NO elige el producto. Transcribe el
 * renglón, el código lo busca con `ingreso_buscar` (la misma búsqueda que usa el
 * operario a mano) y la pantalla muestra lo que encontró para que él confirme.
 * Si el modelo eligiera, un nombre parecido le sumaría stock al producto
 * equivocado y nadie lo auditaría.
 */
export type LineaPropuesta = {
  /** Lo que dice el renglón del remito, tal cual se transcribió. */
  texto: string;
  cantidad: number;
  costoUnitario: number | null;
  /** Lo que encontró la búsqueda del catálogo, mejor primero. Puede venir vacío. */
  candidatos: IngresoBuscado[];
};

export type ResultadoLectura =
  | { ok: true; lineas: LineaPropuesta[]; sinMatch: number }
  | { ok: false; error: string };

/* Cota de costo y de tiempo: una foto por vez, y el cruce contra el catálogo
   corre acotado — 60 líneas × 1 búsqueda es el techo que impone `remito.ts`. */
export async function leerRemitoDelProveedor(formData: FormData): Promise<ResultadoLectura> {
  const session = await requireSession();
  if (!(session.member.role === "owner" || session.member.can_receive_stock)) {
    return { ok: false, error: "No tenés permiso para cargar mercadería." };
  }

  const file = formData.get("remito");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Elegí una foto del remito." };
  }

  const imagen = await prepararImagen(file);
  if (!imagen.ok) return { ok: false, error: imagen.error };

  const leido = await leerRemito({ base64: imagen.base64, mediaType: imagen.mediaType });
  if (!leido.ok) return { ok: false, error: leido.error };

  /* El cruce contra el catálogo, en paralelo. `buscarParaIngreso` ya valida
     sesión y permisos por su cuenta y devuelve [] ante cualquier problema, así
     que una línea sin match no rompe la carga: queda para resolver a mano. */
  const lineas: LineaPropuesta[] = await Promise.all(
    leido.lineas.map(async (l) => ({
      texto: l.texto,
      cantidad: l.cantidad,
      costoUnitario: l.costoUnitario,
      candidatos: (await buscarParaIngreso(l.texto)).slice(0, 3),
    })),
  );

  return { ok: true, lineas, sinMatch: lineas.filter((l) => l.candidatos.length === 0).length };
}
