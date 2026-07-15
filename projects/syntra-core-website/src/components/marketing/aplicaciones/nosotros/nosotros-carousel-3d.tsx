"use client";

import * as React from "react";

import { aboutPillars } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { PillarVisual, PILLAR_THEME, type PillarId } from "./pillar-visual";

/**
 * NosotrosCarousel3D — PROTOTIPO (2026-07-13): carrusel cilíndrico 3D vertical
 * de los 4 principios, adaptado de la referencia externa que trajo el owner
 * (bank-cards cylinder carousel) al lenguaje SYNTRA:
 *
 *  - Sin videos externos ni paleta ajena: cada card usa el TEMA de su principio
 *    (PILLAR_THEME) sobre vidrio oscuro de la casa; dorso decorativo con el
 *    ghost-word gigante.
 *  - Scroll circular continuo con "dwell" magnético al frente (easing pow 4.2
 *    de la referencia), espesor volumétrico real (5 slices), tilt 3D por mouse
 *    con inercia — todo vía rAF mutando transforms por ref (60fps, cero
 *    re-renders; mutaciones SOLO dentro del loop → React Compiler safe).
 *  - Disciplina SYNTRA: el rAF corre SOLO con la sección en viewport
 *    (IntersectionObserver); el tilt se mide contra el STAGE (no window);
 *    en mobile/reduced-motion este componente no se monta (queda el grid).
 */

// Compacto (pulido owner v3): la card a z=400 escalaba ~1.42x y se CORTABA
// contra el stage; menos Z de frente + card más chica = todo en cuadro.
const CARD_W = 440;
const CARD_H = 372;
const COUNT = aboutPillars.length; // 4
const D = 1350; // perspectiva
const GAP = 32;
const PEEK = -55;

const PILLAR_ICONS: Record<string, ReturnType<typeof getIcon>> = {
  postura: getIcon("Blocks"),
  criterio: getIcon("SlidersHorizontal"),
  cercania: getIcon("MessagesSquare"),
  compromiso: getIcon("Route"),
};

/* Slices de espesor volumétrico (±1.47px, como la referencia). */
const THICKNESS = [-1.47, -0.73, 0, 0.73, 1.47];

type MutState = {
  progress: number;
  mouse: { x: number; y: number; targetX: number; targetY: number };
  running: boolean;
  /** true con el mouse sobre el stage → el carrusel se FRENA (el tilt sigue). */
  hover: boolean;
  /** Índice frontal del último frame (para disparar onFront solo al cambiar). */
  lastFront: number;
  /** Drag activo (click + arrastre vertical pasa las cards a mano). */
  dragging: boolean;
  dragLastY: number;
  /** Objetivo del drag: el progress lo PERSIGUE con inercia (drag suave). */
  dragTarget: number;
  /** Imán post-drag: al soltar, el progress se asienta en la card más cercana. */
  snapTarget: number | null;
  /** Velocidad efectiva (0..1): rampa suave al frenar/arrancar por hover. */
  speed: number;
  /** Mezcla de easing (1 = magnético pow4.2 · 0 = lineal 1:1 para el drag). */
  easeMix: number;
};

/* El estado imperativo del loop vive en un objeto estable (ref); el loop y los
 * listeners lo mutan — nunca el render. */
function makeMutState(): MutState {
  return {
    // Arranca al INICIO del dwell de la card 0 (no a mitad): la primera card
    // también recibe el ciclo completo para su secuencia interna.
    progress: -0.42,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    running: false,
    hover: false,
    lastFront: -1,
    dragging: false,
    dragLastY: 0,
    dragTarget: 0,
    snapTarget: null,
    speed: 1,
    easeMix: 1,
  };
}

/** Duración REAL de un ciclo por card, en segundos (independiente del refresh
 *  rate del monitor — el bug raíz del ritmo: a 0.0007/frame un monitor 144Hz
 *  corría el ciclo 2.4× más rápido que uno de 60Hz y pisaba la animación
 *  interna, que sí va en segundos).
 *
 *  TIMELINE MEDIDO (v5): ventana frontal = 0.784·CYCLE_S (del fin del fade-in
 *  en diff −0.459 al inicio de salida en diff +0.325). Historia interna más
 *  larga = ~5.0s. Con CYCLE_S=11 → ventana 8.6s = historia completa (5.0s) +
 *  beat de lectura (~3.6s) → el pase arranca APENAS termina la animación. */
const CYCLE_S = 5.5;

function step(
  s: MutState,
  cards: Array<HTMLDivElement | null>,
  hairs: Array<HTMLDivElement | null>,
  stageH: number,
  dtMs: number,
  onFront: (idx: number) => void,
) {
  // TIME-BASED: avanza por tiempo real (dt), no por frame. Ciclo = CYCLE_S
  // exactos en cualquier monitor. Pausado con el mouse encima; durante el drag
  // el usuario mueve el progress a mano; al soltar, el IMÁN lo asienta en la
  // card más cercana (sin esto quedaría congelado a mitad de transición).
  const dt = Math.min(dtMs, 64) / 1000; // clamp: tab switch no salta cards
  if (s.dragging) {
    // Drag SUAVE: el progress persigue al dedo con inercia (sin esto las cards
    // saltaban bruscas por la zona rápida del easing pow 4.2).
    s.progress += (s.dragTarget - s.progress) * (1 - Math.pow(0.86, dtMs / 16.67));
  } else {
    // Freno/arranque con RAMPA (~400ms): el hard-stop del hover generaba un
    // frenazo brusco. La velocidad desliza hacia 0 (hover) o 1 (libre).
    const targetSpeed = s.hover ? 0 : 1;
    s.speed += (targetSpeed - s.speed) * (1 - Math.pow(0.9, dtMs / 16.67));
    s.progress += (dt / CYCLE_S) * s.speed;
    // Imán (post-drag o freno a mitad de vuelo): completa hasta el reposo.
    if (s.snapTarget !== null) {
      const d = s.snapTarget - s.progress;
      if (Math.abs(d) < 0.002) {
        s.progress = s.snapTarget;
        s.snapTarget = null;
      } else {
        s.progress += d * (1 - Math.pow(0.88, dtMs / 16.67));
      }
    }
  }
  // Damping del tilt normalizado a dt (misma inercia a cualquier fps).
  const k = 1 - Math.pow(0.92, dtMs / 16.67);
  s.mouse.x += (s.mouse.targetX - s.mouse.x) * k;
  s.mouse.y += (s.mouse.targetY - s.mouse.y) * k;

  const rounded = Math.round(s.progress);
  const diff = s.progress - rounded;
  // Dwell magnético: pausa breve al frente, aceleración entre cards. Durante el
  // DRAG el mapeo se vuelve LINEAL 1:1 (blend suave): con el magnético, mover el
  // progress a mano hacía atravesar la zona rápida a latigazo (feedback owner).
  const mixTarget = s.dragging ? 0 : 1;
  s.easeMix += (mixTarget - s.easeMix) * (1 - Math.pow(0.9, dtMs / 16.67));
  const eased = Math.sign(diff) * Math.pow(Math.abs(diff) * 2, 4.2) / 2;
  const active = rounded + eased * s.easeMix + diff * (1 - s.easeMix);

  // Card frontal: notifica al completarse el fade-in (|diff| < 0.46 — MEDIDO:
  // la card entrante alcanza opacity 1 en diff ≈ -0.459 con el easing pow 4.2).
  // Con el umbral anterior (0.3) la secuencia arrancaba ~4.8s tarde: la card
  // quedaba visible y muerta casi 5 segundos antes de actuar.
  const front = ((rounded % COUNT) + COUNT) % COUNT;
  if (front !== s.lastFront && Math.abs(diff) < 0.46) {
    s.lastFront = front;
    onFront(front);
  }

  // Hairline de progreso del dwell (imperativo, transform-only): se llena
  // durante el ciclo de la card frontal y se CONGELA en hover (el progress no
  // avanza). frac ∈ [0,1) dentro del ciclo actual.
  const frac = s.progress - rounded + 0.5;
  for (let i = 0; i < COUNT; i++) {
    const hair = hairs[i];
    if (hair) hair.style.transform = `scaleX(${i === front ? frac.toFixed(4) : 0})`;
  }

  for (let i = 0; i < COUNT; i++) {
    const card = cards[i];
    if (!card) continue;

    let offset = i - active;
    const half = COUNT / 2;
    while (offset > half) offset -= COUNT;
    while (offset < -half) offset += COUNT;

    const abs = Math.abs(offset);
    const sign = Math.sign(offset);

    // DISOLUCIÓN temprana (pulido owner v2): en reposo SOLO se ve la card del
    // frente — la vecina queda invisible antes de asomar (fade completo a 0.85
    // de offset). Durante la transición ambas se cruzan en un crossfade suave.
    const fade = abs <= 0.35 ? 1 : Math.max(0, 1 - (abs - 0.35) / 0.5);
    if (abs > 0.9) {
      card.style.visibility = "hidden";
      continue;
    }
    card.style.visibility = "visible";
    card.style.opacity = fade.toFixed(3);

    let y = 0;
    let z = 0;
    let rot = 0;

    if (abs <= 1) {
      const t = abs;
      const e = t * t * (3 - 2 * t);
      y = -sign * (e * (CARD_H + GAP));
      z = 300 + e * (160 - 300);
      rot = e * 132;
    } else if (abs <= 2) {
      const t = abs - 1;
      const e = t * t * (3 - 2 * t);
      const zEnd = -60;
      const sEnd = D / (D - zEnd);
      const yEnd = (stageH / 2 - PEEK) / sEnd - CARD_H / 2;
      y = -sign * (CARD_H + GAP + e * (yEnd - (CARD_H + GAP)));
      z = 160 + e * (zEnd - 160);
      rot = 132 + e * (175 - 132);
    } else {
      const t = Math.min(abs - 2, 1);
      const e = t * t * (3 - 2 * t);
      const s2 = D / (D + 60);
      const y2 = (stageH / 2 - PEEK) / s2 - CARD_H / 2;
      const s3 = D / (D + 250);
      const y3 = (stageH / 2 + 100) / s3 + CARD_H / 2;
      y = -sign * (y2 + e * (y3 - y2));
      z = -60 + e * (-250 - -60);
      rot = 175 + e * (195 - 175);
    }

    const centerFactor = Math.max(0, 1 - abs);
    const tiltX = -s.mouse.y * 12 * centerFactor;
    const tiltY = s.mouse.x * 15 * centerFactor;
    const totalRotX = -sign * rot + tiltX;

    card.style.zIndex = String(Math.round(z));
    card.style.transform = `translateY(${y.toFixed(2)}px) translateZ(${z.toFixed(2)}px) rotateX(${totalRotX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotateZ(-2deg)`;
  }
}

function NosotrosCarousel3D() {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const cardsRef = React.useRef<Array<HTMLDivElement | null>>([]);
  const hairsRef = React.useRef<Array<HTMLDivElement | null>>([]);
  const mutRef = React.useRef<MutState | null>(null);
  if (mutRef.current === null) mutRef.current = makeMutState();

  // Card frontal + ciclo de llegada: 1 re-render cada ~16s. `cycle` remonta el
  // artefacto de la card que LLEGA al frente → su secuencia re-actúa cada vez.
  const [front, setFront] = React.useState({ idx: 0, cycle: 0 });
  const onFront = React.useCallback((idx: number) => {
    setFront((p) => ({ idx, cycle: p.cycle + 1 }));
  }, []);

  React.useEffect(() => {
    const stage = stageRef.current;
    const s = mutRef.current;
    if (!stage || !s) return;

    let frame = 0;
    let lastT = 0;
    const loop = (t: number) => {
      const dtMs = lastT === 0 ? 16.7 : t - lastT;
      lastT = t;
      step(s, cardsRef.current, hairsRef.current, stage.clientHeight, dtMs, onFront);
      frame = requestAnimationFrame(loop);
    };

    // El loop corre SOLO con el stage en viewport (batería/CPU).
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        if (visible && !s.running) {
          s.running = true;
          lastT = 0; // reset del dt: no saltar el tiempo pasado fuera de viewport
          frame = requestAnimationFrame(loop);
        } else if (!visible && s.running) {
          s.running = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(stage);

    // Tilt relativo al STAGE (no a window): fuera del stage vuelve al centro.
    const onMove = (e: MouseEvent) => {
      const r = stage.getBoundingClientRect();
      const rx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ry = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      s.mouse.targetX = Math.max(-1, Math.min(1, rx));
      s.mouse.targetY = Math.max(-1, Math.min(1, ry));
    };
    // Freno por hover (pedido owner): mouse encima → el loop se pausa y podés
    // leer la card con el tilt vivo; al salir, continúa donde estaba.
    const onEnter = () => {
      s.hover = true;
      // Si el freno agarra a la card EN PLENO VUELO, la transición se completa
      // sola hasta el reposo más cercano (antes quedaba clavada a mitad de giro).
      const r = Math.round(s.progress);
      if (Math.abs(s.progress - r) > 0.32) s.snapTarget = r;
    };
    const onLeave = () => {
      s.hover = false;
      s.snapTarget = null;
      s.mouse.targetX = 0;
      s.mouse.targetY = 0;
    };
    // DRAG (pedido owner): click + arrastre vertical pasa las cards a mano
    // (el contenido sigue al cursor; ~340px = una card). Al soltar, imán a la
    // card más cercana. Pointer capture → el drag no se corta al salir del stage.
    const DRAG_PX = 340;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      s.dragging = true;
      s.dragLastY = e.clientY;
      s.dragTarget = s.progress;
      s.snapTarget = null;
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* pointer sintético/inválido: el drag funciona igual sin captura */
      }
      stage.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!s.dragging) return;
      const dy = e.clientY - s.dragLastY;
      s.dragLastY = e.clientY;
      s.dragTarget += dy / DRAG_PX;
    };
    const endDrag = (e: PointerEvent) => {
      if (!s.dragging) return;
      s.dragging = false;
      s.snapTarget = Math.round(s.dragTarget);
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      stage.style.cursor = "";
    };
    stage.addEventListener("mouseenter", onEnter);
    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    return () => {
      io.disconnect();
      stage.removeEventListener("mouseenter", onEnter);
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", endDrag);
      stage.removeEventListener("pointercancel", endDrag);
      if (s.running) {
        s.running = false;
        cancelAnimationFrame(frame);
      }
    };
  }, [onFront]);

  return (
    <div
      ref={stageRef}
      className="relative hidden h-[540px] cursor-grab touch-none items-center justify-center overflow-hidden select-none lg:flex"
      style={{ perspective: `${D}px` }}
    >
      <div
        className="absolute"
        style={{
          width: CARD_W,
          height: CARD_H,
          transformStyle: "preserve-3d",
        }}
      >
        {aboutPillars.map((pillar, i) => {
          const theme = PILLAR_THEME[pillar.id as PillarId];
          const Icon = PILLAR_ICONS[pillar.id] ?? PILLAR_ICONS.postura;
          return (
            <div
              key={pillar.id}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              className="absolute inset-0"
              style={{
                width: CARD_W,
                height: CARD_H,
                transformStyle: "preserve-3d",
                backfaceVisibility: "visible",
              }}
            >
              {THICKNESS.map((zOff, layerIdx) => {
                const isFront = layerIdx === THICKNESS.length - 1;
                const isBack = layerIdx === 0;

                // Slices estructurales: el canto del "vidrio"
                if (!isFront && !isBack) {
                  return (
                    <div
                      key={layerIdx}
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-[#3a4356]"
                      style={{
                        backgroundColor: "#2a3242",
                        transform: `translateZ(${zOff}px)`,
                      }}
                    />
                  );
                }

                if (isFront) {
                  return (
                    <div
                      key={layerIdx}
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-white/15"
                      style={{
                        backgroundColor: "#0b1120",
                        transform: `translateZ(${zOff}px)`,
                        backfaceVisibility: "hidden",
                        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.14)",
                      }}
                    >
                      {/* Fondo del tema del principio (vidrio oscuro + aurora propia) */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(120% 130% at 82% -10%, rgba(${theme?.rgb},0.28), transparent 55%), radial-gradient(100% 100% at 15% 110%, rgba(${theme?.rgb},0.12), transparent 60%), linear-gradient(160deg, #10182a 0%, #0b1120 60%)`,
                        }}
                      />
                      {/* Hairline superior del tema */}
                      <div
                        className="absolute inset-x-0 top-0 h-px"
                        style={{
                          background: `linear-gradient(90deg, transparent, rgba(${theme?.rgb},0.65), transparent)`,
                        }}
                      />
                      <div className="relative flex h-full flex-col p-5 text-left">
                        <div className="flex items-center gap-3">
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-xl border bg-gradient-to-b from-surface-2/90 to-surface-1/60"
                            style={{
                              color: theme?.hex,
                              borderColor: `rgba(${theme?.rgb},0.35)`,
                              boxShadow: `inset 0 1px 0 rgba(248,250,252,0.08), 0 0 22px -6px rgba(${theme?.rgb},0.55)`,
                            }}
                          >
                            <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
                          </span>
                          <span className="font-accent text-[0.65rem] font-medium tracking-[0.22em] uppercase text-muted-foreground">
                            {pillar.ghost}
                          </span>
                          <span className="ml-auto font-accent text-[0.6rem] tracking-[0.2em] text-foreground/40 tabular-nums">
                            0{i + 1} / 0{COUNT}
                          </span>
                        </div>
                        <h3 className="mt-3 font-heading text-[1.25rem] font-semibold tracking-tight text-foreground">
                          {pillar.title}
                        </h3>
                        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                          {pillar.description}
                        </p>
                        {/* Pull-quote del principio (copy owner) */}
                        {pillar.stance ? (
                          <p
                            className="mt-2.5 border-l-2 pl-3 text-xs leading-snug"
                            style={{
                              borderColor: `rgba(${theme?.rgb},0.55)`,
                              color: `rgba(${theme?.rgb},0.9)`,
                            }}
                          >
                            {pillar.stance}
                          </p>
                        ) : null}
                        {/* Artefacto que ACTÚA en cada llegada al frente: `cycle`
                            remonta el visual → la secuencia corre de cero. */}
                        <PillarVisual
                          key={front.idx === i ? front.cycle : -1}
                          id={pillar.id}
                          isFront={front.idx === i}
                        />
                        {/* Firma de marca al pie */}
                        <div className="mt-auto flex items-center pt-2">
                          <span className="font-accent text-[0.55rem] tracking-[0.24em] uppercase text-foreground/30">
                            SYNTRA CORE
                          </span>
                        </div>
                      </div>
                      {/* Hairline de progreso del dwell (imperativo desde el loop;
                          se congela con el freno por hover) */}
                      <div
                        aria-hidden="true"
                        ref={(el) => {
                          hairsRef.current[i] = el;
                        }}
                        className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
                        style={{
                          background: `linear-gradient(90deg, rgba(${theme?.rgb},0.75), rgba(${theme?.rgb},0.15))`,
                          transform: "scaleX(0)",
                        }}
                      />
                    </div>
                  );
                }

                // Dorso: decorativo — ghost-word gigante sobre el tema difuminado
                return (
                  <div
                    key={layerIdx}
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-white/15"
                    style={{
                      backgroundColor: "#0b1120",
                      transform: `translateZ(${zOff}px) rotateX(180deg)`,
                      backfaceVisibility: "hidden",
                      boxShadow: "inset 0 1px 1px rgba(255,255,255,0.14)",
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(140% 140% at 50% 50%, rgba(${theme?.rgb},0.22), transparent 70%), linear-gradient(200deg, #101828 0%, #0b1120 70%)`,
                        filter: "blur(2px)",
                      }}
                    />
                    <div className="absolute inset-x-0 top-5 h-8 bg-black/60 backdrop-blur-md" />
                    <div className="relative grid h-full place-items-center">
                      <span
                        className="font-heading text-4xl font-bold tracking-[0.18em] uppercase"
                        style={{ color: `rgba(${theme?.rgb},0.5)` }}
                      >
                        {pillar.ghost}
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-6 font-accent text-[0.6rem] tracking-[0.22em] uppercase text-foreground/45">
                      SYNTRA CORE
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { NosotrosCarousel3D };
export default NosotrosCarousel3D;
