"use client";

import * as React from "react";
import { ArrowRight, Info } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { EASE_PREMIUM, DURATION } from "@/lib/motion";
import { UseCaseChatScene, type UseCaseChatSceneConfig } from "./use-case-chat-scene";

export interface ApplicationItem {
  id: string;
  /** Nombre del rubro (label de la pill + del rail editorial). */
  title: string;
  /** Ícono ya renderizado en el Server Component (evita pasar funciones). */
  icon: React.ReactNode;
  /** Situación típica del rubro (el dolor — lead editorial del rail). */
  situacion: string;
  /** Sistema que diseñaríamos (tono condicional). */
  sistema: string;
  /** Capacidades / qué incluiría. */
  capacidades: string[];
  /** Frase comercial / promesa del rubro. */
  tagline: string;
  /** Recorrido en lenguaje de cliente (se conserva como arco slim). */
  flow: string[];
}

interface ApplicationSelectorProps {
  items: ApplicationItem[];
  note: string;
  className?: string;
}

/** Arco comercial común (entrada → orden → acción → HECHO), conservado como leyenda slim. */
const ARC = ["Entra", "Se ordena", "Se actúa", "Listo"] as const;

/**
 * Rubros IMAGE-LED (asset premium + chat WhatsApp via UseCaseChatScene). Tener
 * entrada acá define el layout image-led (split editorial + escena de chat) y
 * la columna de texto compacta. Los rubros sin entrada usan el fallback CSS.
 * Contenido ILUSTRATIVO de escena (no config del sitio).
 */
const CHAT_SCENES: Record<string, UseCaseChatSceneConfig> = {
  inmobiliarias: {
    asset: {
      src: "/visual-assets/syntra/use-cases/palermo-property.webp",
      width: 1080,
      height: 1161,
      alt: "Departamento de 2 ambientes en venta en Palermo, Buenos Aires, por USD 95.000, con balcón y mucha luz natural.",
    },
    client: { name: "Laura F.", avatar: "L" },
    assistantLabel: "Ana · asistente virtual",
    messages: [
      { from: "client", text: "Hola, vi el departamento de Palermo. ¿Sigue disponible?", time: "12:31" },
      {
        from: "assistant",
        text: "Sí, sigue disponible. Es un 2 ambientes con balcón y mucha luz natural. ¿Querés coordinar una visita?",
        time: "12:31",
      },
      { from: "client", text: "Buenísimo. ¿Se puede visitar esta semana?", time: "12:32" },
      {
        from: "assistant",
        text: "Sí. Tengo disponible jueves 18:00 o viernes 11:00. ¿Cuál te sirve más?",
        time: "12:32",
      },
      { from: "client", text: "Jueves 18:00 está bien.", time: "12:33" },
      {
        from: "assistant",
        text: "Perfecto. Te dejo la visita agendada para el jueves a las 18:00.",
        time: "12:33",
      },
    ],
    badge: "Visita agendada · Jueves 18:00",
  },
  legal: {
    asset: {
      src: "/visual-assets/syntra/use-cases/estudio-project.webp",
      width: 1080,
      height: 1080,
      alt: "Escritorio de un estudio jurídico con un contrato de alquiler y una consulta registrada en revisión inicial.",
    },
    client: { name: "Martín R.", avatar: "M" },
    assistantLabel: "Clara · asistente virtual",
    // Asset cuadrado → un poco más de ancho SOLO en xl (≥1280) para igualar
    // presencia sin apretar el texto en lg/1024. No toca inmobiliarias.
    assetWidthClass: "max-w-[23.5rem] lg:w-[24.5rem] xl:w-[25.5rem]",
    messages: [
      {
        from: "client",
        text: "Hola, necesito consultar por un contrato de alquiler. ¿Puedo enviarles el caso?",
        time: "10:14",
      },
      {
        from: "assistant",
        text: "Hola Martín, sí. Podés contarme el motivo de la consulta y adjuntar el contrato si lo tenés.",
        time: "10:14",
      },
      { from: "client", text: "Es por una cláusula de renovación que no entiendo.", time: "10:15" },
      {
        from: "assistant",
        text: "Perfecto. Dejé registrada la consulta y la derivé para revisión inicial.",
        time: "10:15",
      },
      { from: "client", text: "Gracias. ¿Me pueden contactar esta semana?", time: "10:16" },
      { from: "assistant", text: "Sí. Te propongo una llamada el jueves a las 17:30.", time: "10:16" },
    ],
    badge: "Consulta registrada · Revisión inicial",
  },
  salud: {
    asset: {
      src: "/visual-assets/syntra/use-cases/medicina-project.webp",
      width: 1080,
      height: 1080,
      alt: "Recepción de una clínica médica cálida y moderna, con una consulta registrada y un turno confirmado.",
    },
    client: { name: "Carolina M.", avatar: "C" },
    assistantLabel: "Sofía · asistente virtual",
    // Asset cuadrado → un poco más de ancho SOLO en xl (≥1280), igual que legal.
    assetWidthClass: "max-w-[23.5rem] lg:w-[24.5rem] xl:w-[25.5rem]",
    messages: [
      {
        from: "client",
        text: "Hola, quisiera sacar un turno de consulta médica. ¿Tienen disponibilidad esta semana?",
        time: "09:12",
      },
      {
        from: "assistant",
        text: "Hola Carolina, sí. Puedo ayudarte. ¿Preferís por la mañana o por la tarde?",
        time: "09:12",
      },
      { from: "client", text: "Por la mañana, si puede ser.", time: "09:13" },
      {
        from: "assistant",
        text: "Tengo disponible martes 10:30 o jueves 9:00. ¿Cuál te sirve más?",
        time: "09:13",
      },
      { from: "client", text: "Martes 10:30 me queda bien.", time: "09:14" },
      {
        from: "assistant",
        text: "Perfecto. Te dejo el turno confirmado para el martes a las 10:30.",
        time: "09:14",
      },
    ],
    badge: "Turno confirmado · Mar 10:30",
  },
  pymes: {
    asset: {
      src: "/visual-assets/syntra/use-cases/ropa-project.webp",
      width: 1080,
      height: 1080,
      alt: "Interior de un local de ropa cálido y moderno, con un pedido registrado y confirmado.",
    },
    client: { name: "Valentina R.", avatar: "V" },
    assistantLabel: "Julieta · asistente virtual",
    // Asset cuadrado → un poco más de ancho SOLO en xl (≥1280), igual que legal/salud.
    assetWidthClass: "max-w-[23.5rem] lg:w-[24.5rem] xl:w-[25.5rem]",
    messages: [
      {
        from: "client",
        text: "Hola, vi el conjunto beige en talle M. ¿Lo tienen disponible?",
        time: "17:42",
      },
      {
        from: "assistant",
        text: "Hola Valentina, sí. Tenemos stock en talle M. ¿Querés que te comparta el precio y te lo reserve?",
        time: "17:42",
      },
      { from: "client", text: "Sí, por favor.", time: "17:43" },
      {
        from: "assistant",
        text: "Perfecto. El conjunto está a $89.000. Si querés, puedo dejarte el pedido armado para retiro o envío.",
        time: "17:43",
      },
      { from: "client", text: "Lo quiero con envío a Córdoba.", time: "17:44" },
      {
        from: "assistant",
        text: "Listo. Te dejo el pedido confirmado y coordinamos el envío.",
        time: "17:44",
      },
    ],
    badge: "Pedido confirmado · Envío a Córdoba",
  },
};

/** Rubros que usan la escena image-led (presencia en CHAT_SCENES). */
const IMAGE_LED_RUBROS = new Set(Object.keys(CHAT_SCENES));

/* ===================================================== Escena del rubro (image-led) */

/**
 * Escena del rubro. Los 4 rubros de Casos son image-led (asset premium + chat
 * WhatsApp + badge HECHO + motion secuencial) via el componente config-driven
 * compartido `UseCaseChatScene`. Se resuelve por presencia en CHAT_SCENES.
 */
function IndustryObjectScene({ id, reduce }: { id: string; reduce: boolean }) {
  const chat = CHAT_SCENES[id];
  if (!chat) return null;
  return <UseCaseChatScene config={chat} reduce={reduce} />;
}

/* ============================================================ Rail editorial (texto) */

function EditorialRail({
  item,
  note,
  compact,
}: {
  item: ApplicationItem;
  note: string;
  /** En la escena image-led, la columna se simplifica (la escena ya muestra el valor). */
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-6 lg:gap-7" : "gap-5")}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{item.icon}</span>
        <span className="font-accent text-xs tracking-widest uppercase">{item.title}</span>
      </div>

      {/* Dolor: lead editorial, gancho de reconocimiento (<3s) */}
      <p
        className={cn(
          "font-heading text-xl leading-snug font-semibold text-foreground text-balance sm:text-2xl",
          compact && "lg:text-[1.8rem] lg:leading-[1.18]",
        )}
      >
        {item.situacion}
      </p>

      {compact ? (
        /* Escena image-led: párrafo de contexto (densidad editorial, no el arco slim) */
        <p className="text-base leading-relaxed text-muted-foreground text-pretty lg:text-[1.05rem] lg:leading-[1.65]">
          {item.sistema}
        </p>
      ) : (
        /* Arco comercial como leyenda slim (no protagonista) */
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] tracking-wide text-muted-foreground/70">
          {ARC.map((stage, i) => {
            const last = i === ARC.length - 1;
            return (
              <React.Fragment key={stage}>
                <span className={last ? "font-medium text-brand-cyan" : undefined}>{stage}</span>
                {!last ? <ArrowRight className="size-3 opacity-60" aria-hidden="true" /> : null}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Promesa del rubro (acento electric) */}
      <p className="border-l-2 border-accent-primary/60 pl-4 text-base leading-snug font-medium text-foreground text-pretty">
        {item.tagline}
      </p>

      {/* Soporte tenue: qué incluiría (se omite en la escena image-led para respirar) */}
      {compact ? null : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="text-muted-foreground/60">Incluiría: </span>
          {item.capacidades.join(" · ")}
        </p>
      )}

      {/* Honestidad */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{note}</span>
      </div>
    </div>
  );
}

/* ============================================================ Selector + split */

/**
 * ApplicationSelector — "Casos por rubro" (VISUAL-RESET, Ruta 2 Editorial Case
 * Card + franja cálida de Ruta 3). Rail de rubros + split asimétrico: rail
 * editorial de texto a un lado, FICHA DE PAPEL off-white del rubro flotando con
 * franja cálida, capas y sello HECHO al otro. Material dominante claro → rompe
 * con el azul. Sin dashboard, sin tabla, sin card azul, sin browser/chat/nodos.
 *
 * Reglas: cyan = señal EXCLUSIVA del sello HECHO. Solo opacity/transform. Al
 * cambiar de rubro el split re-monta (key) y las capas entran (product-layer
 * parallax) cerrando con el sello (active-to-done). reduced-motion → escena final
 * armada, sin float ni reveal. Tokens desde `lib/motion`, sin easing inline.
 */
function ApplicationSelector({ items, note, className }: ApplicationSelectorProps) {
  const reduce = useReducedMotion() ?? false;
  const [activeId, setActiveId] = React.useState(items[0]?.id);
  const handleSelect = React.useCallback((id: string) => {
    track("application_tab_click", { industry: id });
    setActiveId(id);
  }, []);

  const active = items.find((it) => it.id === activeId) ?? items[0];
  if (!active) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Rail: segmented control de rubros (alineado a la izquierda, editorial) */}
      <div className="flex">
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

      {/* Split editorial: alto reservado para no saltar al cambiar de rubro */}
      <div className="relative mt-8 min-h-[34rem] sm:min-h-[28rem] lg:min-h-[24rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            role="tabpanel"
            id={`casos-panel-${active.id}`}
            aria-labelledby={`casos-tab-${active.id}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.micro, ease: EASE_PREMIUM }}
            className={cn(
              "grid gap-12 lg:gap-14",
              IMAGE_LED_RUBROS.has(active.id)
                ? "items-center lg:grid-cols-[0.88fr_1.12fr]"
                : "items-center lg:grid-cols-[1.05fr_0.95fr]",
            )}
          >
            {/* Ficha del rubro (primero en mobile como gancho visual) */}
            <div className="lg:order-2">
              <IndustryObjectScene id={active.id} reduce={reduce} />
            </div>
            {/* Rail editorial de texto */}
            <div className="lg:order-1">
              <EditorialRail
                item={active}
                note={note}
                compact={IMAGE_LED_RUBROS.has(active.id)}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { ApplicationSelector };
