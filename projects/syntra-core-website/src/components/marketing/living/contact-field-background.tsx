"use client";

/**
 * ContactFieldBackground — fondo vivo interactivo de Contacto ("El campo se inclina
 * hacia vos", reference-lock contacto.md, Dirección A). COMPONENTE HERMANO del
 * LivingBackground (NO un variant): no toca journeyStore ni la luz continua Casos→Proceso.
 *
 * Concepto: CAMPO DE PROFUNDIDAD de puntos/trazos tenues que en reposo deriva lento y que
 * REACCIONA al mouse con un MODELO GRAVITACIONAL (pozo de atracción) calculado en el VERTEX
 * SHADER por proximidad a uMouse → sin raycast, costo CPU ~nulo. NO constelación de nodos.
 *
 * Norte técnico (living-web-doctrine §3): lazy ssr:false (vía wrapper), frameloop por
 * useInView, dpr capado, reduced-motion → Poster (lo maneja el wrapper), mobile sin hover
 * = deriva Lissajous + conteo reducido + sin Bloom, CLS 0 (absolute inset-0 detrás).
 * React Compiler safe: nada de leer/mutar refs en render; three vía refs en useFrame.
 */

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useReducedMotion, useInView } from "framer-motion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ──────────────────── Store del mouse: module-level mutable (NO setState) ────────────────────
 *
 * El listener pointermove (a nivel WINDOW) escribe NDC aquí FUERA de React; useFrame lo LEE y
 * lerpea hacia el uniform uMouse. Cumple react-hooks/refs e immutability: no es un ref de React,
 * nunca se lee/muta en render. `active` cae a 0 si el puntero sale/queda quieto (auto-deriva).
 */
const pointerStore = { x: 0, y: 0, active: 0, lastMove: 0 };

/* PRNG determinístico (mulberry32) — puro (sin Math.random en render, React Compiler safe);
 * además el campo queda estable entre re-renders (no se reshuffle). */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ──────────────────── Media query reactiva (mismo patrón que el motor) ──────────────────── */
function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ──────────────────── Campo de puntos (THREE.Points + ShaderMaterial additive) ────────────────────
 *
 * Atributos: position (xyz, z = profundidad), aRandom (semilla por punto), aScale (tamaño base;
 * un SUBSET con aScale alto = los "nodos glow", que pulsan por uTime — NO un sistema aparte).
 * gl_PointSize escala por profundidad (z) → bokeh fake: los del fondo grandes y tenues.
 * Glow radial en fragment vía smoothstep sobre gl_PointCoord. Desplazamiento + aclarado por
 * proximidad a uMouse = pozo gravitacional (falloff smoothstep) calculado en el VERTEX SHADER.
 */

const POINTS_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;     // world units en el plano del campo
  uniform float uActive;   // 0 reposo → 1 reactivo
  uniform float uPixelRatio;
  attribute float aRandom;
  attribute float aScale;
  varying float vScale;
  varying float vGlow;     // aclarado por proximidad al mouse (0..1)
  varying float vNode;     // 1 si es nodo glow (aScale alto)

  void main() {
    vScale = aScale;
    vNode = smoothstep(1.6, 2.2, aScale);

    vec3 pos = position;

    // Deriva lenta autónoma (el campo respira) — independiente por punto (aRandom).
    pos.x += sin(uTime * 0.18 + aRandom * 6.2831) * 0.12;
    pos.y += cos(uTime * 0.15 + aRandom * 6.2831) * 0.12;

    // Pozo gravitacional: atracción hacia uMouse con falloff suave. La fuerza también
    // depende de la profundidad (los del frente se inclinan más → parallax de reacción).
    vec2 toMouse = uMouse - pos.xy;
    float dist = length(toMouse);
    float pull = smoothstep(3.2, 0.0, dist) * uActive; // 0 lejos → 1 sobre el cursor
    float depth = clamp((pos.z + 4.0) / 8.0, 0.0, 1.0); // 0 fondo → 1 frente
    pos.xy += normalize(toMouse + 1e-4) * pull * (0.6 + depth * 0.7);
    // Inclinación GLOBAL hacia el cursor (parallax por profundidad) → la reacción se ve
    // también en los márgenes, no sólo bajo el cursor (que suele caer sobre la card opaca).
    pos.xy += uMouse * 0.06 * (0.3 + depth) * uActive;
    vGlow = pull;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Tamaño por profundidad: un poco mayores que la v1, pero NÍTIDOS (cap + falloff agudo).
    float sizeByDepth = mix(1.4, 0.7, depth);
    float base = aScale * sizeByDepth;
    // Pulso de los nodos glow.
    float pulse = 1.0 + vNode * 0.35 * sin(uTime * 1.6 + aRandom * 6.2831);
    // Crece un poco bajo el pozo.
    float react = 1.0 + pull * 0.8;
    gl_PointSize = min(base * pulse * react * uPixelRatio * (150.0 / -mv.z), 22.0);
  }
`;

const POINTS_FRAG = /* glsl */ `
  uniform float uActive;
  varying float vScale;
  varying float vGlow;
  varying float vNode;

  void main() {
    // Punto NÍTIDO: núcleo definido + halo corto (no blob difuso). Falloff agudo.
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.04, d);
    float alpha = pow(core, 2.6);

    // Reposo = NEUTRO plata/humo (baja opacidad). Azul electric SOLO como pulso reactivo
    // localizado (vGlow) y un toque en los nodos glow (90/10).
    vec3 silver = vec3(0.62, 0.67, 0.74);
    vec3 electric = vec3(0.20, 0.47, 1.0);
    // Algunos nodos quedan "PRENDIDOS" en electric al reposo (acento 90/10); el resto plata.
    vec3 col = mix(silver, electric, clamp(vGlow * 0.9 + vNode * 0.78, 0.0, 1.0));

    // Opacidad disciplinada: el campo tenue en reposo; los nodos prendidos brillan más.
    float base = 0.075 + vNode * 0.30;
    float a = alpha * (base + vGlow * 0.4);
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
  }
`;

function PointField({ mobile }: { mobile: boolean }) {
  const mat = React.useRef<THREE.ShaderMaterial>(null);
  const viewport = useThree((s) => s.viewport);

  // Densidad BAJA y restringida (no llena el fondo): campo sutil, no plexus.
  const count = mobile ? 180 : 380;

  const geometry = React.useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const scales = new Float32Array(count);
    const rng = makeRng(1337 + count);
    // Distribución por todo el plano; el centro (columna del form) lo apaga el scrim del backdrop.
    for (let i = 0; i < count; i++) {
      const x = (rng() * 2 - 1) * 7.2;
      const y = (rng() * 2 - 1) * 4.6;
      const z = (rng() * 2 - 1) * 4.0;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      randoms[i] = rng();
      // ~9% nodos "prendidos" (mayores, azul), resto puntos finos plata (nítidos, no blobs).
      scales[i] = rng() < 0.09 ? 1.35 + rng() * 0.55 : 0.42 + rng() * 0.4;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    return geo;
  }, [count]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uActive: { value: 0 },
      uPixelRatio: { value: 1 },
    }),
    [],
  );

  useFrame((state) => {
    const m = mat.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    m.uniforms.uTime.value = t;
    m.uniforms.uPixelRatio.value = Math.min(state.gl.getPixelRatio(), 1.5);

    // Objetivo del pozo: en desktop sigue el cursor (NDC→world del plano del campo);
    // en mobile/sin actividad reciente, deriva autónoma (Lissajous lento).
    const recent = pointerStore.active > 0 && performance.now() - pointerStore.lastMove < 1500;
    let tx: number;
    let ty: number;
    let targetActive: number;
    if (!mobile && recent) {
      // NDC (-1..1) → world en el plano z=0 según el viewport actual.
      tx = pointerStore.x * (viewport.width / 2);
      ty = pointerStore.y * (viewport.height / 2);
      targetActive = 1;
    } else {
      // Lissajous lento: el campo respira solo y se inclina con sentido (no fuegos artificiales).
      tx = Math.sin(t * 0.12) * 3.4;
      ty = Math.cos(t * 0.09) * 2.1;
      targetActive = mobile ? 0.62 : 0.34;
    }
    const u = m.uniforms.uMouse.value as THREE.Vector2;
    u.x += (tx - u.x) * 0.06;
    u.y += (ty - u.y) * 0.06;
    m.uniforms.uActive.value += (targetActive - m.uniforms.uActive.value) * 0.05;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={POINTS_VERT}
        fragmentShader={POINTS_FRAG}
      />
    </points>
  );
}

/* ──────────────────── Trazos: CatmullRomCurve3 finos, flujo por uTime ────────────────────
 *
 * Geometría ESTÁTICA (tubeGeometry muy fino, radio ~0.012, antialiaseado por additive), una
 * sola malla fusionada + un ShaderMaterial additive con ref (mismo patrón que CASOS_TUBE_FRAG):
 * el "flujo" es un gradiente que viaja a lo largo de la curva (uv.x) por uTime. Reposo neutro
 * plata; un pulso electric viaja localizado (90/10). Confinados a los márgenes (no cruzan el form).
 */

const STROKE_VERT =
  "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const STROKE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float along = vUv.x;                       // 0..1 a lo largo del trazo
    // Pulso electric viajero localizado (la "luz que recorre el camino").
    float p = fract(uTime * 0.09);
    float crest = smoothstep(0.10, 0.0, abs(along - p));
    vec3 silver = vec3(0.58, 0.63, 0.71);
    vec3 electric = vec3(0.145, 0.388, 0.922);
    vec3 col = mix(silver, electric, crest);
    // Reposo MUY tenue (plata) + cresta localizada. Fundido en los extremos.
    float edge = smoothstep(0.0, 0.06, along) * smoothstep(1.0, 0.94, along);
    float intensity = (0.045 + crest * 0.5) * edge;
    gl_FragColor = vec4(col * intensity, intensity);
  }
`;

function Strokes({ mobile }: { mobile: boolean }) {
  const mat = React.useRef<THREE.ShaderMaterial>(null);

  const geometry = React.useMemo(() => {
    // Trazos confinados a los MÁRGENES (izq/der/arriba/abajo), nunca por la columna central del form.
    const defs: [number, number, number][][] = [
      [
        [-7.0, 3.6, -1.5],
        [-5.2, 1.2, -0.5],
        [-6.4, -1.4, -1.0],
        [-5.0, -3.6, -1.8],
      ],
      [
        [7.0, 3.2, -1.2],
        [5.4, 0.8, -0.6],
        [6.6, -1.8, -1.0],
        [5.2, -3.8, -1.6],
      ],
      [
        [-6.6, 4.2, -2.2],
        [-2.6, 4.4, -1.0],
        [2.6, 4.2, -1.4],
        [6.6, 4.0, -2.2],
      ],
      [
        [-7.2, -3.0, -2.4],
        [-3.0, -4.2, -1.2],
        [3.0, -4.2, -1.4],
        [7.2, -3.2, -2.4],
      ],
    ];
    const segs = mobile ? 60 : 110;
    const geos = defs.map((pts) => {
      const curve = new THREE.CatmullRomCurve3(
        pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      );
      return new THREE.TubeGeometry(curve, segs, 0.012, 6, false);
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [mobile]);

  React.useEffect(() => () => geometry?.dispose(), [geometry]);

  const uniforms = React.useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((s) => {
    if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime;
  });

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={STROKE_VERT}
        fragmentShader={STROKE_FRAG}
      />
    </mesh>
  );
}

/* ──────────────────── Listener window (pointermove) → store mutable ────────────────────
 *
 * El canvas es pointer-events:none (el form debe seguir clickeable), así que el listener vive
 * en window. Para que el campo reaccione SOLO sobre la sección Contacto (y no, p.ej., en el
 * footer), se hace HIT-TEST contra el rect del contenedor (areaRef): si el cursor está fuera,
 * active=0 (vuelve a la deriva). Las coords se calculan RELATIVAS a la sección (no a la
 * ventana) → el mapeo NDC→world del campo queda exacto.
 */
function usePointerField(
  enabled: boolean,
  areaRef: React.RefObject<HTMLDivElement | null>,
) {
  React.useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) {
        pointerStore.active = 0; // fuera de la sección → no activa (footer/header/etc.)
        return;
      }
      pointerStore.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointerStore.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      pointerStore.active = 1;
      pointerStore.lastMove = performance.now(); // ms (mismo reloj que el chequeo en useFrame)
    };
    const onLeave = () => {
      pointerStore.active = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, areaRef]);
}

/* ──────────────────── Escena ──────────────────── */
function Scene({ mobile }: { mobile: boolean }) {
  return (
    <>
      <PointField mobile={mobile} />
      <Strokes mobile={mobile} />
      {/* Bloom DESKTOP-only, parámetros del motor (disciplina del lock). */}
      {!mobile && (
        <EffectComposer>
          <Bloom intensity={0.4} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

function ContactFieldBackground({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const ref = React.useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery("(max-width: 768px)");
  const inView = useInView(ref, { margin: "200px" });
  // El listener de cursor sólo en desktop con motion (mobile = deriva autónoma). Acotado al
  // rect de `ref` (el área de la sección) → no se activa en footer/header/otras secciones.
  usePointerField(!reduce && !mobile, ref);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={"pointer-events-none absolute inset-0 " + (className ?? "")}
    >
      {!reduce && (
        <Canvas
          frameloop={inView ? "always" : "never"}
          dpr={mobile ? [1, 1.25] : [1, 1.5]}
          camera={{ position: [0, 0, 9], fov: 45 }}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Scene mobile={mobile} />
        </Canvas>
      )}
    </div>
  );
}

export { ContactFieldBackground };
export default ContactFieldBackground;
