"use client";

/**
 * LivingBackground — sistema de fondo vivo (web viva), parametrizado por sección.
 *
 * variant="servicios" → ESCENA-FIRMA "arco que gira" (torus cromado glossy, ref Spline).
 * variant="proceso"   → "La Línea Viva": conducto 3D vertical (tubo metálico) con una
 *                        CRESTA DE LUZ que viaja con el scroll y "llena" el camino;
 *                        culmina en cyan (HECHO). Reusa el MISMO motor (Environment/Bloom/
 *                        Poster/perf) con geometría y movimiento distintos (doctrina §3/§4).
 *
 * Norte técnico (living-web-doctrine §3 / skill syntra-living-motion):
 *  - LAZY (dynamic ssr:false desde el consumidor), no bloquea LCP.
 *  - reduced-motion → poster estático (sin loop ni Canvas).
 *  - dpr capado · bloom solo desktop · mobile calidad reducida.
 *  - motion ligado al scroll (sin hijack) · CLS 0 (absolute inset-0 detrás del contenido).
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import {
  motion,
  useReducedMotion,
  useScroll,
  useMotionValueEvent,
  useInView,
} from "framer-motion";
import * as THREE from "three";

export type LivingVariant = "servicios" | "proceso";

/* ───────────────────────── Servicios: arco cromado ───────────────────────── */

function Arc({ mobile, scrollRef }: { mobile: boolean; scrollRef: React.RefObject<number> }) {
  const root = React.useRef<THREE.Group>(null); // parallax de posición
  const tilt = React.useRef<THREE.Group>(null); // inclinación base (con arriba/abajo leve)
  const ring = React.useRef<THREE.Mesh>(null); // giro sobre su propio eje

  useFrame((state) => {
    const rt = root.current;
    const tg = tilt.current;
    if (!rt || !tg) return;
    const t = state.clock.elapsedTime;
    // Movimiento del video: la elipse se abre/cierra + gira de izquierda a derecha (yaw).
    tg.rotation.x = 1.0 + Math.sin(t * 0.2) * 0.2;
    rt.rotation.y = Math.sin(t * 0.28) * 0.32;
    // Centrado en la sección + parallax de scroll muy leve.
    const targetY = -0.6 + (0.5 - scrollRef.current) * 0.15;
    rt.position.y += (targetY - rt.position.y) * 0.05;
  });

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* Roll → elipse en diagonal ↗ marcada (perfecta hacia la derecha). */}
      <group rotation={[0, 0, 0.5]}>
        <group ref={tilt}>
          <mesh ref={ring} scale={mobile ? 0.82 : 1.0}>
            <torusGeometry args={[2.2, 0.075, 96, 360]} />
            <meshStandardMaterial
              color="#c2cad6"
              metalness={0.9}
              roughness={0.3}
              envMapIntensity={2.4}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Haces de luz (solo Servicios): textura haz-luz.png en un shader con flujo + shimmer. */
function Beams() {
  // colorSpace se fija en el onLoad del loader (no mutar el resultado del hook en un effect).
  const tex = useTexture("/visual-assets/haz-luz.png", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
  });
  const mat = React.useRef<THREE.ShaderMaterial>(null);
  const uniforms = React.useMemo(
    () => ({ uMap: { value: tex }, uTime: { value: 0 }, uOpacity: { value: 0.9 } }),
    [tex],
  );
  useFrame((s) => {
    if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime;
  });
  return (
    <mesh position={[0, 0.6, -1.5]} scale={[22, 13, 1]}>
      <planeGeometry />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={
          "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        }
        fragmentShader={
          "uniform sampler2D uMap; uniform float uTime; uniform float uOpacity; varying vec2 vUv;" +
          "void main(){" +
          "  vec2 uv = vUv;" +
          "  uv.x += sin(uv.y * 6.0 + uTime * 0.5) * 0.006;" +
          "  uv.y += sin(uv.x * 4.0 + uTime * 0.35) * 0.004;" +
          "  vec3 c = texture2D(uMap, uv).rgb;" +
          "  float sweep = 0.6 + 0.4 * sin(uv.x * 3.5 + uv.y * 2.0 - uTime * 1.3);" +
          "  gl_FragColor = vec4(c * sweep * uOpacity, 1.0);" +
          "}"
        }
      />
    </mesh>
  );
}

/* ───────────────────────── Proceso: la línea viva ───────────────────────── */

/**
 * Conduit — conducto vertical 3D ("camino"). Cuerpo metálico (refleja el Environment →
 * material real, no neón) + un halo aditivo con una CRESTA de luz que viaja según el
 * scroll y "llena" el camino; el final vira a cyan (HECHO). uv.x recorre el largo del tubo.
 */
function Conduit({ mobile, scrollRef }: { mobile: boolean; scrollRef: React.RefObject<number> }) {
  const glow = React.useRef<THREE.ShaderMaterial>(null);

  // Curva vertical suave (leve vaivén, no un "cable" recto), de arriba (idea) a abajo (sistema).
  const curve = React.useMemo(
    () =>
      // Vaivén ESTRECHO, centrado en el canal del medio (alineado con los nodos) → no
      // cruza las columnas de texto, así el brillo no pisa la lectura.
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 3.7, 0),
        new THREE.Vector3(0.16, 1.7, 0.18),
        new THREE.Vector3(-0.14, -0.3, -0.18),
        new THREE.Vector3(0.14, -2.1, 0.1),
        new THREE.Vector3(-0.05, -3.8, 0),
      ]),
    [],
  );

  const uniforms = React.useMemo(
    () => ({ uProgress: { value: 0 }, uTime: { value: 0 } }),
    [],
  );

  useFrame((s) => {
    // Cresta = progreso de scroll, suavizado (sin saltos). Mutar vía el ref del material.
    const m = glow.current;
    if (!m) return;
    m.uniforms.uProgress.value += (scrollRef.current - m.uniforms.uProgress.value) * 0.08;
    m.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group scale={mobile ? 0.86 : 1}>
      {/* Cuerpo metálico del conducto (refleja el Environment) */}
      <mesh>
        <tubeGeometry args={[curve, 240, 0.05, 20, false]} />
        <meshStandardMaterial
          color="#4a5466"
          metalness={0.92}
          roughness={0.3}
          envMapIntensity={1.8}
        />
      </mesh>
      {/* Halo de luz viajera (additive): se llena hasta la cresta; cyan hacia el final.
          Halo más fino + intensidad moderada → presencia sin pisar la lectura del texto. */}
      <mesh>
        <tubeGeometry args={[curve, 240, 0.12, 20, false]} />
        <shaderMaterial
          ref={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={
            "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
          }
          fragmentShader={
            "uniform float uProgress; uniform float uTime; varying vec2 vUv;" +
            "void main(){" +
            "  float along = vUv.x;" + // uv.x = a lo largo del tubo (0 arriba → 1 abajo)
            "  float filled = smoothstep(uProgress + 0.015, uProgress - 0.015, along);" +
            "  float crest = smoothstep(0.08, 0.0, abs(along - uProgress));" +
            "  float shimmer = 0.85 + 0.15 * sin(along * 42.0 - uTime * 2.0);" +
            "  vec3 electric = vec3(0.145, 0.388, 0.922);" +
            "  vec3 cyan = vec3(0.30, 0.78, 0.97);" +
            "  vec3 col = mix(electric, cyan, smoothstep(0.45, 1.0, along));" +
            "  float intensity = (filled * 0.26 + crest * 0.72) * shimmer;" +
            "  gl_FragColor = vec4(col * intensity, intensity);" +
            "}"
          }
        />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Escena + entorno compartidos ───────────────────────── */

function Scene({
  variant,
  mobile,
  scrollRef,
}: {
  variant: LivingVariant;
  mobile: boolean;
  scrollRef: React.RefObject<number>;
}) {
  return (
    <>
      <ambientLight intensity={variant === "proceso" ? 0.7 : 0.85} />
      {variant === "servicios" ? (
        <>
          <React.Suspense fallback={null}>
            <Beams />
          </React.Suspense>
          <Arc mobile={mobile} scrollRef={scrollRef} />
        </>
      ) : (
        <Conduit mobile={mobile} scrollRef={scrollRef} />
      )}
      {/* Entorno PAREJO (suave arriba/abajo/lados) → metal uniforme, sin hotspot que "corte". */}
      <Environment resolution={mobile ? 256 : 512}>
        <Lightformer intensity={2.4} position={[2, 4, 4]} scale={[10, 5, 1]} color="#ffffff" />
        <Lightformer intensity={1.8} position={[-1, -5, 4]} scale={[11, 5, 1]} color="#dfe3ea" />
        <Lightformer intensity={1.3} position={[-7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
        <Lightformer intensity={1.3} position={[7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
      </Environment>
      {!mobile && (
        // multisampling 4 (no 8): fondo difuso con bloom, no precisa MSAA alto → más FPS.
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.4} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

/** Estado final estático (reduced-motion / sin WebGL): gradientes que evocan la escena. */
function Poster({ variant }: { variant: LivingVariant }) {
  const background =
    variant === "proceso"
      ? // Conducto vertical: hilo electric arriba que culmina en cyan (HECHO) abajo.
        "radial-gradient(26% 55% at 50% 24%, rgba(37,99,235,0.14), transparent 70%)," +
        "radial-gradient(30% 45% at 50% 82%, rgba(56,189,248,0.13), transparent 72%)," +
        "linear-gradient(180deg, transparent 30%, rgba(56,189,248,0.05) 100%)"
      : "radial-gradient(40% 30% at 28% 22%, rgba(109,93,251,0.14), transparent 70%)," +
        "radial-gradient(42% 32% at 74% 62%, rgba(56,189,248,0.12), transparent 72%)," +
        "radial-gradient(50% 40% at 60% 50%, rgba(37,99,235,0.08), transparent 75%)";
  return <div aria-hidden="true" className="absolute inset-0" style={{ background }} />;
}

/** Aurora que respira (deriva lenta de glows sobre el gris), distinta por variante. */
function Aurora({ variant }: { variant: LivingVariant }) {
  const background =
    variant === "proceso"
      ? "radial-gradient(30% 40% at 50% 22%, rgba(37,99,235,0.09), transparent 70%)," +
        "radial-gradient(34% 44% at 50% 80%, rgba(56,189,248,0.09), transparent 72%)"
      : "radial-gradient(38% 28% at 28% 18%, rgba(109,93,251,0.10), transparent 70%)," +
        "radial-gradient(40% 30% at 76% 64%, rgba(56,189,248,0.10), transparent 72%)";
  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ background }}
      animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.05, 1] }}
      transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/**
 * Error boundary del WebGL: si el 3D falla (HMR/Fast Refresh, o no hay WebGL), degrada al
 * póster en vez de dejar la sección rota/blanca. Progressive enhancement.
 */
class CanvasBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Silencioso: el <Poster /> de base queda como fallback.
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Media query reactiva sin setState-in-effect (subscribe a matchMedia). */
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

type LivingBackgroundProps = {
  variant?: LivingVariant;
  className?: string;
};

function LivingBackground({ variant = "servicios", className }: LivingBackgroundProps) {
  const reduce = useReducedMotion() ?? false;
  const ref = React.useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery("(max-width: 768px)");
  const scrollRef = React.useRef(0);
  // Pausa fuera de viewport (doctrina §3): el loop 3D no corre si la sección no se ve.
  const inView = useInView(ref, { margin: "200px" });

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    scrollRef.current = v;
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={"pointer-events-none absolute inset-0 " + (className ?? "")}
    >
      <Poster variant={variant} />
      {!reduce && <Aurora variant={variant} />}
      {!reduce && (
        <CanvasBoundary>
          <Canvas
            // Pausa fuera de viewport: "never" cuando la sección no se ve → 0 trabajo de GPU.
            frameloop={inView ? "always" : "never"}
            // dpr capado: el canvas cubre TODA la sección (alta). 1.5 desktop / 1.25 mobile
            // baja el costo por frame sin que se note en un fondo difuso. antialias off
            // (lo hace el composer).
            dpr={mobile ? [1, 1.25] : [1, 1.5]}
            camera={{ position: [0, 0, 9], fov: 45 }}
            gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Scene variant={variant} mobile={mobile} scrollRef={scrollRef} />
          </Canvas>
        </CanvasBoundary>
      )}
    </div>
  );
}

export { LivingBackground };
export default LivingBackground;
