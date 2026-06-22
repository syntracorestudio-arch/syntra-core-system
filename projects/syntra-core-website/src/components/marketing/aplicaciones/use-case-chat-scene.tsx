"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Mic, Phone, Video } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";

/**
 * UseCaseChatScene — escena image-led reutilizable de Casos (VISUAL-RESET-004).
 * Protagonista: el ASSET premium del rubro (next/image), limpio y completo.
 * Apoyo: un chat WhatsApp real (header = el CONTACTO que consulta) donde el
 * asistente virtual responde y cierra con un resultado HECHO (badge cyan).
 *
 * Config-driven: el mismo componente sirve a Inmobiliarias, Estudios jurídicos
 * y futuros rubros, cambiando `config`. Desktop: asset a la izquierda + chat
 * separado a la derecha (sin superponer). Mobile: asset arriba + chat abajo.
 * Motion: la conversación se SIMULA en loop (demo viva) — burbujas en orden →
 * badge → pausa → reinicio suave. El loop sólo corre en viewport
 * (IntersectionObserver). reduced-motion → conversación completa estática, sin
 * loop. cyan SOLO en el badge final.
 */

interface ChatMsg {
  /** "client" = contacto que consulta (izquierda, blanco); "assistant" = asistente (derecha, verde). */
  from: "client" | "assistant";
  text: string;
  time: string;
}

export interface UseCaseChatSceneConfig {
  asset: { src: string; width: number; height: number; alt: string };
  /** Contacto del header del chat (la persona que consulta). */
  client: { name: string; avatar: string };
  /** Etiqueta sutil sobre la primera respuesta automática (ej. "Clara · asistente virtual"). */
  assistantLabel: string;
  messages: ChatMsg[];
  /** Texto del badge HECHO (resultado final). */
  badge: string;
  /**
   * Clases de ancho del asset (override por rubro). Útil cuando un asset cuadrado
   * necesita un poco más de presencia que el portrait por defecto. Debe entrar al
   * lado del chat sin apretar el texto. Default: `max-w-[23rem] lg:w-[24.5rem]`.
   */
  assetWidthClass?: string;
}

const STEP_MS = 1300;
const PAUSE_MS = 2600;

function UseCaseChatScene({
  config,
  reduce: reduceProp,
}: {
  config: UseCaseChatSceneConfig;
  reduce?: boolean;
}) {
  const { asset, client, assistantLabel, messages, badge, assetWidthClass } = config;
  const firstAssistant = messages.findIndex((m) => m.from === "assistant");
  const totalSteps = messages.length + 1; // +1 = badge HECHO

  const reducedHook = useReducedMotion();
  const reduce = reduceProp ?? reducedHook ?? false;

  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);
  const [count, setCount] = React.useState(0);

  // Pausar el loop fuera del viewport (performance + no distraer).
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.3,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Loop de la conversación (demo viva). Sólo corre en viewport y sin
  // reduced-motion. Los setState viven dentro del timer (nunca síncronos en el
  // effect). reduced-motion → estado final derivado en render, sin loop.
  React.useEffect(() => {
    if (reduce || !inView) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      setCount(i);
      i = i < totalSteps ? i + 1 : 0;
      timer = setTimeout(tick, i === 0 ? PAUSE_MS : STEP_MS);
    };
    timer = setTimeout(tick, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce, inView, totalSteps]);

  // Conteo efectivo: reduced-motion muestra la conversación completa.
  const shownCount = reduce ? totalSteps : count;

  const sceneReveal: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0 : DURATION.section, ease: EASE_PREMIUM },
    },
  };

  const badgeShown = shownCount >= totalSteps;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Foco cálido compartido detrás del grupo (une asset + chat como una sola
          escena, no dos objetos sueltos). No azul. */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -z-10 h-[115%] w-[135%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(231,200,160,0.16),transparent_66%)] blur-2xl"
      />

      <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center lg:justify-center lg:gap-5">
        {/* Protagonista: asset del rubro, limpio y completo */}
        <motion.div
          variants={sceneReveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className={cn(
            "w-full shrink-0 overflow-hidden rounded-3xl shadow-[0_54px_116px_-32px_rgba(0,0,0,0.82)] ring-1 ring-black/10",
            assetWidthClass ?? "max-w-[23rem] lg:w-[24.5rem]",
          )}
        >
          <Image
            src={asset.src}
            width={asset.width}
            height={asset.height}
            alt={asset.alt}
            sizes="(max-width: 1024px) 90vw, 392px"
            className="h-auto w-full"
          />
        </motion.div>

        {/* Apoyo: chat WhatsApp real, separado (no tapa el asset) */}
        <motion.div
          variants={sceneReveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="w-full max-w-[15rem] shrink-0 sm:max-w-[15rem] lg:w-[15rem]"
        >
          <div className="overflow-hidden rounded-[1.4rem] shadow-[0_40px_80px_-30px_rgba(8,12,18,0.75)] ring-1 ring-black/10">
            {/* Header WhatsApp (verde oscuro sobrio): el CONTACTO que consulta */}
            <div className="flex items-center gap-2.5 bg-[#0e4c44] px-3 py-2 text-white">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d8a07a] to-[#b56a47] text-[13px] font-semibold">
                {client.avatar}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] font-semibold">{client.name}</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-200/90">
                  <span className="size-1.5 rounded-full bg-emerald-300" /> en línea
                </span>
              </span>
              <span className="ml-auto flex items-center gap-3 text-white/70">
                <Video className="size-3.5" aria-hidden="true" />
                <Phone className="size-3.5" aria-hidden="true" />
              </span>
            </div>

            {/* Cuerpo del chat (beige WhatsApp + patrón muy sutil) */}
            <div className="relative bg-[#e9e2d8] px-2.5 py-2.5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(rgba(40,30,15,0.6)_1px,transparent_1px)] [background-size:14px_14px]"
              />
              <div className="relative flex flex-col gap-1">
                {messages.map((m, i) => {
                  const isAssistant = m.from === "assistant";
                  const shown = i < shownCount;
                  return (
                    <React.Fragment key={i}>
                      {isAssistant && i === firstAssistant ? (
                        <motion.span
                          initial={false}
                          animate={{ opacity: shown ? 1 : 0 }}
                          transition={{ duration: reduce ? 0 : 0.3, ease: EASE_PREMIUM }}
                          className="mt-0.5 self-end text-[9px] tracking-wide text-stone-500"
                        >
                          {assistantLabel}
                        </motion.span>
                      ) : null}
                      <motion.div
                        initial={false}
                        animate={shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM }}
                        className={
                          isAssistant
                            ? "max-w-[88%] self-end rounded-xl rounded-tr-sm bg-[#d6f5cc] px-2.5 py-1 shadow-sm"
                            : "max-w-[88%] self-start rounded-xl rounded-tl-sm bg-white px-2.5 py-1 shadow-sm"
                        }
                      >
                        <span
                          className={
                            isAssistant
                              ? "block text-[11px] leading-snug text-[#1f2c1a]"
                              : "block text-[11px] leading-snug text-stone-800"
                          }
                        >
                          {m.text}
                        </span>
                        <span className="mt-0.5 block text-right text-[8px] text-stone-500/80">
                          {m.time}
                        </span>
                      </motion.div>
                    </React.Fragment>
                  );
                })}

                {/* Cierre HECHO: chip de sistema centrado (cyan = único uso) */}
                <motion.span
                  initial={false}
                  animate={badgeShown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: reduce ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
                  className="mt-1.5 self-center"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-white px-3 py-1 text-center text-[10.5px] font-medium text-[#0e7f93] shadow-sm">
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-cyan/15">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                    {badge}
                  </span>
                </motion.span>
              </div>
            </div>

            {/* Barra de input (estática, realismo WhatsApp) */}
            <div className="flex items-center gap-2 bg-[#f0ece4] px-2.5 py-1.5">
              <span className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-stone-400">
                Escribí un mensaje
              </span>
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0e4c44] text-white">
                <Mic className="size-3.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export { UseCaseChatScene };
