import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { segmentoValido } from "@/lib/super-path";
import { PanelForm } from "./panel-form";

export const dynamic = "force-dynamic";

/* Que no lo indexe nadie. El 404 del segmento equivocado ya lo mantiene fuera
   de los buscadores, pero si algún día el segmento se filtra en un referer,
   esto evita que además quede publicado. */
export const metadata: Metadata = {
  title: "StockFlow",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Login del panel de plataforma.
 *
 * SE VE DISTINTO DEL LOGIN DE LOS CLIENTES, y no es estética: el error caro de
 * este panel es operar sobre el negocio equivocado, y la primera prevención es
 * que quien entra sepa SIEMPRE en qué sistema está parado. El login del cliente
 * es una pantalla de producto —foto del mostrador, pitch, perks— porque ahí hay
 * algo que vender. Acá no se le vende nada a nadie: es la puerta de servicio.
 *
 * Por eso: sin foto, sin pitch, sin marca StockFlow como protagonista, sin link
 * a ningún lado. Una tarjeta centrada sobre fondo plano y el nombre del sistema
 * al que se entra.
 */
export default async function AccesoPanel({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;

  /* 404 REAL y no un redirect ni un 403: cualquier respuesta que distinga
     "segmento equivocado" de "acá no hay nada" convierte esta ruta en un oráculo
     para adivinar el secreto. Para quien no lo tiene, este archivo no existe. */
  if (!segmentoValido(clave)) notFound();

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
            <ShieldCheck className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Panel de plataforma
            </p>
            <p className="text-xs text-muted-foreground">SYNTRA · StockFlow</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <PanelForm clave={clave} />
        </div>

        {/* Sin "¿no sos vos?", sin link al login de clientes, sin ayuda: cada
            uno de esos textos le confirma algo a quien llegó sin invitación. */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Acceso restringido · SYNTRA
        </p>
      </div>
    </main>
  );
}
