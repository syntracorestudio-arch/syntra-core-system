import { Check } from "lucide-react";

/**
 * ServiceDemoChat — mini chat estático en estado "respuesta lista".
 * Server Component, sin estado ni animación (el typing es WEB-009B).
 * Burbuja entrante neutra (izquierda) + respuesta con acento cyan (derecha).
 * Texto genérico ilustrativo, sin nombres ni datos inventados. aria-hidden.
 */
function ServiceDemoChat() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        {/* Cabecera: estado online */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-muted-foreground">En línea ahora</span>
        </div>

        {/* Consulta entrante (izquierda) */}
        <div className="max-w-[80%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5">
          <p className="text-sm text-muted-foreground">
            Hola, ¿atienden los fines de semana?
          </p>
        </div>

        {/* Respuesta lista (derecha, acento sutil) */}
        <div className="max-w-[80%] self-end rounded-2xl rounded-br-sm border border-brand-cyan/30 bg-surface-2 px-3.5 py-2.5">
          <p className="text-sm text-foreground">
            Sí, respondemos a cualquier hora. ¿En qué te puedo ayudar?
          </p>
          <span className="mt-1.5 flex items-center justify-end gap-1 text-xs text-accent-secondary">
            <Check className="size-3" />
            Respuesta enviada
          </span>
        </div>
      </div>
    </div>
  );
}

export { ServiceDemoChat };
