"use client";

/**
 * LivingBackground — PROTOTIPO (web viva, piloto Servicios).
 *
 * Fondo: ESCENA-FIRMA "arco que gira" recreada en R3F (referencia Spline "Eternal Arc"),
 * objeto 3D metálico glossy con rim de rol (violeta/cyan) sobre base gris. Bloom para el
 * glow de los reflejos. Es fondo, NO protagonista; el contenido va al frente y legible.
 *
 * Norte técnico (living-web-doctrine §3 / skill syntra-living-motion):
 *  - LAZY (dynamic ssr:false desde el consumidor), no bloquea LCP.
 *  - pausa fuera de viewport (frameloop demand ↔ always por IntersectionObserver).
 *  - dpr capado · bloom solo desktop · mobile calidad reducida.
 *  - reduced-motion → poster estático (sin loop).
 *  - parallax ligado al scroll (sin hijack) + pointer-parallax sutil (desktop).
 *  - CLS 0 (absolute inset-0 detrás del contenido).
 *
 * Estado: prototipo para aprobar el objetivo visual del lock. No commitear hasta OK owner.
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import { motion, useReducedMotion, useScroll, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";

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

/** Haces de luz: la textura haz-luz.png en un shader con flujo + shimmer (additive). */
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

function Scene({ mobile, scrollRef }: { mobile: boolean; scrollRef: React.RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.85} />
      <React.Suspense fallback={null}>
        <Beams />
      </React.Suspense>
      <Arc mobile={mobile} scrollRef={scrollRef} />
      {/* Entorno PAREJO (suave arriba/abajo/lados) → cromo uniforme, sin hotspot que "corte". */}
      {/* Luz envolvente (arriba/abajo/lados) → el aro refleja parejo todo alrededor,
          sin corte oscuro en la parte de abajo. */}
      <Environment resolution={mobile ? 256 : 512}>
        <Lightformer intensity={2.4} position={[2, 4, 4]} scale={[10, 5, 1]} color="#ffffff" />
        <Lightformer intensity={1.8} position={[-1, -5, 4]} scale={[11, 5, 1]} color="#dfe3ea" />
        <Lightformer intensity={1.3} position={[-7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
        <Lightformer intensity={1.3} position={[7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
      </Environment>
      {!mobile && (
        // multisampling 4 (no 8): el aro es cromo difuso con bloom, no precisa MSAA alto;
        // baja mucho el costo por frame → más FPS, motion fluido. SMAA limpia el resto.
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.4} luminanceThreshold={0.45} luminanceSmoothing={0.3} mipmapBlur />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

function Poster() {
  // Estado final estático (reduced-motion / sin WebGL): gris con glows de rol + hint de arco.
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(40% 30% at 28% 22%, rgba(109,93,251,0.14), transparent 70%)," +
          "radial-gradient(42% 32% at 74% 62%, rgba(56,189,248,0.12), transparent 72%)," +
          "radial-gradient(50% 40% at 60% 50%, rgba(37,99,235,0.08), transparent 75%)",
      }}
    />
  );
}

/**
 * Error boundary del WebGL: si el 3D falla (p. ej. el `Environment`/postprocessing se
 * re-inicializan mal en Fast Refresh/HMR, o no hay WebGL), degrada al póster oscuro en
 * vez de dejar la sección rota/blanca. Progressive enhancement (la sección vive sin 3D).
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
  variant?: "servicios";
  className?: string;
};

function LivingBackground({ className }: LivingBackgroundProps) {
  const reduce = useReducedMotion() ?? false;
  const ref = React.useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery("(max-width: 768px)");
  const scrollRef = React.useRef(0);

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
      <Poster />
      {/* Aurora que respira (deriva lenta de glows de rol sobre el gris). */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(38% 28% at 28% 18%, rgba(109,93,251,0.10), transparent 70%)," +
              "radial-gradient(40% 30% at 76% 64%, rgba(56,189,248,0.10), transparent 72%)",
          }}
          animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.05, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {!reduce && (
        <CanvasBoundary>
          <Canvas
            frameloop="always"
            // dpr capado: el canvas cubre TODA la sección (alta) → a dpr 2 era un buffer
            // enorme por frame. 1.5 desktop / 1.25 mobile baja el costo sin que se note
            // en un fondo cromo difuso. antialias del framebuffer off (lo hace el composer).
            dpr={mobile ? [1, 1.25] : [1, 1.5]}
            camera={{ position: [0, 0, 9], fov: 45 }}
            gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Scene mobile={mobile} scrollRef={scrollRef} />
          </Canvas>
        </CanvasBoundary>
      )}
    </div>
  );
}

export { LivingBackground };
export default LivingBackground;
