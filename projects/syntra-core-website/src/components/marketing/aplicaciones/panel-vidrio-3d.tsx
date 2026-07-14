"use client";

/**
 * PanelVidrio3D v2 — "la imagen manda, la vida es puntual" (dirección B aprobada
 * por el owner 2026-07-14, tras 3 fondos que competían con el texto).
 *
 * La ARQUITECTURA de la luz es la imagen aprobada (panel-vidrio.webp, composición
 * y luminancia FIJAS → AA calculable de una vez, lección Servicios v5). Esta capa
 * solo agrega la vida que no arriesga legibilidad:
 *  1. BRASAS — partículas finas ascendiendo con sway + twinkle (baja frecuencia,
 *     alphas bajas, mismo lenguaje que el campo estelar del sitio).
 *  2. RESPIRACIÓN DORADA — glow CSS sobre la columna de luz de la imagen
 *     (solo opacity, 8s, nunca más brillante que el botón Enviar).
 *
 * El mesh de columnas de vidrio (GlassSlabs) MURIÓ acá: 60 slabs additive de alta
 * frecuencia uniformes convertían todo el panel en figura y el peor caso de
 * luminancia mutaba en el tiempo — ilegible por construcción, no por tuning.
 *
 * Disciplina: determinista (mulberry32), movimiento en shader (useFrame solo
 * uTime), Canvas transparente dpr [1,1.5], frameloop gateado por useInView (nunca
 * 'never'), additive + toneMapped:false, lazy vía panel-vida (desktop + motion).
 * La imagen webp queda SIEMPRE visible como base (también bajo el canvas).
 * Sin cyan/violeta. CLS 0 (absolute inset-0).
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, useInView } from "framer-motion";
import * as THREE from "three";

/* PRNG determinístico (mulberry32) — puro; la escena queda estable entre re-mounts. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ELECTRIC = new THREE.Color(0.376, 0.647, 0.98); // #60a5fa
const WARM = new THREE.Color(0.906, 0.784, 0.627); // #e7c8a0

/* ──────────────────── Brasas ascendentes ──────────────────── */
type EmberCfg = {
  seed: number;
  count: number;
  ex: number;
  zMin: number;
  zMax: number;
  sizeMul: number;
  brightness: number;
  riseMin: number;
  riseMax: number;
};

const EMBER_LAYERS: EmberCfg[] = [
  { seed: 0xe1b21, count: 90, ex: 3.6, zMin: -4, zMax: -2, sizeMul: 0.75, brightness: 0.5, riseMin: 0.05, riseMax: 0.12 },
  { seed: 0xa77d3, count: 70, ex: 3.2, zMin: -1.5, zMax: 0.5, sizeMul: 1.2, brightness: 0.8, riseMin: 0.09, riseMax: 0.2 },
];

const SPAN_Y = 11;

function makeEmberGeometry(cfg: EmberCfg) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(cfg.count * 3);
  const phases = new Float32Array(cfg.count);
  const speeds = new Float32Array(cfg.count);
  const scales = new Float32Array(cfg.count);
  const warms = new Float32Array(cfg.count);
  const rises = new Float32Array(cfg.count);
  const sways = new Float32Array(cfg.count);
  const rng = makeRng(cfg.seed);
  for (let i = 0; i < cfg.count; i++) {
    const right = rng() < 0.6;
    const xr = rng();
    positions[i * 3] = (right ? xr : -xr) * cfg.ex;
    positions[i * 3 + 1] = (rng() * 2 - 1) * (SPAN_Y / 2);
    positions[i * 3 + 2] = cfg.zMin + rng() * (cfg.zMax - cfg.zMin);
    phases[i] = rng();
    speeds[i] = (Math.PI * 2) / (2.5 + rng() * 4.5);
    scales[i] = rng() < 0.15 ? 0.9 + rng() * 0.5 : 0.4 + rng() * 0.4;
    warms[i] = rng() < (right ? 0.7 : 0.4) ? 1 : 0;
    rises[i] = cfg.riseMin + rng() * (cfg.riseMax - cfg.riseMin);
    sways[i] = 0.06 + rng() * 0.16;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geo.setAttribute("aWarm", new THREE.BufferAttribute(warms, 1));
  geo.setAttribute("aRise", new THREE.BufferAttribute(rises, 1));
  geo.setAttribute("aSway", new THREE.BufferAttribute(sways, 1));
  return geo;
}

const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeMul;
  uniform float uSpan;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aScale;
  attribute float aWarm;
  attribute float aRise;
  attribute float aSway;
  varying float vTwinkle;
  varying float vScale;
  varying float vWarm;

  void main() {
    vScale = aScale;
    vWarm = aWarm;
    float tw = sin(uTime * aSpeed + aPhase * 6.2831) * 0.5 + 0.5;
    vTwinkle = 0.3 + tw * 0.7;

    vec3 pos = position;
    pos.y = mod(position.y + uTime * aRise + uSpan * 0.5, uSpan) - uSpan * 0.5;
    pos.x += sin(uTime * 0.22 + aPhase * 6.2831) * aSway;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aScale * uSizeMul * uPixelRatio * (36.0 / -mv.z), 4.5);
  }
`;

const EMBER_FRAG = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uElectric;
  uniform float uBrightness;
  varying float vTwinkle;
  varying float vScale;
  varying float vWarm;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    float alpha = pow(core, 1.8);
    vec3 col = mix(uElectric, uWarm, vWarm);
    float a = alpha * vTwinkle * uBrightness * (0.55 + vScale * 0.45);
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

function EmberLayer({ cfg }: { cfg: EmberCfg }) {
  const matRef = React.useRef<THREE.ShaderMaterial>(null);
  const geometry = React.useMemo(() => makeEmberGeometry(cfg), [cfg]);
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeMul: { value: cfg.sizeMul },
      uSpan: { value: SPAN_Y },
      uBrightness: { value: cfg.brightness },
      uWarm: { value: WARM.clone() },
      uElectric: { value: ELECTRIC.clone() },
    }),
    [cfg],
  );

  useFrame((state) => {
    const m = matRef.current;
    if (m) {
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 1.5);
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        transparent
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={EMBER_VERT}
        fragmentShader={EMBER_FRAG}
      />
    </points>
  );
}

/* ──────────────────── Host: brasas + respiración ──────────────────── */
function PanelVidrio3D() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px" });

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Respiración dorada: glow que late sobre la luz de la LÁMPARA de la
          imagen (asset "estudio de noche": lámpara arriba-derecha, su luz se
          derrama sobre el escritorio abajo-derecha). Solo opacity; nunca
          compite con el botón Enviar. */}
      <motion.span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(44% 40% at 48% 50%, rgba(231,200,160,0.14), transparent 70%)",
        }}
        animate={{ opacity: [0.35, 0.85, 0.35] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Canvas TRANSPARENTE: solo brasas sobre la imagen (la base es el webp). */}
      <Canvas
        frameloop={inView ? "always" : "demand"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        {EMBER_LAYERS.map((cfg) => (
          <EmberLayer key={cfg.seed} cfg={cfg} />
        ))}
      </Canvas>
    </div>
  );
}

export { PanelVidrio3D };
export default PanelVidrio3D;
