"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * ServiceDemoChat — mini chat: la consulta entra y recibe respuesta (PENDIENTE →
 * ACTIVO → HECHO, live-system-motion-spec). Secuencia one-shot al entrar en
 * viewport (sin loop infinito): la consulta ENTRA (opacity + y) → typing dots
 * (~1.2s) → respuesta (opacity + y) → "Respuesta enviada" (HECHO persistente).
 * Luego queda estático. Los typing dots solo existen durante la ventana del one-shot.
 * Solo se anima opacity/transform (translateY) — NUNCA box-shadow/filter.
 * useReducedMotion → estado final directo (consulta + respuesta + status, sin typing).
 * Texto genérico ilustrativo, sin nombres ni datos inventados. aria-hidden.
 */
function ServiceDemoChat() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  // "respondido" se marca async (dentro del setTimeout) para no llamar setState
  // de forma síncrona dentro del effect (react-hooks/set-state-in-effect).
  const [responded, setResponded] = React.useState(false);

  React.useEffect(() => {
    if (reduce || !inView || responded) return;
    const t = window.setTimeout(() => setResponded(true), 1200);
    return () => window.clearTimeout(t);
  }, [reduce, inView, responded]);

  // Derivado: con reduced-motion la respuesta se muestra directa (sin typing).
  const showResponse = reduce || responded;
  const showTyping = !reduce && inView && !responded;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="rounded-xl border border-border bg-depth-sunken p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4">
        {/* Cabecera: estado online */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-muted-foreground">En línea ahora</span>
        </div>

        {/* Consulta entrante (izquierda): ENTRA con opacity + y al viewport
            (igual que la respuesta). reduced-motion → directa, sin animación. */}
        <motion.div
          className="max-w-[80%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
        >
          <p className="text-sm text-muted-foreground">
            Hola, ¿atienden los fines de semana?
          </p>
        </motion.div>

        {/* Slot de respuesta con alto reservado (evita reflujo typing→respuesta) */}
        <div className="flex min-h-[5.5rem] flex-col">
        {/* Typing dots: solo durante la ventana del one-shot (no loop perpetuo) */}
        <AnimatePresence>
          {showTyping ? (
            <motion.div
              key="typing"
              className="flex max-w-[80%] items-center gap-1 self-end rounded-2xl rounded-br-sm border border-border bg-surface-2 px-3.5 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1,
                    ease: EASE_PREMIUM,
                    delay: i * 0.18,
                  }}
                />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Respuesta lista (derecha, acento sutil) — entra tras el typing */}
        {showResponse ? (
          <motion.div
            className="max-w-[80%] self-end rounded-2xl rounded-br-sm border border-brand-cyan/30 bg-surface-2 px-3.5 py-2.5"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
          >
            <p className="text-sm text-foreground">
              Sí, respondemos a cualquier hora. ¿En qué te puedo ayudar?
            </p>
            <motion.span
              className="mt-1.5 flex items-center justify-end gap-1 text-xs text-accent-secondary"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduce ? 0 : DURATION.micro,
                ease: EASE_PREMIUM,
                delay: reduce ? 0 : DURATION.standard,
              }}
            >
              <Check className="size-3" />
              Respuesta enviada
            </motion.span>
          </motion.div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

export { ServiceDemoChat };
