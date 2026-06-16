"use client";

import * as React from "react";
import { Check } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { SceneFrame, SceneAtmosphere } from "./scene-frame";

/**
 * ServiceDemoChat — escena premium (WEB-009F-E). Hermana de Web/Automatización:
 * mismo chasis (`SceneFrame`), misma atmósfera (`SceneAtmosphere`), misma firma
 * de resultado (tarjeta-resultado flotante cyan + badge de honestidad). Identidad
 * propia: una CONVERSACIÓN multi-turno donde la IA es el ASISTENTE DEL NEGOCIO DEL
 * CLIENTE (una clínica) atendiendo a un PACIENTE: presenta info del negocio, ofrece
 * un turno y estructura la solicitud para que el EQUIPO confirme el horario (asistente
 * de atención útil, nunca diagnóstico/decisión). Web = lo público; Automatización =
 * lo interno; IA = la atención. Paleta SYNTRA (slate / brand-electric / brand-cyan,
 * regla 90/10).
 *
 * Tres planos Z:
 *  1. Fondo atmosférico compartido (`SceneAtmosphere`).
 *  2. Panel de chat: cabecera "En línea ahora" (dot verde del sistema) + un
 *     "replay de chat" — 4 burbujas paciente (izq) / IA (der) que entran en
 *     secuencia, con UN typing one-shot justo antes de la respuesta-valor (msg 2),
 *     y una tarjeta-resumen INLINE (solicitud de turno) tras el msg 4.
 *  3. Tarjeta-resultado flotante (Raycast, hermana): "Consulta lista para el
 *     equipo", revela al final y PERSISTE (HECHO).
 *
 * Conversación de 4 mensajes, una sola versión sin responsive hiding (todas las
 * burbujas `flex` siempre visibles): paciente pregunta → IA presenta y ofrece turno
 * → paciente acepta → IA encamina la solicitud al equipo. Sin shift por breakpoint.
 *
 * Motion (live-system-motion-spec): PENDIENTE → ACTIVO → HECHO, reveal en secuencia,
 * one-shot por viewport (useInView once + useReducedMotion). Solo opacity/transform
 * (translate/scale) — NUNCA box-shadow/filter/width/height/color/background. El
 * typing (único loop) vive solo durante su ventana y se DESMONTA al responder: no
 * hay loop tras el estado final. Hover de profundidad sutil (desktop fine-pointer)
 * vía motion values; off en touch y reduced-motion. reduced-motion → conversación
 * final completa directa (4 burbujas + tarjeta), sin typing/reveal/hover. CLS = 0:
 * el slot del swap typing→respuesta tiene min-h. Decorativo: aria-hidden.
 */

/* Timing de la secuencia (s). El typing gobierna la aparición de la respuesta-valor.
   Orden perceptible: msg1 → typing → msg2 (valor) → msg3 → msg4 → tarjeta-resumen
   inline → tarjeta-resultado flotante. */
const T_BG = 0; // fondo revela primero
const T_PANEL = 0.18; // el panel sube después
const STAGGER = 0.4; // separación entre burbujas (replay de chat vivo)
const T_MSG1 = 0.32; // PACIENTE: consulta de primera visita (entra tras el panel)
const T_MSG3 = 0.18; // PACIENTE: acepta buscar turno (tras la respuesta-valor)
const T_MSG4 = T_MSG3 + STAGGER; // IA: encamina la solicitud de turno
const T_SUMMARY = T_MSG4 + 0.18; // tarjeta-resumen inline (justo después del msg4)
const T_CARD = T_SUMMARY + STAGGER; // tarjeta-resultado flotante revela al final y QUEDA

/* Disparo del typing tras el mensaje 1 (su entrada + un beat de "escritura"). */
const TYPING_START_MS = (T_PANEL + T_MSG1) * 1000 + 400;
const TYPING_DURATION_MS = 1100;

function ServiceDemoChat() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  // Dos fases del replay, marcadas async (dentro de setTimeout) para no llamar
  // setState síncrono dentro del effect (react-hooks/set-state-in-effect):
  //  · `typing`    → el indicador de escritura aparece tras el mensaje 1.
  //  · `responded` → el typing se DESMONTA y se revela la respuesta-valor (msg 2),
  //                  luego los mensajes 3-4 y la tarjeta-resultado.
  const [typing, setTyping] = React.useState(false);
  const [responded, setResponded] = React.useState(false);

  React.useEffect(() => {
    if (reduce || !inView || responded) return;
    const tType = window.setTimeout(() => setTyping(true), TYPING_START_MS);
    const tDone = window.setTimeout(() => {
      setTyping(false);
      setResponded(true);
    }, TYPING_START_MS + TYPING_DURATION_MS);
    return () => {
      window.clearTimeout(tType);
      window.clearTimeout(tDone);
    };
  }, [reduce, inView, responded]);

  // Derivado: con reduced-motion todo se muestra directo (sin typing/secuencia).
  const showResponse = reduce || responded;
  const showTyping = !reduce && typing && !responded;
  // La tarjeta-resultado aparece una vez que la conversación ya respondió.
  const showResult = reduce || responded;

  // ── Hover de profundidad (desktop fine-pointer). Mismos resortes que las
  // escenas hermanas → la fila de Servicios se lee como un solo sistema.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.4 });
  const bgX = useTransform(sx, [-0.5, 0.5], [-3, 3]);
  const bgY = useTransform(sy, [-0.5, 0.5], [-3, 3]);
  const panelX = useTransform(sx, [-0.5, 0.5], [8, -8]);
  const panelY = useTransform(sy, [-0.5, 0.5], [8, -8]);
  const cardX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const cardY = useTransform(sy, [-0.5, 0.5], [16, -16]);

  const hoverEnabled = !reduce;

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!hoverEnabled || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handlePointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative"
    >
      {/* Wrapper relativo SIN overflow: deja flotar la tarjeta-resultado fuera del
          panel sin recortarse (el SceneFrame sí recorta su atmósfera). */}
      <div className="relative">
        <SceneFrame
          background={
            // ── Plano 1: fondo atmosférico compartido (detrás). Revela por opacity.
            <motion.div
              aria-hidden="true"
              className="absolute inset-0"
              style={hoverEnabled ? { x: bgX, y: bgY } : undefined}
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce || inView ? { opacity: 1 } : { opacity: 0 }}
              transition={{
                duration: reduce ? 0 : DURATION.hero,
                delay: reduce ? 0 : T_BG,
                ease: EASE_PREMIUM,
              }}
            >
              <SceneAtmosphere />
            </motion.div>
          }
        >
          {/* ── Plano 2: panel de chat (mid). Sube con opacity+y. */}
          <motion.div
            className="relative"
            style={hoverEnabled ? { x: panelX, y: panelY } : undefined}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={reduce || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
            transition={{
              duration: reduce ? 0 : DURATION.hero,
              delay: reduce ? 0 : T_PANEL,
              ease: EASE_PREMIUM,
            }}
          >
            <div className="rounded-xl border border-border bg-surface-1">
              {/* Cabecera estilo chrome: estado online del sistema (verde, no cyan) */}
              <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
                <span className="sys-status-dot size-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-muted-foreground">
                  En línea ahora
                </span>
              </div>

              {/* Cuerpo de la conversación (replay de chat de 4 mensajes, sin
                  responsive hiding: todas las burbujas siempre visibles). pb extra
                  (banda inferior, idéntica a la escena Automatización) para que la
                  tarjeta-resultado flotante solape borde vacío, no el último msg. */}
              <div className="flex flex-col gap-4 p-5 pb-12 sm:p-6 sm:pb-14">
                {/* 1 · PACIENTE: consulta de primera visita (izquierda, siempre visible) */}
                <motion.div
                  className="flex max-w-[80%] flex-col self-start rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={
                    reduce || inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                  }
                  transition={{
                    duration: reduce ? 0 : DURATION.standard,
                    delay: reduce ? 0 : T_PANEL + T_MSG1,
                    ease: EASE_PREMIUM,
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    Hola, ¿atienden consultas particulares? ¿Cómo es la primera
                    visita?
                  </p>
                </motion.div>

                {/* Slot del swap typing → respuesta-valor (mensaje 2). Alto
                    reservado para la respuesta más larga (hasta ~6 líneas a 360px)
                    → el swap typing→respuesta no empuja el layout (CLS 0). Más
                    holgado en sm+ donde el texto wrapea en menos líneas. */}
                <div className="flex min-h-[9rem] flex-col sm:min-h-[6.5rem]">
                  {/* Typing dots: ÚNICO loop, vive solo durante su ventana y se
                      DESMONTA al responder (sin loop tras el estado final). */}
                  <AnimatePresence>
                    {showTyping ? (
                      <motion.div
                        key="typing"
                        className="flex max-w-[80%] items-center gap-1.5 self-end rounded-2xl rounded-br-sm border border-brand-electric/40 bg-surface-2 px-3.5 py-3.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="size-2 rounded-full bg-muted-foreground"
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

                  {/* 2 · IA respuesta-valor (derecha, FIRMA cyan). Entra al
                      desmontarse el typing; siempre visible. */}
                  {showResponse ? (
                    <motion.div
                      className="max-w-[80%] self-end rounded-2xl rounded-br-sm border border-brand-cyan/30 bg-surface-2 px-3.5 py-2.5"
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduce ? 0 : DURATION.standard,
                        ease: EASE_PREMIUM,
                      }}
                    >
                      <p className="text-sm text-foreground">
                        Hola. Sí, atendemos particulares. La primera consulta es una
                        evaluación general de unos 40 minutos. ¿Querés que te busque
                        un turno?
                      </p>
                    </motion.div>
                  ) : null}
                </div>

                {/* 3 · PACIENTE: acepta buscar turno (izquierda) */}
                <motion.div
                  className="flex max-w-[80%] flex-col self-start rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={
                    showResponse ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                  }
                  transition={{
                    duration: reduce ? 0 : DURATION.standard,
                    delay: reduce ? 0 : T_MSG3,
                    ease: EASE_PREMIUM,
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    Sí, algo esta semana a la tarde.
                  </p>
                </motion.div>

                {/* 4 · IA: encamina la solicitud de turno (derecha, borde neutro: 90/10) */}
                <motion.div
                  className="flex max-w-[80%] flex-col self-end rounded-2xl rounded-br-sm border border-border bg-surface-2 px-3.5 py-2.5"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={
                    showResponse ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                  }
                  transition={{
                    duration: reduce ? 0 : DURATION.standard,
                    delay: reduce ? 0 : T_MSG4,
                    ease: EASE_PREMIUM,
                  }}
                >
                  <p className="text-sm text-foreground">
                    Listo. Te dejo la solicitud de turno para que el equipo confirme
                    el horario.
                  </p>
                </motion.div>

                {/* Tarjeta-resumen INLINE: la IA estructura la solicitud de turno.
                    SIEMPRE montada (revela por opacity → alto reservado, CLS 0).
                    "Card" no "bubble", neutra (sin cyan: el cyan se reserva para el
                    cierre flotante = 90/10), sin sombras/swatch/badge. self-end. */}
                <motion.div
                  className="mt-2 max-w-[80%] self-end rounded-xl border border-border bg-surface-2 px-3.5 py-3"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={
                    showResponse ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                  }
                  transition={{
                    duration: reduce ? 0 : DURATION.standard,
                    delay: reduce ? 0 : T_SUMMARY,
                    ease: EASE_PREMIUM,
                  }}
                >
                  <p className="font-accent text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                    Solicitud de turno
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-foreground">
                    Primera consulta
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta semana, a la tarde
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </SceneFrame>

        {/* ── Plano 3: tarjeta-resultado flotante (front, Raycast). Hermana de las
            de Web/Automatización (misma firma cyan/glass). Revela al final de la
            conversación y QUEDA (HECHO persiste). Slot con alto reservado. */}
        <div className="pointer-events-none absolute right-3 -bottom-3 z-20 flex min-h-[4rem] w-[13.5rem] max-w-[72%] justify-end sm:right-5 sm:-bottom-4 sm:w-[15rem] sm:max-w-[80%] lg:w-[13rem] lg:max-w-[72%]">
          <motion.div
            style={hoverEnabled ? { x: cardX, y: cardY } : undefined}
            initial={reduce ? false : { opacity: 0, y: 20, scale: 0.94 }}
            animate={
              showResult
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 20, scale: 0.94 }
            }
            transition={{
              duration: reduce ? 0 : DURATION.section,
              delay: reduce ? 0 : T_CARD,
              ease: EASE_PREMIUM,
            }}
            className="surface-glass w-full rounded-xl border border-brand-cyan/40 bg-surface-2/90 p-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15">
                <Check className="size-3 text-brand-cyan" aria-hidden="true" />
              </span>
              <span className="font-accent text-[0.7rem] tracking-wide text-brand-cyan">
                Consulta lista para el equipo
              </span>
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              El equipo confirma el horario.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Badge de honestidad (lenguaje de cliente) */}
      <p className="mt-7 text-xs text-muted-foreground">
        Ejemplo · no es un cliente real
      </p>
    </div>
  );
}

export { ServiceDemoChat };
