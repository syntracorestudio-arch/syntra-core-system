"use client";

/**
 * PanelVidrio3D — el panel image-led de Contacto reconstruido en 3D VIVO (pedido
 * owner 2026-07-13): la imagen generada (estratos de vidrio verticales, luz
 * electric arriba, columna dorada centro-derecha, stardust) era el BOCETO; esta
 * escena la recrea en tiempo real para que el fondo respire:
 *
 *  1. COLUMNAS DE VIDRIO — quads verticales (geometría única pre-horneada, sin
 *     instancing ni updates de CPU) con shader propio: bandas de luz que RECORREN
 *     cada columna lentísimo (desfasadas), glow superior electric, filos laterales
 *     iluminados, y una minoría warm concentrada centro-derecha (la columna dorada).
 *  2. BRASAS — partículas finas ascendiendo con sway + twinkle (mismo lenguaje que
 *     el campo estelar del sitio).
 *
 * Disciplina atmosphere-field: determinista (mulberry32), TODO el movimiento en
 * shader (useFrame solo actualiza uTime), Canvas dpr [1,1.5], antialias off, sin
 * postprocesado, frameloop gateado por useInView (nunca 'never'), additive +
 * toneMapped:false. Módulo lazy (dynamic ssr:false desde panel-vida). La imagen
 * webp queda como poster para mobile/reduced-motion. Fondo propio opaco (gradiente
 * navy) para cubrir el poster mientras el canvas monta, sin doble exposición.
 * Sin cyan/violeta. Subordinado al CTA (alphas bajas). CLS 0 (absolute inset-0).
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useInView } from "framer-motion";
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
const DEEP = new THREE.Color(0.016, 0.035, 0.078); // base navy profunda

/* ──────────────────── 1. Columnas de vidrio ────────────────────
 * Un solo BufferGeometry con un quad por columna (~60 quads): posición mundial
 * horneada + atributos por-vértice (uv del quad, mixWarm, phase, brightness).
 * Orden de generación: lejos → cerca (pintado correcto con additive). */
function makeSlabsGeometry() {
  const rng = makeRng(0x51ab5);
  const COUNT = 60;
  const slabs: Array<{
    x: number; z: number; w: number; h: number; yC: number;
    warm: number; phase: number; bright: number;
  }> = [];
  for (let i = 0; i < COUNT; i++) {
    const z = -6 + rng() * 6; // -6 (fondo) .. 0 (frente)
    const near = (z + 6) / 6; // 0..1
    // Spread acotado al encuadre real del panel (~±2.6 world units visibles).
    const x = (rng() * 2 - 1) * 2.8;
    // Columna dorada: minoría warm concentrada centro-derecha (x ~ 0.4..1.6).
    const inGoldBand = x > 0.4 && x < 1.6;
    const warm = rng() < (inGoldBand ? 0.68 : 0.06) ? 1 : 0;
    slabs.push({
      x,
      z,
      w: 0.06 + rng() * 0.42,
      h: 7 + rng() * 5,
      yC: (rng() * 2 - 1) * 1.4,
      warm,
      phase: rng(),
      bright: 0.35 + near * 0.65,
    });
  }
  // Lejos primero (z menor) para el orden de pintado.
  slabs.sort((a, b) => a.z - b.z);

  const positions = new Float32Array(COUNT * 4 * 3);
  const uvs = new Float32Array(COUNT * 4 * 2);
  const infos = new Float32Array(COUNT * 4 * 3); // (mixWarm, phase, brightness)
  const indices: number[] = [];
  slabs.forEach((s, i) => {
    const vi = i * 4;
    const corners = [
      [s.x - s.w / 2, s.yC - s.h / 2, s.z],
      [s.x + s.w / 2, s.yC - s.h / 2, s.z],
      [s.x + s.w / 2, s.yC + s.h / 2, s.z],
      [s.x - s.w / 2, s.yC + s.h / 2, s.z],
    ];
    const uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (let c = 0; c < 4; c++) {
      positions.set(corners[c], (vi + c) * 3);
      uvs.set(uv[c], (vi + c) * 2);
      infos.set([s.warm, s.phase, s.bright], (vi + c) * 3);
    }
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aInfo", new THREE.BufferAttribute(infos, 3));
  geo.setIndex(indices);
  return geo;
}

const SLABS_VERT = /* glsl */ `
  attribute vec3 aInfo;
  varying vec2 vUv;
  varying vec3 vInfo;
  void main() {
    vUv = uv;
    vInfo = aInfo;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SLABS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uElectric;
  uniform vec3 uWarm;
  varying vec2 vUv;
  varying vec3 vInfo;

  void main() {
    float mixWarm = vInfo.x;
    float phase = vInfo.y;
    float bright = vInfo.z;

    // Banda de luz que RECORRE la columna (sube lentísimo, desfasada por columna).
    float band = sin(vUv.y * 2.6 - uTime * 0.14 + phase * 6.2831) * 0.5 + 0.5;
    band = pow(band, 3.0);

    // Glow superior: la luz "viene de arriba" (como en el boceto: electric arriba).
    float topGlow = smoothstep(0.25, 1.0, vUv.y);

    // Filos laterales del vidrio: 1 en los bordes del quad, 0 en el cuerpo.
    float body = smoothstep(0.0, 0.09, vUv.x) * smoothstep(1.0, 0.91, vUv.x);
    float edges = 1.0 - body;

    // Desvanecer extremos verticales (las columnas no "cortan" arriba/abajo).
    float capFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);

    vec3 tint = mix(uElectric, uWarm, mixWarm);
    // Las warm brillan un toque más (la columna dorada es el foco del boceto).
    float boost = 1.0 + mixWarm * 0.5;
    vec3 col = tint * (0.14 + band * 0.55 + topGlow * 0.32) * boost;

    float alpha =
      (bright * (0.16 + band * 0.34 + topGlow * 0.13) + edges * bright * 0.32) *
      capFade * boost;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function GlassSlabs() {
  const matRef = React.useRef<THREE.ShaderMaterial>(null);
  const geometry = React.useMemo(() => makeSlabsGeometry(), []);
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uElectric: { value: ELECTRIC.clone() },
      uWarm: { value: WARM.clone() },
    }),
    [],
  );

  useFrame((state) => {
    const m = matRef.current;
    if (m) m.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        transparent
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={SLABS_VERT}
        fragmentShader={SLABS_FRAG}
      />
    </mesh>
  );
}

/* ──────────────────── 2. Brasas ascendentes ──────────────────── */
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

/* ──────────────────── Escena + host ──────────────────── */
function PanelVidrio3D() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px" });

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Fondo propio opaco: cubre el poster webp mientras el canvas monta (sin
          doble exposición) y da la base navy profunda de la escena. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 60% 20%, #0c1526 0%, rgb(${DEEP.r * 255}, ${DEEP.g * 255}, ${DEEP.b * 255}) 70%)`,
        }}
      />
      <Canvas
        frameloop={inView ? "always" : "demand"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <GlassSlabs />
        {EMBER_LAYERS.map((cfg) => (
          <EmberLayer key={cfg.seed} cfg={cfg} />
        ))}
      </Canvas>
    </div>
  );
}

export { PanelVidrio3D };
export default PanelVidrio3D;
