import type { CSSProperties } from "react";
import { Check } from "lucide-react";

import {
  siteConfig,
  solutionNodes,
  solutionArchitectureNote,
  solutionCanvasLabel,
  solutionCanvasStatus,
  solutionOutputLabel,
} from "@/config/site";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/shared/section-heading";
import { BlurReveal } from "@/components/animations/blur-reveal";
import { FadeIn } from "@/components/animations/fade-in";

/**
 * SolutionArchitectureSection — Live Automation Canvas (TASK-005 + 005B).
 *
 * Canvas enmarcado tipo "SYNTRA OS": barra de header + grid técnico + flujo de
 * nodos-módulo (Cliente → Web → CRM → Automatización → IA → Reporte) + barra
 * inferior de sistema. Los nodos se diferencian por rol (input/proceso/ia/output)
 * con acentos sutiles; el nodo final emite un cue de resultado al cierre del loop.
 * Flujo LINEAL (no copia el lienzo libre de n8n). Motion CSS reutilizado de
 * TASK-004 (loop de 7s, sin libs). prefers-reduced-motion → estático. Server Component.
 */

/** Rol funcional de cada nodo del flujo (deriva acentos, no estructura). */
const NODE_ROLE: Record<string, "input" | "proceso" | "ia" | "output"> = {
  cliente: "input",
  web: "proceso",
  crm: "proceso",
  automatizacion: "proceso",
  ia: "ia",
  reporte: "output",
};

/** Micro-tag de rol (mono, solo desktop). Sprint 01: deja de renderizar en blanco. */
const ROLE_TAG: Record<string, string> = {
  input: "IN",
  proceso: "PROC",
  ia: "IA",
  output: "OUT",
};

/** Acento del chip de ícono por rol (border + bg + text, sin pelear el loop de borde del nodo).
    Sprint 01: el nodo IA pasa a violeta (accent-ai = IA/profundidad), diferenciándolo
    del cyan de sistema; output sigue en electric (acción/resultado). */
const ICON_CHIP_ROLE: Record<string, string> = {
  input: "border-border-strong bg-surface-2 text-foreground",
  proceso: "border-border-strong bg-surface-2 text-muted-foreground",
  ia: "border-accent-ai/40 bg-accent-ai/10 text-accent-ai",
  output: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
};

function SolutionArchitectureSection() {
  const { eyebrow, title, subtitle } = siteConfig.sections.solutionArchitecture;

  return (
    <Section id="sistema" className="bg-depth-raised">
      <BlurReveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      </BlurReveal>

      <FadeIn delay={0.15} className="mt-8">
        {/* === Canvas enmarcado (ventana de sistema) === */}
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-depth-sunken">
          {/* Grid técnico de fondo (CSS puro, opacidad muy baja) */}
          <div className="sys-canvas-grid pointer-events-none absolute inset-0" aria-hidden="true" />

          {/* Header de sistema mínimo */}
          <div className="relative flex items-center gap-2 border-b border-border px-5 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
            </span>
            <span className="ml-2 font-mono text-xs tracking-wide text-muted-foreground">
              {solutionCanvasLabel}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span className="sys-status-dot size-2 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
                En línea
              </span>
            </span>
          </div>

          {/* === Flujo de nodos-módulo === */}
          <ol className="sys-flow relative flex flex-col items-stretch gap-4 px-6 py-8 md:flex-row md:items-stretch md:gap-0 md:py-10">
            {solutionNodes.map((node, i) => {
              const Icon = getIcon(node.icon);
              const isLast = i === solutionNodes.length - 1;
              const role = NODE_ROLE[node.id] ?? "proceso";
              return (
                <li
                  key={node.id}
                  className="flex w-full flex-col items-center gap-4 md:w-auto md:flex-1 md:flex-row md:items-stretch md:gap-0"
                >
                  {/* Nodo-módulo */}
                  <div
                    tabIndex={0}
                    style={{ "--i": i } as CSSProperties}
                    className="sys-node relative flex w-full flex-col gap-3 rounded-2xl border border-border-strong bg-surface-1 p-4 text-left outline-none transition-colors md:h-full md:w-auto md:flex-1"
                  >
                    {/* Header del módulo: ícono (acento por rol) + tag de rol + dot de actividad */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex size-10 items-center justify-center rounded-xl border ${ICON_CHIP_ROLE[role]}`}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 md:inline">
                          {ROLE_TAG[role]}
                        </span>
                        <span
                          className="sys-node-dot size-2 rounded-full bg-border-strong"
                          aria-hidden="true"
                        />
                      </span>
                    </div>

                    {/* Label + microestado */}
                    <div className="flex flex-col gap-0.5">
                      <span className="font-heading text-sm font-semibold tracking-tight">
                        {node.label}
                      </span>
                      <span className="font-accent text-[11px] tracking-widest text-brand-cyan uppercase">
                        {node.caption}
                      </span>
                    </div>

                    {/* Cue de resultado (solo nodo output): enciende al cierre del flujo */}
                    {role === "output" ? (
                      <span
                        style={{ "--i": i } as CSSProperties}
                        className="sys-output-badge mt-auto inline-flex w-fit items-center gap-1 rounded-md border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 font-mono text-[10px] text-accent-primary"
                      >
                        <Check className="size-3" aria-hidden="true" />
                        {solutionOutputLabel}
                      </span>
                    ) : null}
                  </div>

                  {/* Cableado direccional (se ilumina en fase con el loop) */}
                  {!isLast ? (
                    <span
                      style={{ "--i": i } as CSSProperties}
                      aria-hidden="true"
                      className="sys-connector shrink-0 self-center"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* === Barra inferior de sistema === */}
          <div className="relative flex items-center gap-3 border-t border-border px-5 py-2.5 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="sys-status-dot size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              {solutionCanvasStatus.sync}
            </span>
            <span className="hidden items-center sm:inline-flex">
              <span className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-[10px] tracking-wider text-accent-primary uppercase">
                {solutionCanvasStatus.pipeline}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span className="tracking-wide">{solutionCanvasStatus.meta}</span>
              <span className="hidden tracking-wide opacity-50 lg:inline">
                {solutionCanvasStatus.coords}
              </span>
            </span>
          </div>
        </div>

        {/* Nota de honestidad: ejemplo, no caso real */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {solutionArchitectureNote}
        </p>
      </FadeIn>
    </Section>
  );
}

export { SolutionArchitectureSection };
