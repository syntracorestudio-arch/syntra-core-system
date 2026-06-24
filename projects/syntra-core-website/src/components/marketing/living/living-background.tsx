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
import { Environment, Lightformer } from "@react-three/drei";
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
    const rg = ring.current;
    if (!rt || !tg || !rg) return;
    const t = state.clock.elapsedTime;
    const s = Math.sin(t * 0.5);
    // Giro LATERAL puro (yaw sobre el eje vertical del mundo) → izq ↔ der, sin subir/bajar.
    rt.rotation.y = s * 0.35; // turn lateral horizontal (más notorio)
    tg.rotation.x = 1.05; // inclinación fija
    rg.rotation.z = s * 0.28; // giro sobre su eje (vida del destello)
    // Posición: centrado en la sección + parallax de scroll muy acotado.
    const targetY = -0.65 + (0.5 - scrollRef.current) * 0.2;
    rt.position.y += (targetY - rt.position.y) * 0.05;
  });

  return (
    <group ref={root}>
      {/* Roll en el plano de pantalla → deja el aro inclinado en diagonal ↗ a la derecha. */}
      <group rotation={[0, 0, 0.55]}>
        {/* Inclinación base que aplana la elipse en diagonal. */}
        <group ref={tilt}>
          <mesh ref={ring} scale={mobile ? 1.3 : 1.7}>
            <torusGeometry args={[2.2, 0.075, 96, 360]} />
            <meshStandardMaterial
              color="#6b7280"
              metalness={0.88}
              roughness={0.2}
              envMapIntensity={2.1}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Scene({ mobile, scrollRef }: { mobile: boolean; scrollRef: React.RefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.75} />
      {/* Key blanca fuerte = destello plateado sobre el metal plata (look "Eternal Arc"). */}
      <directionalLight position={[3, 6, 5]} intensity={3} />
      <Arc mobile={mobile} scrollRef={scrollRef} />
      {/* Entorno neutro (plata/grafito) con apenas un susurro de marca. */}
      <Environment resolution={mobile ? 256 : 512}>
        <Lightformer intensity={2.8} position={[2, 3, 4]} scale={[10, 3, 1]} color="#ffffff" />
        <Lightformer intensity={1.4} position={[-6, -2, 2]} scale={[6, 4, 1]} color="#dfe3ea" />
        <Lightformer intensity={0.4} position={[-4, 1, 2]} scale={[4, 3, 1]} color="#6d5dfb" />
        <Lightformer intensity={0.4} position={[5, -1, 2]} scale={[4, 3, 1]} color="#38bdf8" />
      </Environment>
      {!mobile && (
        <EffectComposer multisampling={8}>
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

/** Capa de haces de luz (textura Spline) — fiel a la imagen; blend screen; los rayos
 * se deslizan animando SOLO la posición del fondo (sin transform → no desencaja). */
function LightTexture({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        backgroundImage: "url('/visual-assets/haz-luz.png')",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "50% 50%",
        mixBlendMode: "screen",
        opacity: 0.62,
      }}
      animate={
        reduce
          ? undefined
          : {
              backgroundPosition: ["38% 62%", "62% 36%", "38% 62%"],
              opacity: [0.5, 0.72, 0.5],
            }
      }
      transition={reduce ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
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
      {/* Haces de luz: temporalmente desactivados para validar el arco solo (se reactiva con el video/escena Spline). */}
      {/* <LightTexture reduce={reduce} /> */}
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
        <Canvas
          frameloop="always"
          dpr={mobile ? [1, 1.5] : [1, 2]}
          camera={{ position: [0, 0, 9], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Scene mobile={mobile} scrollRef={scrollRef} />
        </Canvas>
      )}
    </div>
  );
}

export { LivingBackground };
export default LivingBackground;
