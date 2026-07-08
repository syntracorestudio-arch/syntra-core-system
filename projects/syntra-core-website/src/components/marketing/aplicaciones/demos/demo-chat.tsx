"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, Mic, Phone, Plus, Smile, Video } from "lucide-react";

import { serviceDemos, serviceDemoScenes } from "@/config/site";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { useDemoLoop } from "./use-demo-loop";
import { DoneChip, DEMO_ACCENT } from "./demo-shared";

/**
 * DemoChat — WHATSAPP REAL (pedido owner 2026-07-08: que parezca la app de
 * verdad, no una card azul de la web). Paleta oficial de WhatsApp dark:
 * fondo #0b141a · header/burbujas entrantes #202c33 · salientes #005c4b ·
 * verde de marca #00a884 · ticks leídos #53bdeb · tiempos #8696a0.
 * Conversación realista de "Talleres del Sur" (hilo Julián P., content-driven
 * en serviceDemoScenes.asistente). El chip HECHO va FUERA del teléfono (capa
 * SYNTRA de presentación — dentro rompería el realismo).
 *
 * Guion largo (6 mensajes, tienda de ropa) con FOTO+CAPTION en burbuja (como
 * WhatsApp real). Pasos: 0 consulta · 1 escribiendo · 2 foto+precio ·
 * 3-5 envío/reserva · 6 confirmación · 7 (final) HECHO.
 */

const ACCENT = DEMO_ACCENT.asistente;
const SCENE = serviceDemoScenes.asistente;
const DONE = serviceDemos[1].done;
const STEPS = 7;

/** Paso a partir del cual cada mensaje del guion es visible (typing = paso 1). */
const MESSAGE_AT = [0, 2, 3, 4, 5, 6] as const;

/** Ticks de WhatsApp: gris = enviado, azul = leído. */
function Ticks({ read }: { read: boolean }) {
  return (
    <span className="relative ml-0.5 inline-flex" aria-hidden="true">
      <Check
        className="size-3"
        strokeWidth={2.4}
        style={{ color: read ? "#53bdeb" : "#8696a0" }}
      />
      <Check
        className="-ml-[7px] size-3"
        strokeWidth={2.4}
        style={{ color: read ? "#53bdeb" : "#8696a0" }}
      />
    </span>
  );
}

function DemoChat({ reduce }: { reduce: boolean }) {
  const { ref, step } = useDemoLoop({ steps: STEPS, stepMs: 1050, pauseMs: 3200, reduce });

  const typing = step === 1;
  const doneShown = step >= STEPS;

  // El hilo usa flex-col-reverse (mensajes en DOM del más nuevo al más viejo):
  // el navegador ancla solo el FINAL de la conversación — el último mensaje
  // queda siempre visible junto a la barra y el excedente se recorta arriba,
  // como WhatsApp real. Cero JS de medición (los observers/transform probados
  // perdían frames en dev).

  return (
    <div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[18.5rem]">
      {/* Halo warm detrás del marco (capa de presentación SYNTRA) */}
      <div
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] blur-2xl"
        style={{ background: `radial-gradient(55% 50% at 50% 40%, rgba(${ACCENT.rgb},0.3), transparent 72%)` }}
      />

      {/* Bezel del teléfono */}
      <div className="relative rounded-[2.4rem] border border-white/12 bg-[#05080b] p-2 shadow-[0_50px_110px_-34px_rgba(0,0,0,0.9)]">
        <div className="absolute top-2 left-1/2 z-10 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-[#05080b]" />

        <div className="overflow-hidden rounded-[1.9rem] bg-[#0b141a]">
          {/* Header WhatsApp real */}
          <div className="flex items-center gap-2.5 bg-[#202c33] px-3 pt-5 pb-2.5">
            <span className="relative size-8 shrink-0 overflow-hidden rounded-full">
              <Image
                src="/demo-assets/tienda-hero.jpg"
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[12.5px] font-semibold text-[#e9edef]">
                {SCENE.business}
              </span>
              <span className="text-[9.5px] text-[#8696a0]">{SCENE.status}</span>
            </span>
            <span className="ml-auto flex items-center gap-4 text-[#8696a0]">
              <Video className="size-4" aria-hidden="true" />
              <Phone className="size-3.5" aria-hidden="true" />
            </span>
          </div>

          {/* Cuerpo del chat (doodle sutil como el wallpaper real).
              Teléfono COMPACTO + conversación que FLUYE (decisión de diseño
              2026-07-08): los mensajes se montan de verdad (no ocupan espacio
              ocultos) y arrancan ARRIBA como en WhatsApp real; cuando la
              conversación supera la pantalla, queda visible el FINAL (reserva
              + link de pago = el cierre de la venta). Sin huecos fantasma. */}
          <div className="relative flex h-[24rem] flex-col bg-[#0b141a] px-2.5 py-2.5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(rgba(134,150,160,0.9)_1px,transparent_1px)] [background-size:14px_14px]"
            />

            {/* Hilo del chat en col-reverse: el DOM va del mensaje más nuevo al
                más viejo — el final queda anclado junto a la barra y lo que no
                entra se recorta arriba (comportamiento WhatsApp, solo CSS) */}
            <div className="relative flex flex-1 flex-col-reverse gap-[5px] overflow-hidden">
              {/* "escribiendo…" (primero en DOM = abajo en pantalla) */}
              {typing && !reduce ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
                  className="flex w-fit items-center gap-1 self-start rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2.5"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-1.5 rounded-full bg-[#8696a0]"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
                    />
                  ))}
                </motion.div>
              ) : null}

              {[...SCENE.chat].reverse().map((m, ri) => {
                const i = SCENE.chat.length - 1 - ri;
                const shown = step >= (MESSAGE_AT[i] ?? 0);
                if (!shown) return null;
                const isClient = m.from === "client";
                return (
                  <motion.div
                    key={m.text}
                    initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM }}
                    className={
                      isClient
                        ? "max-w-[85%] self-end rounded-lg rounded-tr-none bg-[#005c4b] px-2.5 py-1.5"
                        : "max-w-[85%] self-start rounded-lg rounded-tl-none bg-[#202c33] px-2.5 py-1.5"
                    }
                  >
                    {"image" in m && m.image ? (
                      <span className="relative mb-1 block h-20 w-44 overflow-hidden rounded-md">
                        <Image src={m.image} alt="" fill sizes="176px" className="object-cover" />
                      </span>
                    ) : null}
                    <span className="block text-[12px] leading-snug text-[#e9edef]">
                      {m.text}
                    </span>
                    <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[8.5px] text-[#8696a0]">
                      {m.time}
                      {isClient ? <Ticks read={shown && step >= 2} /> : null}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Barra de entrada real (estática) */}
            <div className="relative mt-2 flex items-center gap-1.5">
              <div className="flex flex-1 items-center gap-2 rounded-full bg-[#202c33] px-3 py-2 text-[#8696a0]">
                <Smile className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-[11px]">Mensaje</span>
                <Plus className="size-4 shrink-0" aria-hidden="true" />
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#00a884] text-white">
                <Mic className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HECHO — fuera del teléfono (capa SYNTRA, no rompe el realismo) */}
      <div className="mt-4 flex justify-center">
        <DoneChip label={DONE} shown={doneShown} reduce={reduce} />
      </div>
    </div>
  );
}

export { DemoChat };
