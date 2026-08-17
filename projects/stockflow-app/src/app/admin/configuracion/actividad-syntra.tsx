import { ShieldCheck } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ETIQUETA_ACCION, type AccionPlataforma } from "@/lib/auditoria";

/**
 * "Actividad de SYNTRA en tu negocio" — la mitad que convierte la bitácora en
 * soporte y no en puerta trasera.
 *
 * Una auditoría que sólo ve quien la escribe no es una auditoría, es un diario.
 * Acá el dueño lee, con fecha y motivo, cada cosa que hicimos sobre su negocio:
 * si le suspendimos el acceso por falta de pago, se entera leyendo esto y no
 * porque un martes a la mañana no le abra la caja.
 *
 * La RLS hace el recorte (055 · `auth_has_role(target_store, ['owner'])`), así
 * que esta consulta NO filtra por negocio: no puede traer las filas de otro
 * aunque se lo pidiéramos. El gate está en la base, no en este archivo.
 */
export async function ActividadSyntra() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("platform_audit")
    .select("id, action, reason, created_at, actor_email")
    // Cota dura: esto es "qué pasó últimamente", no el archivo histórico.
    .order("created_at", { ascending: false })
    .limit(20);

  const filas = (data ?? []) as {
    id: string;
    action: string;
    reason: string;
    created_at: string;
    actor_email: string;
  }[];

  /* Sin filas no se muestra nada. Un "todavía no hicimos nada" es ruido para el
     99% de los dueños, que nunca van a tener una intervención — y peor: instala
     la idea de que podríamos. */
  if (filas.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="font-semibold">Actividad de SYNTRA en tu negocio</h2>
      </div>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Todo lo que hacemos sobre tu cuenta queda registrado acá, con el motivo.
      </p>

      <ul className="divide-y divide-border">
        {filas.map((f) => (
          <li key={f.id} className="py-3">
            <p className="text-sm font-medium">
              {ETIQUETA_ACCION[f.action as AccionPlataforma] ?? f.action}
            </p>
            {/* El motivo ES el dato: sin él, "suspendimos tu negocio" es una
                notificación, no una explicación. Por eso la base lo exige. */}
            <p className="mt-0.5 text-sm text-muted-foreground">{f.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(f.created_at).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {f.actor_email}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
