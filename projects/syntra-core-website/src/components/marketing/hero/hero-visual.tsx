"use client";

import {
  Database,
  MessageCircle,
  Send,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";

import { SceneAtmosphere } from "@/components/marketing/servicios/scene-frame";

/**
 * HeroVisual — Synapse Graph como Event Loop Simulator (v3).
 *
 * El grafo simula el sistema ejecutándose: los nodos se ACTIVAN en secuencia
 * narrativa (Contacto → Consulta → IA → Clientes → Acción → reset), un evento por fase,
 * sincronizados con la partícula. Loop de 8s, lento e intencional.
 * Cada glow = un evento del sistema (nada se ilumina decorativamente).
 *
 * Material: glass + estados REST/ACTIVE/FOCUS. ACTIVE se dispara por nodo vía
 * SMIL (begin escalonado) sobre el mismo loop de 8s que recorre la partícula.
 * IA = FOCUS permanente (late siempre, pico en su fase).
 *
 * prefers-reduced-motion → idle estático: glass + IA con glow, sin secuencia,
 * sin partícula, sin pulso. Mobile: 3 fases (Entrada → IA → Acción).
 */

const LOOP = "8s";
const GHOST_LABELS = false; // capa opcional — OFF por defecto (spec §4)

/** Vértices de un hexágono flat-top centrado en (cx,cy) con radio r. */
function hexPoints(cx: number, cy: number, r: number): string {
  const h = r * 0.866;
  return [
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

interface NodeDef {
  id: string;
  label: string;
  ghost: string;
  icon: LucideIcon;
  cx: number;
  cy: number;
  r: number;
  /** Inicio de la fase ACTIVE del nodo dentro del loop (segundos). */
  beginS: number;
  /** Duración de la activación (segundos). */
  activeS: number;
  opacity?: number;
  dominant?: boolean;
}

interface NodeViewProps {
  node: NodeDef;
  iconSize: number;
  animate: boolean;
}

function SynapseNode({ node, iconSize, animate }: NodeViewProps) {
  const Icon = node.icon;
  const labelY = node.cy + node.r + 20;
  // keyTimes del pulso de evento dentro del loop de 8s (in → pico → out).
  const total = 8;
  const kIn = node.beginS / total;
  const kPeak = (node.beginS + node.activeS / 2) / total;
  const kOut = (node.beginS + node.activeS) / total;

  return (
    <g opacity={node.opacity ?? 1}>
      {/* Halo de ACTIVE (glow azul de evento) — solo aparece en la fase del nodo */}
      {animate && !node.dominant ? (
        <circle cx={node.cx} cy={node.cy} r={node.r + 6} fill="var(--accent-primary)" opacity="0">
          <animate
            attributeName="opacity"
            dur={LOOP}
            begin="0s"
            repeatCount="indefinite"
            keyTimes={`0;${kIn};${kPeak};${kOut};1`}
            values={`0;0;0.5;0;0`}
          />
        </circle>
      ) : null}

      {/* Hexágono glass. El cambio de borde en ACTIVE se expresa con un polígono
          superpuesto de borde accent cuya opacidad pulsa en la fase (SMIL no
          interpola var() en 'stroke', por eso se hace por opacity de una capa). */}
      <polygon
        points={hexPoints(node.cx, node.cy, node.r)}
        fill="var(--surface-2)"
        fillOpacity={node.dominant ? 0.55 : 0.35}
        stroke={node.dominant ? "var(--accent-primary)" : "var(--border-strong)"}
        strokeWidth={node.dominant ? 2.5 : 1.5}
        className={node.dominant ? "animate-pulse-slow" : undefined}
        style={
          node.dominant
            ? { transformBox: "fill-box", transformOrigin: "center" }
            : undefined
        }
      />
      {animate && !node.dominant ? (
        <polygon
          points={hexPoints(node.cx, node.cy, node.r)}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="2"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            dur={LOOP}
            begin="0s"
            repeatCount="indefinite"
            keyTimes={`0;${kIn};${kPeak};${kOut};1`}
            values="0;0;1;0;0"
          />
        </polygon>
      ) : null}

      {/* Ícono centrado (lucide vía foreignObject) */}
      <foreignObject
        x={node.cx - iconSize / 2}
        y={node.cy - iconSize / 2}
        width={iconSize}
        height={iconSize}
        style={{ pointerEvents: "none" }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <Icon
            size={iconSize}
            className={node.dominant ? "text-accent-secondary" : "text-muted-foreground"}
            aria-hidden="true"
          />
        </div>
      </foreignObject>

      {/* Label */}
      <text
        x={node.cx}
        y={labelY}
        textAnchor="middle"
        className={node.dominant ? "fill-current text-foreground" : "fill-current text-muted-foreground"}
        style={{ fontSize: 13, fontWeight: node.dominant ? 600 : 400 }}
      >
        {node.label}
      </text>

      {/* Ghost label (OFF por defecto) — texto flotante tenue durante la fase */}
      {animate && GHOST_LABELS ? (
        <text
          x={node.cx}
          y={node.cy - node.r - 10}
          textAnchor="middle"
          className="fill-current text-muted-foreground"
          style={{ fontSize: 10, opacity: 0 }}
        >
          {node.ghost}
          <animate
            attributeName="opacity"
            dur={LOOP}
            begin="0s"
            repeatCount="indefinite"
            keyTimes={`0;${kIn};${kPeak};${kOut};1`}
            values="0;0;0.4;0;0"
          />
        </text>
      ) : null}

      {/* Anillo de pulso del nodo IA (FOCUS permanente) */}
      {node.dominant && animate ? (
        <circle cx={node.cx} cy={node.cy} r={node.r} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
          <animate attributeName="r" values={`${node.r};${node.r * 1.6}`} dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0" dur="3s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </g>
  );
}

/**
 * EdgePulse — pulso que recorre UNA arista durante su fase del loop (8s).
 * Viaja en `travel` segundos desde su `begin`; invisible el resto del ciclo
 * (opacity 0 fuera de fase) → nunca hay dos pulsos visibles a la vez.
 * Usa animateMotion (recorrido) + animate de opacity (aparición por fase).
 */
function EdgePulse({
  path,
  begin,
  r = 5,
  travel = 0.9,
}: {
  path: string;
  begin: string;
  r?: number;
  travel?: number;
}) {
  const b = parseFloat(begin);
  const total = 8;
  const kStart = b / total;
  const kEnd = (b + travel) / total;
  return (
    <circle r={r} fill="var(--accent-primary)" opacity="0">
      {/* animateMotion de 8s (loop completo): quieto en el origen de la arista
          hasta su fase (keyPoint 0), viaja 0→1 durante `travel`, queda al final. */}
      <animateMotion
        dur={LOOP}
        repeatCount="indefinite"
        calcMode="linear"
        path={path}
        keyTimes={`0;${kStart};${kEnd};1`}
        keyPoints="0;0;1;1"
      />
      {/* Visible solo durante su fase (aparece al iniciar el viaje, se va al final) */}
      <animate
        attributeName="opacity"
        dur={LOOP}
        repeatCount="indefinite"
        keyTimes={`0;${kStart};${kStart + 0.001};${kEnd};${kEnd + 0.001};1`}
        values="0;0;1;1;0;0"
      />
    </circle>
  );
}

function HeroVisual() {
  const reduce = useReducedMotion();
  const animate = !reduce;

  // Event loop (tabla §1): begin escalonado, una activación por fase.
  const desktopNodes: NodeDef[] = [
    { id: "node-lead", label: "Contacto", ghost: "Contacto nuevo", icon: UserPlus, cx: 90, cy: 92, r: 30, opacity: 0.85, beginS: 0.0, activeS: 0.7 },
    { id: "node-consulta", label: "Consulta", ghost: "Consulta recibida", icon: MessageCircle, cx: 90, cy: 268, r: 28, opacity: 0.85, beginS: 1.0, activeS: 0.7 },
    { id: "node-ia", label: "IA", ghost: "Procesando intención…", icon: Sparkles, cx: 260, cy: 180, r: 48, dominant: true, beginS: 2.2, activeS: 1.2 },
    { id: "node-crm", label: "Clientes", ghost: "Sumado a tus clientes", icon: Database, cx: 452, cy: 84, r: 32, beginS: 3.8, activeS: 0.7 },
    { id: "node-accion", label: "Acción", ghost: "Acción enviada", icon: Send, cx: 452, cy: 276, r: 30, beginS: 4.8, activeS: 0.7 },
  ];
  const desktopEdges = ["M90,92 L260,180", "M90,268 L260,180", "M260,180 L452,84", "M260,180 L452,276"];

  const mobileNodes: NodeDef[] = [
    { id: "node-entrada", label: "Entrada", ghost: "", icon: UserPlus, cx: 56, cy: 70, r: 24, opacity: 0.85, beginS: 0.0, activeS: 0.8 },
    { id: "node-ia-m", label: "IA", ghost: "", icon: Sparkles, cx: 160, cy: 70, r: 38, dominant: true, beginS: 2.2, activeS: 1.2 },
    { id: "node-accion-m", label: "Acción", ghost: "", icon: Send, cx: 264, cy: 70, r: 26, beginS: 4.8, activeS: 0.8 },
  ];
  const mobileEdges = ["M56,70 L160,70", "M160,70 L264,70"];

  return (
    <div
      role="img"
      aria-label="Cómo trabaja el sistema de SYNTRA: entran un contacto y una consulta, la IA los procesa, y el resultado son tus clientes ordenados y una acción automática."
      className="relative mx-auto w-full max-w-[560px]"
    >
      {/* Chasis premium (inspirado en SceneFrame, WEB-HERO-A): borde + superficie
          hundida + atmósfera estática on-brand → presencia y profundidad. NO lo
          convierte en una escena de Servicios: adentro sigue el grafo = el sistema
          de un vistazo. Un solo foco por viewport (atmósfera + halo de IA del SVG);
          se quitaron los GlowOrbs sueltos que competían. SMIL del grafo intacto. */}
      <div className="relative flex min-h-[12rem] items-center overflow-hidden rounded-2xl border border-border bg-depth-sunken p-4 sm:min-h-[15rem] sm:p-6 lg:min-h-[24rem]">
        <SceneAtmosphere />
        <div className="relative z-10 w-full">
          {/* === Desktop: 5 nodos (desde lg, alineado con el grid de 2 columnas) === */}
          <svg
            viewBox="0 0 540 380"
            className="relative hidden h-auto w-full lg:block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="var(--border-strong)" strokeWidth="1.5">
          {desktopEdges.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Glow de foco permanente del nodo IA */}
        <circle cx="260" cy="180" r="64" fill="var(--accent-primary)" opacity="0.10" />

        {/* Pulsos por arista: un pulso recorre la arista correcta en su fase,
            siempre sobre líneas reales. Entradas convergen en IA (fases 1-2),
            IA diverge a salidas (fases 4-5). Uno visible a la vez. */}
        {animate ? (
          <>
            <EdgePulse path="M90,92 L260,180" begin="0s" />
            <EdgePulse path="M90,268 L260,180" begin="1s" />
            <EdgePulse path="M260,180 L452,84" begin="3.8s" />
            <EdgePulse path="M260,180 L452,276" begin="4.8s" />
          </>
        ) : null}

        {desktopNodes.map((n) => (
          <SynapseNode key={n.id} node={n} iconSize={n.dominant ? 26 : 18} animate={animate} />
        ))}
      </svg>

          {/* === Mobile/tablet: 3 nodos (hasta lg, así no aparece el grafo desktop suelto en tablet) === */}
          <svg
            viewBox="0 0 320 140"
            className="relative mx-auto block h-auto w-full max-w-[420px] lg:hidden"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="var(--border-strong)" strokeWidth="1.5">
          {mobileEdges.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <circle cx="160" cy="70" r="52" fill="var(--accent-primary)" opacity="0.10" />
        {animate ? (
          <>
            <EdgePulse path="M56,70 L160,70" begin="0s" r={4.5} />
            <EdgePulse path="M160,70 L264,70" begin="4.8s" r={4.5} />
          </>
        ) : null}
        {mobileNodes.map((n) => (
          <SynapseNode key={n.id} node={n} iconSize={n.dominant ? 22 : 16} animate={animate} />
        ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

export { HeroVisual };
