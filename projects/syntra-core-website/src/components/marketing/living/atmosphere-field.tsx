"use client";

/**
 * AtmosphereField — CAMPO ESTELAR 3D (R3F) del SectionAtmosphere (2026-07-09). Es la
 * versión "cielo real" de las 2 capas de stardust CSS: un CIELO de puntos con profundidad,
 * twinkle por-partícula y paralaje — NO una pieza cromada abstracta, NO un objeto.
 *
 * Disciplina heredada de contact-field-background (patrón liviano probado): Canvas propio
 * dpr capado, gl antialias:false, SIN postprocesado (additive + toneMapped:false alcanza),
 * frameloop gateado por useInView (always/demand — NUNCA 'never': deja el canvas sin primer
 * frame). Posiciones DETERMINISTAS (mulberry32 seedeado por capa) → estable entre re-mounts,
 * cero Math.random en render (React Compiler safe: refs sólo mutados en useFrame).
 *
 * Este módulo carga three/R3F → se importa SOLO vía dynamic(ssr:false) desde el slot cliente
 * (atmosphere-field-slot). En mobile / reduced-motion NO se monta (quedan los dots CSS).
 *
 * Estrellas blanco-azuladas (#cdd6e4). El TINTE de acento lo aportan los blobs CSS aurora
 * que ya existen: acá NO hay bruma/plane de acento (evitar duplicar luz) — sólo un susurro
 * de acento sesga el color de una MINORÍA de estrellas (aTint) para hermanar el canvas con
 * la sección, sin sumar un segundo foco de brillo. CLS 0 (canvas absolute inset-0).
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useInView, useScroll, type MotionValue } from "framer-motion";
import * as THREE from "three";

type Accent = "electric" | "warm" | "dual";

/* PRNG determinístico (mulberry32) — puro; el cielo queda estable entre re-mounts. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ──────────────────── Capas de profundidad ────────────────────
 * 3 capas (far/mid/near) con z, tamaño y brillo distintos → paralaje real. Cada una es un
 * <points> propio dentro de un <group> (para poder rotar/desplazar la capa entera). Semilla
 * distinta por capa (nubes independientes). Total ~450 puntos. */
type LayerCfg = {
  seed: number;
  count: number;
  ex: number; // half-extent x
  ey: number; // half-extent y
  zMin: number;
  zMax: number;
  sizeMul: number;
  brightness: number;
  rot: number; // rad/s (deriva angular)
  dir: 1 | -1; // sentido (opuesto entre capas → profundidad)
  par: number; // amplitud de paralaje por scroll (world units, ~±4-6% del viewport)
};

const LAYERS: LayerCfg[] = [
  { seed: 0x1a2b3c, count: 200, ex: 13, ey: 9.0, zMin: -9, zMax: -6.0, sizeMul: 0.7, brightness: 0.55, rot: 0.0022, dir: 1, par: 0.14 },
  { seed: 0x3c4d5e, count: 150, ex: 11, ey: 7.5, zMin: -6, zMax: -3.0, sizeMul: 1.0, brightness: 0.78, rot: 0.0036, dir: -1, par: 0.28 },
  { seed: 0x5e6f70, count: 100, ex: 9, ey: 6.0, zMin: -3, zMax: 0.5, sizeMul: 1.45, brightness: 1.0, rot: 0.0052, dir: 1, par: 0.45 },
];

/* Acento: sesgo de color muy leve (sin plane de bruma). dual = casi neutro. */
const ACCENTS: Record<Accent, { color: THREE.Color; mix: number }> = {
  electric: { color: new THREE.Color(0.145, 0.388, 0.922), mix: 0.2 },
  warm: { color: new THREE.Color(0.851, 0.463, 0.1), mix: 0.2 },
  dual: { color: new THREE.Color(0.45, 0.42, 0.6), mix: 0.12 },
};

const STAR_COLOR = new THREE.Color(0.804, 0.839, 0.894); // #cdd6e4

/* Geometría determinista de una capa (posición + fase/velocidad de twinkle + escala + tint). */
function makeLayerGeometry(cfg: LayerCfg) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(cfg.count * 3);
  const phases = new Float32Array(cfg.count);
  const speeds = new Float32Array(cfg.count);
  const scales = new Float32Array(cfg.count);
  const tints = new Float32Array(cfg.count);
  const rng = makeRng(cfg.seed);
  for (let i = 0; i < cfg.count; i++) {
    positions[i * 3] = (rng() * 2 - 1) * cfg.ex;
    positions[i * 3 + 1] = (rng() * 2 - 1) * cfg.ey;
    positions[i * 3 + 2] = cfg.zMin + rng() * (cfg.zMax - cfg.zMin);
    phases[i] = rng();
    // Twinkle desfasado: período 2-6s → velocidad angular 2π/período.
    speeds[i] = (Math.PI * 2) / (2 + rng() * 4);
    // Mayoría estrellas finas; ~12% un poco mayores/más brillantes (las "cercanas" del ojo).
    scales[i] = rng() < 0.12 ? 0.9 + rng() * 0.5 : 0.45 + rng() * 0.4;
    // Sesgo de acento concentrado en pocas estrellas (pow(rng,3) → casi todo ~0).
    tints[i] = Math.pow(rng(), 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 1));
  return geo;
}

const STARS_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeMul;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aScale;
  attribute float aTint;
  varying float vTwinkle;
  varying float vScale;
  varying float vTint;

  void main() {
    vScale = aScale;
    vTint = aTint;
    // Twinkle suave (nunca estroboscópico): opacity 0.35 → 1, período por-partícula.
    float tw = sin(uTime * aSpeed + aPhase * 6.2831) * 0.5 + 0.5;
    vTwinkle = 0.35 + tw * 0.65;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Tamaño por profundidad (atenuación) — puntos pequeños, nítidos.
    gl_PointSize = min(aScale * uSizeMul * uPixelRatio * (40.0 / -mv.z), 5.0);
  }
`;

const STARS_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uAccentMix;
  uniform float uBrightness;
  varying float vTwinkle;
  varying float vScale;
  varying float vTint;

  void main() {
    // Estrella redonda: núcleo suave + halo corto (no blob difuso).
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    float alpha = pow(core, 1.8);

    // Blanco-azulado base; susurro de acento sólo en las estrellas con aTint alto.
    vec3 col = mix(uColor, uAccent, uAccentMix * vTint);

    float a = alpha * vTwinkle * uBrightness * (0.6 + vScale * 0.4);
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

function StarLayer({
  cfg,
  accent,
  scroll,
}: {
  cfg: LayerCfg;
  accent: Accent;
  scroll?: MotionValue<number>;
}) {
  const groupRef = React.useRef<THREE.Group>(null);
  const matRef = React.useRef<THREE.ShaderMaterial>(null);

  const geometry = React.useMemo(() => makeLayerGeometry(cfg), [cfg]);
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = React.useMemo(() => {
    const acc = ACCENTS[accent];
    return {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeMul: { value: cfg.sizeMul },
      uBrightness: { value: cfg.brightness },
      uColor: { value: STAR_COLOR.clone() },
      uAccent: { value: acc.color.clone() },
      uAccentMix: { value: acc.mix },
    };
  }, [accent, cfg]);

  useFrame((state, delta) => {
    const m = matRef.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 1.5);
    }
    const g = groupRef.current;
    if (g) {
      // Deriva angular lentísima (sentido opuesto entre capas → profundidad).
      g.rotation.z += cfg.dir * cfg.rot * delta;
      // Paralaje por scroll: mapea progreso 0..1 → +par..-par (sutil, ~±4-6% del viewport).
      const p = scroll ? scroll.get() : 0.5;
      g.position.y = (0.5 - p) * cfg.par * 2;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          transparent
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={STARS_VERT}
          fragmentShader={STARS_FRAG}
        />
      </points>
    </group>
  );
}

function Scene({ accent, scroll }: { accent: Accent; scroll?: MotionValue<number> }) {
  return (
    <>
      {LAYERS.map((cfg) => (
        <StarLayer key={cfg.seed} cfg={cfg} accent={accent} scroll={scroll} />
      ))}
    </>
  );
}

function AtmosphereField({ accent }: { accent: Accent }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Canvas
        frameloop={inView ? "always" : "demand"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene accent={accent} scroll={scrollYProgress} />
      </Canvas>
    </div>
  );
}

export { AtmosphereField };
export default AtmosphereField;
