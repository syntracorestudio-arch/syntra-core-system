import { TriangleAlert } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";

type MiSuscripcion =
  | { estado: "sin_sesion" | "no_corresponde" | "al_dia" }
  | {
      estado: "debe";
      deuda: number;
      meses_impagos: number;
      desde: string;
      parcial: boolean;
      suspende_el: string;
    };

const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

/** "2026-08-25" → "25 de agosto". En un aviso, la fecha se lee mejor escrita. */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[m - 1]}${a !== new Date().getFullYear() ? ` de ${a}` : ""}`;
}

/**
 * Aviso de suscripción impaga — la parte que NO se puede perder.
 *
 * Existe porque el push es efímero: si al dueño se le pasa la burbuja o la
 * descarta, hasta ahora no tenía ninguna forma dentro del producto de enterarse
 * de que debía, y el día 25 se le suspendía el negocio. Avisar por un canal que
 * se puede perder y después cortarle la caja por no haber reaccionado es
 * exactamente lo que rompe una relación con alguien que quizás sólo no vio una
 * notificación.
 *
 * Va en el SHELL y no en el dashboard: el dueño puede pasar el día entero en la
 * caja o en Productos, y un aviso que sólo vive en una pantalla que no visita
 * no avisa nada.
 *
 * SÓLO LO VE EL DUEÑO. `mi_suscripcion` (063) devuelve `no_corresponde` para
 * cualquiera que no sea owner del negocio: que un cajero se entere de que su
 * jefe debe la suscripción es humillante para el cliente.
 *
 * Se apaga solo al pagar — el estado se deriva de los pagos asentados, no de un
 * flag que alguien tenga que acordarse de bajar.
 */
export async function AvisoSuscripcion() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("mi_suscripcion");

  const sub = (data ?? { estado: "al_dia" }) as MiSuscripcion;
  if (sub.estado !== "debe") return null;

  /* Le falta menos de un mes: no es un moroso, es una diferencia — puede ser una
     comisión bancaria o un monto mal cargado de nuestro lado. El tono cambia y
     no se le menciona ninguna suspensión, porque tampoco se lo va a cortar
     (061: el corte exige deber al menos un mes completo). */
  const esDiferencia = sub.parcial && sub.meses_impagos === 1;

  return (
    <div
      role="status"
      className={
        esDiferencia
          ? "border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning-ink lg:px-8 print:hidden"
          : "border-b border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger-ink lg:px-8 print:hidden"
      }
    >
      <div className="mx-auto flex max-w-5xl items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0">
          {esDiferencia ? (
            <>
              Quedaron <span className="font-semibold">{pesos(sub.deuda)}</span> pendientes de
              tu suscripción. Si ya los mandaste, avisanos y lo cargamos.
            </>
          ) : (
            <>
              Tenés <span className="font-semibold">{pesos(sub.deuda)}</span> de suscripción sin
              registrar
              {sub.meses_impagos > 1 && ` (${sub.meses_impagos} meses)`}.{" "}
              {/* La fecha explícita es más respetuosa que una amenaza vaga, y
                  además es accionable: entra en la agenda. */}
              El servicio se suspende el{" "}
              <span className="font-semibold">{fechaLarga(sub.suspende_el)}</span>. Si ya
              pagaste, escribinos y lo resolvemos.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
