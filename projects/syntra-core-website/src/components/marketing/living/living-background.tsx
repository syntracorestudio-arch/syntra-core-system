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
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type LivingVariant = "servicios" | "proceso" | "casos";

/* ──────────────────── Journey store: UNA luz continua Casos→Proceso ────────────────────
 *
 * Casos y Proceso son secciones ADYACENTES y cada <LivingBackground> tiene su PROPIO
 * useScroll (uno por sección). Para que la cresta de luz sea UNA SOLA que viaja de los
 * tubos de Casos → nodo (boca) → cable de Proceso, ambas secciones comparten un valor
 * de "viaje" global `journey ∈ [0,1]`:
 *   journey ∈ [0, SPLIT)  → la cresta recorre los tubos de Casos (along 0→1, llega al nodo)
 *   journey ∈ [SPLIT, 1]  → la cresta recorre el cable de Proceso (along 0→1)
 *
 * Mecánica (sin listeners nuevos, sin tocar React en render):
 *  - Es un objeto plano module-level `{ value }`, mutado FUERA de React desde el callback
 *    de useMotionValueEvent de cada sección, y LEÍDO en useFrame (cumple react-hooks/refs
 *    e immutability: nunca se lee/muta un ref de React en render).
 *  - Cada sección mapea su progreso LOCAL (useScroll por sección) al sub-rango global que
 *    le toca. Casos escribe [0, SPLIT]; Proceso escribe [SPLIT, 1]. Last-writer-wins por
 *    sección visible: como los rangos no se solapan, en la unión la entrega es continua
 *    (Casos llega a SPLIT con la cresta en el nodo; Proceso arranca en SPLIT en su top).
 *  - El shader de Casos sólo enciende su cresta mientras journey ≤ SPLIT (después la deja
 *    "consumida" en el nodo); el de Proceso sólo mientras journey ≥ SPLIT (resuelve que la
 *    banda del top del cable apareciera antes de tiempo). Así NUNCA hay dos crestas.
 */
const SPLIT = 0.5;
const journeyStore = { value: 0 };

/** smoothstep en JS (mismo perfil que GLSL) — para los gates en useFrame. */
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Mapea el progreso local [0..1] de una sección a su tramo del viaje global.
 *
 * Con offset ["start center","end center"] cada sección queda CLAMPEADA en su endpoint
 * inactivo cuando no le toca (Casos en 1 cuando ya pasó; Proceso en 0 cuando aún no llega).
 * Para que NO se pisen, cada sección escribe SÓLO mientras está realmente viajando:
 *  - Casos escribe mientras v < 1 (recorriendo los tubos hacia el nodo); al llegar a 1 deja
 *    el viaje en SPLIT y suelta el control → Proceso toma desde ahí.
 *  - Proceso escribe sólo cuando v > 0 (ya cruzó la unión); antes no toca el store, así no
 *    sobre-escribe el tramo de Casos con SPLIT.
 * En la unión ambos valen SPLIT → el handoff es exacto y continuo.
 */
function writeJourney(variant: LivingVariant, localProgress: number) {
  if (variant === "casos") {
    if (localProgress < 1) journeyStore.value = localProgress * SPLIT;
    else journeyStore.value = SPLIT;
  } else if (variant === "proceso") {
    if (localProgress > 0) journeyStore.value = SPLIT + localProgress * (1 - SPLIT);
  }
}

/* ──────────────────── Cámara responsive al aspect (entra completo en angosto) ────────────────────
 *
 * La cámara base (z=9, fov=45) está calibrada para el aspect DESKTOP. En portrait/angosto el
 * ancho de mundo visible cae proporcional al aspect → los objetos anchos (arco, abanico de
 * Casos, vaivén del cable) se salen por los costados. Solución: ALEJAR la cámara (z mayor) en
 * proporción a cuánto cae el aspect respecto de un aspect de referencia, de modo que el ANCHO
 * de mundo visible se mantenga ≈ constante (zoom-out). Desktop queda IDÉNTICO: por encima del
 * aspect de referencia el factor es 1 (no se toca z).
 *
 * worldWidth(d) = 2·d·tan(fov/2)·aspect  → para fijar worldWidth cuando aspect<ref:
 *   d = baseZ · (refAspect / aspect)     (clamp para no alejar infinito en súper angosto)
 *
 * Cada variante define su PROPIO refAspect y su tope de zoom-out, porque el arco (cuadrado)
 * tolera menos alejamiento que los fondos verticales (cable, abanico).
 */
type CamTune = { baseZ: number; refAspect: number; maxZoom: number };
const CAM_TUNE: Record<LivingVariant, CamTune> = {
  // Arco (≈cuadrado, torus radio 2.2): refAspect 1.0; en portrait alejamos hasta 1.7× para que
  // el anillo entre completo. Más allá no hace falta (el scale extra del Arc cierra el resto).
  servicios: { baseZ: 9, refAspect: 1.0, maxZoom: 1.7 },
  // Cable vertical: refAspect 0.9. Subimos el tope de zoom-out a 2.1× porque en mobile angosto
  // (sección ~3000px → aspect ~0.15–0.48) el cap viejo (1.35) dejaba el cable demasiado grueso y
  // cortado/pegado al borde. Con 2.1× + el centrado-X firme (scale.x→~0.2) entra completo y se ve
  // como una línea central limpia hasta 320px. Desktop intacto (factor 1 por encima del refAspect).
  proceso: { baseZ: 9, refAspect: 0.9, maxZoom: 2.1 },
  // Abanico: refAspect 1.15 (empieza a adaptar antes, ya en tablet-portrait) y zoom-out generoso
  // (1.85×) que acompaña a la reducción de N de tubos para que entren prolijos.
  casos: { baseZ: 9, refAspect: 1.15, maxZoom: 1.85 },
};

function ResponsiveCamera({ variant }: { variant: LivingVariant }) {
  const tune = CAM_TUNE[variant];
  // Lee state.size + state.camera en useFrame (objetos three de R3F) y muta z + matriz de
  // proyección. No toca objetos de useMemo → cumple react-hooks/immutability; no lee refs en
  // render → cumple react-hooks/refs.
  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / Math.max(state.size.height, 1);
    // factor 1 cuando aspect ≥ refAspect (desktop intacto); crece al angostarse, con tope.
    const zoom = Math.min(Math.max(tune.refAspect / aspect, 1), tune.maxZoom);
    const targetZ = tune.baseZ * zoom;
    // Si el salto es grande (primer encuadre tras entrar en viewport / cambio brusco), ajustamos
    // de una para no mostrar un flash con el objeto cortado; si es chico (resize fino), lerp suave.
    const dz = targetZ - cam.position.z;
    cam.position.z += Math.abs(dz) > 0.6 ? dz : dz * 0.18;
    cam.updateProjectionMatrix();
  });
  return null;
}

/* ───────────────────────── Servicios: arco cromado ───────────────────────── */

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
    // Movimiento del video: la elipse se abre/cierra + gira de izquierda a derecha (yaw).
    tg.rotation.x = 1.0 + Math.sin(t * 0.2) * 0.2;
    rt.rotation.y = Math.sin(t * 0.28) * 0.32;
    // Centrado en la sección + parallax de scroll muy leve.
    const targetY = -0.6 + (0.5 - scrollRef.current) * 0.15;
    rt.position.y += (targetY - rt.position.y) * 0.05;
    // Scale responsive al ASPECT (no al media query): el zoom-out de cámara entra el grueso del
    // anillo; este scale extra solo se activa en portrait marcado (aspect<0.85) para cerrar el
    // resto y garantizar que el torus quede DENTRO. Desktop (aspect alto) → base 1.0 intacto.
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const base = mobile ? 0.82 : 1.0;
    const extra = aspect < 0.85 ? THREE.MathUtils.lerp(0.84, 1, (aspect - 0.45) / 0.4) : 1;
    const targetScale = base * Math.min(Math.max(extra, 0.84), 1);
    const s = rg.scale.x + (targetScale - rg.scale.x) * 0.12;
    rg.scale.setScalar(s);
  });

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* Roll → elipse en diagonal ↗ marcada (perfecta hacia la derecha). */}
      <group rotation={[0, 0, 0.5]}>
        <group ref={tilt}>
          <mesh ref={ring}>
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
function Conduit({ mobile }: { mobile: boolean }) {
  const glow = React.useRef<THREE.ShaderMaterial>(null);
  const root = React.useRef<THREE.Group>(null); // contenedor: comprime el vaivén X en angosto

  // Curva vertical suave (leve vaivén, no un "cable" recto), de arriba (idea) a abajo (sistema).
  const curve = React.useMemo(
    () =>
      // Vaivén ESTRECHO, centrado en el canal del medio (alineado con los nodos) → no
      // cruza las columnas de texto, así el brillo no pisa la lectura.
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 3.95, 0),
        new THREE.Vector3(0.16, 1.7, 0.18),
        new THREE.Vector3(-0.14, -0.3, -0.18),
        new THREE.Vector3(0.14, -2.1, 0.1),
        new THREE.Vector3(-0.05, -3.8, 0),
      ]),
    [],
  );

  // uActive: 0..1 → enciende la cresta de Proceso SÓLO en su tramo del viaje (journey ≥ SPLIT).
  // Antes de eso queda apagada (resuelve la "banda en el top del cable" antes de tiempo).
  const uniforms = React.useMemo(
    () => ({ uProgress: { value: 0 }, uTime: { value: 0 }, uActive: { value: 0 } }),
    [],
  );

  useFrame((s) => {
    // Centrado responsive: en portrait/angosto comprimimos el vaivén HORIZONTAL del cable hacia el
    // eje (scale.x) para que quede FIRME en la columna central, no corrido a un borde ni cortado.
    // La altura NO se toca (scale.y=1) → entra completo por el zoom-out de cámara (CAM_TUNE.proceso).
    // Mapeo del factor según aspect (ancho/alto del canvas):
    //   aspect ≥ 0.9 (desktop/tablet)        → 1.0  : cable IDÉNTICO al aprobado (vaivén pleno).
    //   aspect ≈ 0.9 → ~0.45 (mobile medio)   → 1.0 → ~0.2 lerp suave (se va aplanando al centro).
    //   aspect ≤ 0.45 (mobile muy angosto)    → ~0.2 : prácticamente una línea recta centrada.
    // Sin floor 0.55 (el viejo dejaba el vaivén demasiado abierto y rozando el borde en portrait).
    const rg = root.current;
    if (rg) {
      const aspect = s.size.width / Math.max(s.size.height, 1);
      // t: 0 en aspect 0.45 (más angosto) → 1 en aspect 0.9 (desktop). Fuera de rango, clamp.
      const t = Math.min(Math.max((aspect - 0.45) / (0.9 - 0.45), 0), 1);
      const targetX = THREE.MathUtils.lerp(0.2, 1, t);
      rg.scale.x += (targetX - rg.scale.x) * 0.12;
    }
    // Cresta derivada del VIAJE global compartido (Casos→Proceso = UNA sola luz).
    // journey ∈ [SPLIT, 1] es el tramo de Proceso → remapeo a crest local 0..1 del cable.
    const m = glow.current;
    if (!m) return;
    const journey = journeyStore.value;
    const localCrest = (journey - SPLIT) / (1 - SPLIT); // <0 antes del tramo, 0..1 en él
    const targetCrest = Math.min(Math.max(localCrest, 0), 1);
    // Gate: encendida sólo en su tramo, con borde suave en la unión (sin "pop").
    const targetActive = smoothstep(SPLIT - 0.02, SPLIT + 0.04, journey);
    m.uniforms.uProgress.value += (targetCrest - m.uniforms.uProgress.value) * 0.2;
    m.uniforms.uActive.value += (targetActive - m.uniforms.uActive.value) * 0.12;
    m.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group ref={root} scale={mobile ? 0.86 : 1}>
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
            "uniform float uProgress; uniform float uTime; uniform float uActive; varying vec2 vUv;" +
            "void main(){" +
            "  float along = vUv.x;" + // uv.x = a lo largo del tubo (0 arriba → 1 abajo)
            "  float filled = smoothstep(uProgress + 0.015, uProgress - 0.015, along);" +
            "  float crest = smoothstep(0.08, 0.0, abs(along - uProgress));" +
            "  float shimmer = 0.85 + 0.15 * sin(along * 42.0 - uTime * 2.0);" +
            "  vec3 electric = vec3(0.145, 0.388, 0.922);" +
            "  vec3 cyan = vec3(0.30, 0.78, 0.97);" +
            "  vec3 col = mix(electric, cyan, smoothstep(0.45, 1.0, along));" +
            // uActive: el cable sólo se enciende cuando el viaje entra en su tramo (journey≥SPLIT)
            // → antes de eso NO hay cresta en el top del cable; la luz sigue siendo UNA sola.
            "  float intensity = (filled * 0.26 + crest * 0.72) * shimmer * uActive;" +
            "  gl_FragColor = vec4(col * intensity, intensity);" +
            "}"
          }
        />
      </mesh>
    </group>
  );
}

/* ───────────────────────── Casos: campo de señales (geometría real) ───────────────────────── */

/**
 * SignalField — campo vivo de Casos, GEOMÉTRICO (no fullscreen quad). Tubos finos
 * (tubeGeometry sobre CatmullRomCurve3) en ESPACIO-MUNDO proyectado por la cámara → el
 * borde lo antialiasa el MSAA/SMAA = nítido, sin banding de gradiente de pantalla.
 *
 * MISMA construcción de DOS MALLAS que el Conduit de Proceso (para que los tubos tengan
 * VOLUMEN y REFLEJO, no cintas planas):
 *  - CORE metálico por tubo: meshStandardMaterial con los MISMOS params del Conduit
 *    (#4a5466, metalness 0.92, roughness 0.3, envMapIntensity 1.8) sobre un tubeGeometry
 *    fino (radio ~0.05) → refleja el Environment = redondez/dimensión real.
 *  - HALO aditivo por tubo: tubeGeometry de radio mayor (~0.11) con el shader de la "gota".
 *
 * Concepto: las "consultas" caen repartidas ARRIBA y CONVERGEN a un nodo común
 * abajo-centro (≈0,-3.6) — embudo invertido — que es la "boca" por donde entran al cable
 * de Proceso (curve top en (0, 3.95)). Cuerpo CÁLIDO (accent-warm) que vira a ELECTRIC
 * cerca de la convergencia. Cyan NO se usa aquí (reservado a HECHO en Proceso).
 *
 * Un pulso de luz ("gota") CAE por cada tubo hacia la convergencia (uTime + uScroll leve).
 * Un único ShaderMaterial compartido por los halos (vía ref + uniforms compartidos):
 * mutamos sus .uniforms en useFrame sin recrear el objeto — react-hooks/immutability.
 */
const CASOS_CONVERGENCE = new THREE.Vector3(0, -3.6, 0);

/**
 * Abanico responsive: cuántos tubos (N) y cuánto abren (openX = ±world X de los tops) según el
 * ANCHO del canvas. Idea del owner: bajar la CANTIDAD al angostarse para que entren prolijos y
 * no quede ralo el centro. Desktop/tablet mantiene los 6 tubos y la apertura aprobada (±3.8).
 *
 * Breakpoints (ancho de canvas en px):
 *   ≥ 1024  → 6 tubos, openX 3.8   (desktop/tablet-landscape: look aprobado, intacto)
 *   ≥ 768   → 5 tubos, openX 3.2   (tablet-portrait: una pizca menos ancho)
 *   ≥ 480   → 4 tubos, openX 2.6   (phone grande / landscape chico)
 *   ≥ 380   → 4 tubos, openX 2.3   (phone medio: mismos 4 pero más cerrado)
 *   <  380  → 3 tubos, openX 1.9   (phone angosto 320–375: 3 trazas limpias al nodo)
 *
 * La combinación con el zoom-out de cámara (CAM_TUNE.casos) hace que en 320–414 el abanico
 * entre completo y centrado. N variable NO rompe el merge (geos se recalcula con `curves`) ni
 * el shader (along=vUv.x es por-tubo, independiente de N).
 */
function casosFan(width: number): { N: number; openX: number } {
  if (width >= 1024) return { N: 6, openX: 3.8 };
  if (width >= 768) return { N: 5, openX: 3.2 };
  if (width >= 480) return { N: 4, openX: 2.6 };
  if (width >= 380) return { N: 4, openX: 2.3 };
  return { N: 3, openX: 1.9 };
}

// Shaders del tubo (módulo → identidad estable). along = vUv.x recorre el largo del tubo:
// 0 arriba → 1 en la convergencia (abajo). Cuerpo cálido → electric cerca de la boca.
const CASOS_TUBE_VERT =
  "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const CASOS_TUBE_FRAG =
  "uniform float uTime; uniform float uProgress; uniform float uActive; varying vec2 vUv;" +
  "void main(){" +
  "  float along = vUv.x;" + // 0 arriba → 1 en la convergencia (abajo)
  // Cresta + estela ligadas al VIAJE global (Casos→Proceso = UNA sola luz): la cresta viaja
  // de arriba hacia la boca y llega al nodo justo cuando arranca el cable de Proceso.
  "  float filled = smoothstep(uProgress + 0.02, uProgress - 0.02, along);" + // estela detrás
  "  float crest = smoothstep(0.07, 0.0, abs(along - uProgress));" + // cresta que viaja con el scroll
  "  float shimmer = 0.85 + 0.15 * sin(along * 40.0 - uTime * 2.0);" +
  "  float headFade = smoothstep(0.0, 0.1, along);" + // entra suave arriba
  "  float toMouth = 0.4 + 0.6 * smoothstep(0.4, 1.0, along);" + // concentra cerca de la boca
  "  vec3 col = vec3(0.145, 0.388, 0.922);" + // electric de Proceso (azul del cable)
  // uActive: la CRESTA viajera de Casos sólo está encendida en su tramo (journey ≤ SPLIT);
  // pasada la unión la cresta se apaga (ya entregó la luz al cable). La ESTELA (filled) queda
  // tenue como rastro "consumido" hacia la boca, sin competir con la cresta de Proceso.
  "  float crestEnergy = crest * 0.95 * uActive;" +
  "  float trailEnergy = filled * 0.18;" +
  "  float intensity = (crestEnergy + trailEnergy) * shimmer * toMouth * headFade;" +
  "  gl_FragColor = vec4(col * intensity, intensity);" +
  "}";

function SignalField() {
  const mobile = useMediaQuery("(max-width: 768px)");
  // Ancho del canvas (reactivo a resize/rotación vía useThree → válido para react-hooks/refs).
  // Deriva cuántos tubos y cuánto abren: en angosto MENOS tubos y MENOS apertura → entran prolijos.
  const width = useThree((state) => state.size.width);
  const { N, openX } = casosFan(width);
  // Menos detalle en mobile: geometría liviana sin disparar costo.
  // N tubos × 2 mallas (core + halo) → bajamos segmentos en mobile (y N ya es menor en angosto).
  const tubularSegments = mobile ? 72 : 120;
  const radialSegments = mobile ? 8 : 14;
  // Un poco más gruesos que el Conduit base: core (refleja el Environment) + halo.
  const coreRadius = mobile ? 0.055 : 0.066;
  const haloRadius = mobile ? 0.12 : 0.14;

  // Tubos = embudo invertido: repartidos arriba (x ∈ ±openX, y ≈ +3.5) y convergiendo todos a
  // CASOS_CONVERGENCE (0,-3.6,0). Un leve punto de control intermedio por tubo da una caída
  // orgánica (no recta) sin cruzar el centro de la lectura. N y openX dependen del ancho.
  const curves = React.useMemo(() => {
    return Array.from({ length: N }, (_, i) => {
      const f = N === 1 ? 0.5 : i / (N - 1); // 0..1 (guard por si N=1)
      const topX = (f - 0.5) * (openX * 2); // -openX .. +openX
      const topY = 3.6 + Math.sin(f * 6.2831) * 0.2; // leve variación de altura
      const topZ = (f - 0.5) * 1.2; // ligera profundidad → no quedan coplanares
      // Punto medio que arrastra hacia el centro con una curva suave (embudo).
      const midX = topX * 0.4;
      const midY = 0.1;
      const midZ = topZ * 0.5 + Math.sin(f * 9.42) * 0.18;
      return new THREE.CatmullRomCurve3([
        new THREE.Vector3(topX, topY, topZ),
        new THREE.Vector3(midX, midY, midZ),
        new THREE.Vector3(topX * 0.12, -2.2, topZ * 0.2),
        CASOS_CONVERGENCE.clone(),
      ]);
    });
  }, [N, openX]);

  // Geometrías FUSIONADAS: los 6 tubos del core en UNA malla y los 6 halos en OTRA. Así hay
  // UN solo material de halo (con ref) cuyo uniform anima TODOS los tubos a la vez (compartir
  // un objeto uniforms entre N <shaderMaterial> NO funciona: three lo separa por material).
  const coreGeometry = React.useMemo(() => {
    const geos = curves.map(
      (c) => new THREE.TubeGeometry(c, tubularSegments, coreRadius, radialSegments, false),
    );
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [curves, tubularSegments, coreRadius, radialSegments]);

  const haloGeometry = React.useMemo(() => {
    const geos = curves.map(
      (c) => new THREE.TubeGeometry(c, tubularSegments, haloRadius, radialSegments, false),
    );
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [curves, tubularSegments, haloRadius, radialSegments]);

  React.useEffect(
    () => () => {
      coreGeometry?.dispose();
      haloGeometry?.dispose();
    },
    [coreGeometry, haloGeometry],
  );

  // Material del halo con ref (patrón Conduit): mutamos sus .uniforms en useFrame.
  const glow = React.useRef<THREE.ShaderMaterial>(null);
  const uniforms = React.useMemo(
    () => ({ uTime: { value: 0 }, uProgress: { value: 0 }, uActive: { value: 1 } }),
    [],
  );
  useFrame((s) => {
    const m = glow.current;
    if (!m) return;
    m.uniforms.uTime.value = s.clock.elapsedTime;
    // Cresta derivada del VIAJE global compartido (Casos→Proceso = UNA sola luz).
    // journey ∈ [0, SPLIT] es el tramo de Casos → remapeo a crest local 0..1 de los tubos.
    const journey = journeyStore.value;
    const targetCrest = Math.min(Math.max(journey / SPLIT, 0), 1);
    // Gate: la cresta viajera se apaga al cruzar la unión (journey > SPLIT) → ya entregó la
    // luz al cable de Proceso; nunca hay dos crestas a la vez.
    const targetActive = 1 - smoothstep(SPLIT - 0.02, SPLIT + 0.04, journey);
    m.uniforms.uProgress.value += (targetCrest - m.uniforms.uProgress.value) * 0.2;
    m.uniforms.uActive.value += (targetActive - m.uniforms.uActive.value) * 0.12;
  });

  return (
    <group>
      {/* Core metálico de TODOS los tubos (1 malla) → MISMOS params que el Conduit. */}
      {coreGeometry ? (
        <mesh geometry={coreGeometry}>
          <meshStandardMaterial color="#4a5466" metalness={0.92} roughness={0.3} envMapIntensity={1.8} />
        </mesh>
      ) : null}
      {/* Halo aditivo de TODOS los tubos (1 malla, 1 material con ref → 1 pulso anima todo). */}
      {haloGeometry ? (
        <mesh geometry={haloGeometry}>
          <shaderMaterial
            ref={glow}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={uniforms}
            vertexShader={CASOS_TUBE_VERT}
            fragmentShader={CASOS_TUBE_FRAG}
          />
        </mesh>
      ) : null}
      {/* Nodo de convergencia: pequeña esfera emisiva en la "boca" que entra al cable. */}
      <mesh position={CASOS_CONVERGENCE}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#2f63e8" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={CASOS_CONVERGENCE}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshBasicMaterial
          color="#2f63e8"
          transparent
          opacity={0.28}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
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
      {/* Cámara responsive al aspect: en portrait/angosto aleja la cámara (zoom-out) para que el
          objeto entre completo. Desktop intacto (factor 1 por encima del refAspect). */}
      <ResponsiveCamera variant={variant} />
      <ambientLight intensity={variant === "proceso" ? 0.7 : 0.85} />
      {variant === "servicios" && (
        <>
          <React.Suspense fallback={null}>
            <Beams />
          </React.Suspense>
          <Arc mobile={mobile} scrollRef={scrollRef} />
        </>
      )}
      {variant === "proceso" && <Conduit mobile={mobile} />}
      {variant === "casos" && <SignalField />}
      {/* Environment para TODAS las variantes: arco y conducto reflejan su core metálico,
          y ahora los tubos de Casos también tienen core metálico (meshStandardMaterial)
          que necesita el Environment para reflejar — sin esto el metal queda negro/plano.
          Mismo bloque de Lightformers + misma resolution (256 mobile / 512 desktop). */}
      <Environment resolution={mobile ? 256 : 512}>
        <Lightformer intensity={2.4} position={[2, 4, 4]} scale={[10, 5, 1]} color="#ffffff" />
        <Lightformer intensity={1.8} position={[-1, -5, 4]} scale={[11, 5, 1]} color="#dfe3ea" />
        <Lightformer intensity={1.3} position={[-7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
        <Lightformer intensity={1.3} position={[7, 0, 3]} scale={[5, 11, 1]} color="#e6e9ef" />
      </Environment>
      {!mobile && (
        // Pipeline ESTÁNDAR para todas las variantes. Casos ahora es geometría real
        // (tubos finos) → el antialiasing lo hacen MSAA (multisampling) + SMAA; no precisa
        // el render target HalfFloat / ToneMapping NEUTRAL / dpr 2 que metimos contra el
        // banding del shader fullscreen (ya removido). multisampling 4 alcanza para tubos
        // finos sobre fondo difuso.
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
      : variant === "casos"
        ? // Campo de señales: cuerpo cálido arriba que converge y se enfría a electric abajo.
          "radial-gradient(55% 45% at 50% 12%, rgba(231,200,160,0.12), transparent 70%)," +
          "radial-gradient(38% 38% at 50% 100%, rgba(37,99,235,0.14), transparent 72%)"
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
      : variant === "casos"
        ? "radial-gradient(36% 34% at 42% 22%, rgba(231,200,160,0.10), transparent 70%)," +
          "radial-gradient(34% 38% at 58% 92%, rgba(37,99,235,0.08), transparent 72%)"
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
  // Gate de mobile angosto para el ARCO de Servicios: la sección mide ~3000px de alto, así
  // que el canvas es SIEMPRE muy portrait (aspect ~0.15–0.48) y el zoom-out de cámara topa en
  // su cap → el anillo ancho queda una mota flotante. Doctrina "mobile = fallback estático":
  // por debajo de 860px de ancho NO montamos el Canvas/Arc de Servicios, sólo el <Poster>
  // (el degradado que ya existe como fallback de reduced-motion). Tablet/desktop (≥860) intacto.
  // Sólo aplica a "servicios"; proceso (cable centrado) y casos (N reducido) sí siguen en 3D.
  const tinyForArc = useMediaQuery("(max-width: 859px)");
  const arcFallbackOnly = variant === "servicios" && tinyForArc;
  const scrollRef = React.useRef(0);
  // Pausa fuera de viewport (doctrina §3): el loop 3D no corre si la sección no se ve.
  const inView = useInView(ref, { margin: "200px" });

  // Offset variant-aware. servicios mantiene su ventana original (parallax suave del arco).
  // casos/proceso usan ["start center","end center"]: la ventana de cada uno EMPIEZA y TERMINA
  // cuando sus bordes cruzan el CENTRO del viewport. Como Casos.bottom == Proceso.top (adyacentes),
  // ese borde cruza el centro en la MISMA posición de scroll → Casos llega a progress=1 (cresta en
  // el nodo) justo cuando Proceso arranca en progress=0 (cresta en su top). Entrega continua.
  const offset: ["start end" | "start center", "end start" | "end center"] =
    variant === "servicios"
      ? ["start end", "end start"]
      : ["start center", "end center"];
  const { scrollYProgress } = useScroll({ target: ref, offset });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    // servicios usa scrollRef para su parallax (sin cambios). casos/proceso alimentan el
    // VIAJE global compartido → la cresta es UNA sola luz continua entre ambas secciones.
    scrollRef.current = v;
    writeJourney(variant, v);
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={"pointer-events-none absolute inset-0 " + (className ?? "")}
    >
      <Poster variant={variant} />
      {/* arcFallbackOnly: en mobile angosto el Arco de Servicios cae a SOLO el Poster (sin
          Aurora ni Canvas) — mejor perf y CLS 0, sin la "mota flotante". */}
      {!reduce && !arcFallbackOnly && <Aurora variant={variant} />}
      {!reduce && !arcFallbackOnly && (
        <CanvasBoundary>
          <Canvas
            // Pausa fuera de viewport: "never" cuando la sección no se ve → 0 trabajo de GPU.
            frameloop={inView ? "always" : "never"}
            // dpr capado e IGUAL para todas las variantes: ahora Casos es geometría (tubos
            // finos antialiaseados por MSAA/SMAA del composer), no precisa dpr 2 como el
            // shader fullscreen. antialias off (lo hace el composer).
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
