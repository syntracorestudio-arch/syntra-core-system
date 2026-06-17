"use client";

import * as React from "react";
import { Activity, Check, FileText, Info, MessageCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";

export interface ApplicationItem {
  id: string;
  /** Nombre del rubro (label de la pill + encabezado del panel). */
  title: string;
  /** Ícono ya renderizado en el Server Component (evita pasar funciones). */
  icon: React.ReactNode;
  /** Situación típica del rubro (el dolor — gancho de reconocimiento). */
  situacion: string;
  /** Sistema que diseñaríamos (tono condicional). */
  sistema: string;
  /** Capacidades / qué incluiría. */
  capacidades: string[];
  /** Frase comercial / promesa del rubro — cierre del arco. */
  tagline: string;
  /** Recorrido vivo: 4 pasos en lenguaje de cliente; el último es el resultado (HECHO). */
  flow: string[];
}

interface ApplicationSelectorProps {
  items: ApplicationItem[];
  note: string;
  className?: string;
}

/** Delay acumulado por paso del recorrido (reusa DURATION.standard, sin número nuevo). */
const STEP_DELAY = DURATION.standard;

/**
 * Íconos del recorrido por TIPO de paso (entrada → orden → acción), iguales para
 * todos los rubros (el 4º paso, HECHO, usa Check). Lucide, monocromos (muted);
 * el cyan queda reservado al HECHO. MessageCircle reusa el lenguaje del Hero.
 */
const STEP_ICONS = [MessageCircle, FileText, Activity] as const;

/**
 * ApplicationSelector — "Scenario Rail": segmented control de rubros + escenario
 * que se EJECUTA al seleccionarlo (WEB-011C). Disparo por CLIC: al cambiar de
 * rubro el panel re-monta (key) y el recorrido corre PENDIENTE → ACTIVO → HECHO,
 * un paso por vez (delays acumulados). Cada paso es un NODO con masa (chip), no
 * un punto; el 4º paso es la TARJETA-RESULTADO (cyan + check + "Listo") que
 * persiste como clímax.
 *
 * Reglas: el cyan es señal EXCLUSIVA de HECHO (no decora rubro/labels/checks).
 * Solo se anima opacity/transform — nunca width/height/box-shadow/filter.
 * reduced-motion → estado final completo (4 nodos, 4º en HECHO), sin ejecución.
 * Client island mínima: solo el rubro activo. Sin loop/timers/listeners globales.
 * Tokens desde `lib/motion` (EASE_PREMIUM/DURATION), sin easing inline.
 */
function ApplicationSelector({ items, note, className }: ApplicationSelectorProps) {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = React.useState(items[0]?.id);
  const handleSelect = React.useCallback((id: string) => {
    track("application_tab_click", { industry: id });
    setActiveId(id);
  }, []);

  const active = items.find((it) => it.id === activeId) ?? items[0];

  if (!active) return null;

  const lastIndex = active.flow.length - 1;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* === Rail: segmented control contenido (disparador del recorrido) === */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Rubros de aplicación"
          className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-depth-sunken p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const isActive = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`casos-tab-${item.id}`}
                aria-selected={isActive}
                aria-controls={`casos-panel-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40",
                  isActive
                    ? "bg-surface-1 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Ícono del rubro: neutro (el cyan se reserva para HECHO) */}
                <span
                  className={cn(
                    "shrink-0 transition-colors duration-200",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.icon}
                </span>
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* === Panel del escenario activo ===
          Alto reservado en el contenedor PADRE persistente (no en el motion.div que
          re-monta) → sin colapso ni salto al cambiar de rubro con mode="wait". */}
      <div className="mt-6 flex min-h-[31rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 sm:min-h-[28rem] lg:min-h-[26rem]">
        {/* Hairline de acento superior (electric, NO cyan) */}
        <div
          aria-hidden="true"
          className="h-0.5 w-full shrink-0 bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent"
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            role="tabpanel"
            id={`casos-panel-${active.id}`}
            aria-labelledby={`casos-tab-${active.id}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM }}
            className="flex flex-1 flex-col p-6 sm:p-8"
          >
            {/* Header: rubro (ícono neutro) + dolor en la misma unidad */}
            <div className="flex flex-col gap-4 border-b border-border pb-6">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{active.icon}</span>
                <h3 className="font-heading text-xl font-semibold tracking-tight">
                  {active.title}
                </h3>
              </div>
              {/* Dolor: gancho de reconocimiento (<3s) */}
              <p className="text-base leading-relaxed text-foreground text-pretty">
                {active.situacion}
              </p>
            </div>

            {/* El recorrido vivo — escena protagonista en plano recesado.
                clic → cada nodo se enciende uno por vez → 4º nodo = tarjeta HECHO. */}
            <div className="mt-6 rounded-xl border border-border bg-depth-sunken p-5 sm:p-7">
              <p className="font-accent text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">
                El recorrido de tu consulta
              </p>

              <div className="relative mt-7">
                {/* Track desktop: línea sutil detrás de los nodos, al centro del marcador */}
                <div
                  aria-hidden="true"
                  className="absolute top-6 right-8 left-8 hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent lg:block"
                />

                <div className="flex flex-col gap-0 lg:flex-row lg:items-start lg:gap-3">
                  {active.flow.map((step, i) => {
                    const isLast = i === lastIndex;
                    const delay = reduce ? 0 : i * STEP_DELAY;
                    const StepIcon = STEP_ICONS[i];
                    return (
                      <React.Fragment key={step}>
                        {/* Paso: entra atenuado (PENDIENTE) y sube a 1 cuando le toca */}
                        <motion.div
                          className="relative z-10 flex items-start gap-3 lg:flex-1 lg:flex-col lg:items-center lg:gap-3 lg:text-center"
                          initial={reduce ? false : { opacity: 0.35 }}
                          animate={{ opacity: 1 }}
                          transition={{
                            duration: reduce ? 0 : DURATION.standard,
                            delay,
                            ease: EASE_PREMIUM,
                          }}
                        >
                          {/* Marcador-nodo (chip con masa, no dot) */}
                          {isLast ? (
                            <motion.span
                              className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-brand-cyan/45 bg-brand-cyan/10 text-brand-cyan"
                              initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                duration: reduce ? 0 : DURATION.standard,
                                delay,
                                ease: EASE_PREMIUM,
                              }}
                            >
                              <Check className="size-5" aria-hidden="true" />
                            </motion.span>
                          ) : (
                            <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border-strong bg-surface-2">
                              {/* ACTIVO: pulso electric one-shot (solo opacity), un paso por vez */}
                              {!reduce ? (
                                <motion.span
                                  aria-hidden="true"
                                  className="absolute inset-0 rounded-2xl border border-brand-electric/60 bg-brand-electric/15"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: [0, 0.85, 0] }}
                                  transition={{
                                    duration: DURATION.standard,
                                    delay,
                                    ease: EASE_PREMIUM,
                                  }}
                                />
                              ) : null}
                              {StepIcon ? (
                                <StepIcon
                                  className="size-5 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              ) : (
                                <span className="font-accent text-xs text-muted-foreground">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                              )}
                            </span>
                          )}

                          {/* Texto del paso: HECHO en tarjeta con masa (contenida al ancho de columna) */}
                          {isLast ? (
                            <span className="inline-flex flex-col gap-1 rounded-xl border border-brand-cyan/30 bg-brand-cyan/[0.06] px-3 py-2.5 lg:w-full lg:max-w-[12rem] lg:items-center">
                              <span className="font-accent text-[10px] tracking-[0.2em] text-brand-cyan uppercase">
                                Listo
                              </span>
                              <span className="text-sm font-medium leading-snug text-foreground text-balance">
                                {step}
                              </span>
                            </span>
                          ) : (
                            <span className="pt-2.5 text-sm leading-snug text-muted-foreground text-balance lg:max-w-[12rem] lg:pt-0">
                              {step}
                            </span>
                          )}
                        </motion.div>

                        {/* Conector mobile (vertical) entre nodos */}
                        {!isLast ? (
                          <span
                            aria-hidden="true"
                            className="ml-[23px] h-5 w-px shrink-0 bg-border-strong lg:hidden"
                          />
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tagline — conclusión editorial del arco (foreground, NO cyan; acento electric) */}
            <p className="mt-6 border-l-2 border-accent-primary/60 pl-4 text-lg font-medium leading-snug text-foreground text-balance">
              {active.tagline}
            </p>

            {/* Soporte tenue: lo que diseñaríamos + qué incluiría como línea de apoyo (no ficha) */}
            <div className="mt-6 flex flex-col gap-1.5 border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
              <p>{active.sistema}</p>
              <p className="text-muted-foreground/80">
                <span className="text-muted-foreground/60">Incluiría: </span>
                {active.capacidades.join(" · ")}
              </p>
            </div>

            {/* Footer de honestidad (último, tenue) */}
            <div className="mt-auto flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{note}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { ApplicationSelector };
