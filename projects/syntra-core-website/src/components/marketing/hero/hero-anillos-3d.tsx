"use client";

/**
 * HeroVortice3D — "EL VÓRTICE" (WEB-HERO-GLASS NATIVO 1:1, 2026-07-17).
 *
 * Réplica NATIVA de la escena Spline "Glass Knot Vortex" del owner, construida
 * con los valores EXACTOS extraídos del runtime de Spline en memoria (Spline
 * corre sobre three.js → mismos números en el mismo motor = mismos píxeles),
 * sin el runtime de Spline (sin badge "Built with Spline", sin 1.8MB extra).
 *
 * GROUND TRUTH extraído del runtime (dump 2026-07-17):
 *  - Geometría: TorusKnotGeometry(165, 28, 500, 50, p=4, q=10) — trenzado DOBLE.
 *  - Cámara: fov 45, zoom 1.2277, position [0, 0, 1000].
 *  - Renderer: NoToneMapping, exposure 1, shadowMap PCF.
 *  - Luces (TODAS castShadow menos la hemisférica):
 *      Point   #7136ff @2.8, decay 1, distance 2000, pos [96.5, 0, 0]
 *      Dir     #ffffff @2,   pos [0, -814, 256]
 *      Dir     #ffffff @1,   pos [0, 790, 445]
 *      Hemi    sky #d3d3d3 / ground #828282 @0.75
 *  - Material (NodeMaterial de Spline decodificado): color #4b4b4b, shininess 30,
 *    specular #6a6a6a, y una TEXTURA de entorno de estudio (extraída a
 *    spline-matcap.png) que genera las planchas líquidas de reflejo blanco.
 *
 * Interacción de casa (aprobada): estrella de frente girando en el plano +
 * bamboleo; sigue al mouse (suspendido en drag); click+arrastre 360° con
 * inercia. Lazy vía decider (desktop + motion), frameloop gateado, CLS 0.
 */

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useInView } from "framer-motion";
import * as THREE from "three";

const TAU = Math.PI * 2;

/* Escala NATIVA de la escena Spline (radio 165 ⇒ mundo ~±500). */
const FOLLOW_X = 48;
const FOLLOW_Y = 34;
const TILT_MAX = 0.18;
const SPIN_Y_PERIOD = 44;
const TUMBLE_PERIOD = 27;

/**
 * Estado de mouse a NIVEL MÓDULO (singleton: hay un solo hero). Los listeners lo
 * mutan vía funciones de módulo y useFrame lo lee — patrón de la casa para que el
 * React Compiler no vea mutación de props/args de hooks.
 */
const MOUSE = {
  tx: 0,
  ty: 0,
  dragging: false,
  dragX: 0,
  dragY: 0,
  velX: 0,
  velY: 0,
  lastX: 0,
  lastY: 0,
};

/** Inercia del drag: decae sola al soltar (llamada SOLO desde useFrame). */
function stepInertia() {
  if (MOUSE.dragging) return;
  MOUSE.dragY += MOUSE.velY;
  MOUSE.dragX += MOUSE.velX;
  MOUSE.velY *= 0.93;
  MOUSE.velX *= 0.93;
}

/** Puntero global normalizado (-1..1) — desde el listener de window. */
function trackPointer(clientX: number, clientY: number) {
  MOUSE.tx = Math.max(-1, Math.min(1, (clientX / window.innerWidth) * 2 - 1));
  MOUSE.ty = Math.max(-1, Math.min(1, (clientY / window.innerHeight) * 2 - 1));
}

/** Handlers de drag (mutan el singleton desde eventos, nunca en render). */
function beginDrag(clientX: number, clientY: number) {
  MOUSE.dragging = true;
  MOUSE.lastX = clientX;
  MOUSE.lastY = clientY;
  MOUSE.velX = 0;
  MOUSE.velY = 0;
}
function moveDrag(clientX: number, clientY: number) {
  if (!MOUSE.dragging) return;
  const dx = clientX - MOUSE.lastX;
  const dy = clientY - MOUSE.lastY;
  MOUSE.lastX = clientX;
  MOUSE.lastY = clientY;
  MOUSE.velY = dx * 0.0045;
  MOUSE.velX = dy * 0.0035;
  MOUSE.dragY += MOUSE.velY;
  MOUSE.dragX += MOUSE.velX;
}
function endDragState() {
  MOUSE.dragging = false;
}

function Scene() {
  const followRef = React.useRef<THREE.Group>(null);
  const spinRef = React.useRef<THREE.Group>(null);
  const autoY = React.useRef(0);

  // Geometría EXACTA del dump (trenzado doble 4,10).
  const knotGeo = React.useMemo(
    () => new THREE.TorusKnotGeometry(165, 28, 500, 50, 4, 10),
    [],
  );
  React.useEffect(() => () => knotGeo.dispose(), [knotGeo]);

  // Entorno de estudio EXTRAÍDO del material de Spline (las planchas de espejo).
  const envTex = React.useMemo(() => {
    const t = new THREE.TextureLoader().load("/visual-assets/syntra/hero/spline-matcap.png");
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  React.useEffect(() => () => envTex.dispose(), [envTex]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const mo = MOUSE;

    // SIGUE al mouse (suspendido durante drag).
    const follow = followRef.current;
    if (follow && !mo.dragging) {
      follow.position.x = THREE.MathUtils.lerp(follow.position.x, mo.tx * FOLLOW_X, 0.05);
      follow.position.y = THREE.MathUtils.lerp(follow.position.y, -mo.ty * FOLLOW_Y, 0.05);
      follow.rotation.x = THREE.MathUtils.lerp(follow.rotation.x, -mo.ty * TILT_MAX, 0.06);
      follow.rotation.y = THREE.MathUtils.lerp(follow.rotation.y, mo.tx * TILT_MAX, 0.06);
    }

    // Auto-spin en el plano + drag libre 360° con inercia.
    autoY.current += (TAU / SPIN_Y_PERIOD) * dt;
    stepInertia();
    const spin = spinRef.current;
    if (spin) {
      spin.rotation.z = autoY.current;
      spin.rotation.y = 0.24 * Math.sin((t / TUMBLE_PERIOD) * TAU) + mo.dragY;
      spin.rotation.x = 0.16 * Math.sin((t / 33) * TAU) + mo.dragX;
    }
  });

  return (
    <>
      {/* ══ RIG EXACTO (dump del runtime de Spline) ══ */}
      <hemisphereLight color="#d3d3d3" groundColor="#828282" intensity={0.75} />
      <directionalLight
        color="#ffffff"
        intensity={1}
        position={[0, 790, 445]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={100}
        shadow-camera-far={3000}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-bias={-0.0004}
      />
      <directionalLight
        color="#ffffff"
        intensity={2}
        position={[0, -814, 256]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={100}
        shadow-camera-far={3000}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-bias={-0.0004}
      />
      {/* Violeta SIN castShadow: su sombra PCF cortaba el recorrido del violeta
          en parches (en Spline fluye continuo). Posición EXACTA del dump. */}
      <pointLight
        color="#7136ff"
        intensity={6.5}
        decay={0}
        distance={2000}
        position={[96.5, 0, 0]}
      />

      <group ref={followRef}>
        <group ref={spinRef}>
          <mesh geometry={knotGeo} castShadow receiveShadow>
            {/* Material Spline decodificado: Phong shininess 30 + entorno de
                estudio extraído (combine ADD = la capa Lighting sumando). */}
            <meshPhongMaterial
              color="#2d2d2d"
              specular="#404040"
              shininess={30}
              envMap={envTex}
              reflectivity={0.55}
              combine={THREE.AddOperation}
            />
          </mesh>
        </group>
      </group>
    </>
  );
}

function HeroAnillos3D() {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(hostRef, { margin: "150px" });
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => trackPointer(e.clientX, e.clientY);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // DRAG para girar 360° (pedido owner): suave, con inercia al soltar.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    beginDrag(e.clientX, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer sintético */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    moveDrag(e.clientX, e.clientY);
  };
  const endDrag = () => {
    endDragState();
  };

  return (
    // Capa derecha clickeable: el vórtice flota sobre la atmósfera pareja.
    <div
      ref={hostRef}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="pointer-events-auto absolute top-1/2 right-[-2%] h-[105%] w-[54%] -translate-y-1/2 cursor-grab opacity-0 [animation:hero-object-in_1.4s_ease-out_0.2s_forwards] active:cursor-grabbing"
    >
      <Canvas
        shadows={{ enabled: true, type: THREE.PCFShadowMap }}
        frameloop={inView ? "always" : "demand"}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 1000], fov: 45, zoom: 0.88, near: 10, far: 5000 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          // Spline renderiza sin tone mapping (dump: toneMapping 0, exposure 1).
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

export { HeroAnillos3D };
