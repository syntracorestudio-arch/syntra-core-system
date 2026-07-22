"use client";

/**
 * HeroLiquido — "LA TINTA": el fondo del Hero (2026-07-22).
 *
 * Reemplaza a "LAS PLACAS" (hero-estructura.tsx, rechazado): el fondo dejó de ser
 * un objeto con silueta que competía con el vórtice y pasó a ser LUZ — la atmósfera
 * del espacio donde el nudo vive. Referencia del owner: escena "Liquid Gradient
 * Abstract Background" de Spline Community.
 *
 * MUESTREO DE LA REFERENCIA (píxeles reales, no estimación): el gradiente entero
 * vive entre #000000 y #0a2655 (p99); crestas #082046; mediana #051025. El "azul
 * eléctrico" que uno percibe es contraste local contra el campo casi negro, no
 * luminancia real. Por eso acá el cuerpo de la masa es #17459E y el eléctrico
 * #2563EB ocupa ≤5% del encuadre: si el fondo se come el azul del CTA, el botón
 * primario deja de ser el azul más brillante de la pantalla y se cae la jerarquía
 * de acción (spec del design-director).
 *
 * TÉCNICA — campo de masas gaussianas advectado por domain warping:
 *  · La LUMINANCIA es suma de gaussianas ⇒ falloff C∞, imposible que aparezca alta
 *    frecuencia (fbm en el brillo daría "textura ruidosa", que es justo lo que no
 *    queremos). La GEOMETRÍA la deforma un warp de ruido de 2 etapas ⇒ lenguas y
 *    tendones de tinta. Es literalmente lo que hace la tinta en agua: un escalar
 *    suave advectado por un campo turbulento.
 *  · Sin loop percibible: el tiempo es la 3ª dimensión del ruido y las derivas usan
 *    períodos coprimos (34/53/79 s).
 *
 * POR QUÉ <ScreenQuad> Y NO UN PLANO: la cámara de esta escena corre con
 * setViewOffset(-25%) para encuadrar el vórtice al 75% del ancho. Cualquier
 * geometría en world space heredaría ese desplazamiento y saldría corrida. El
 * vertex shader de acá escribe gl_Position directo (no pasa por projectionMatrix)
 * y el fragment trabaja en gl_FragCoord ⇒ el fondo queda clavado al rect real del
 * canvas, full-bleed, mientras el nudo conserva su encuadre.
 *
 * Además: ShaderMaterial sin `lights` ⇒ la point light violeta del rig no lo toca
 * (un solo píxel violeta derramado sobre el gradiente = rechazo, spec del DD).
 * Color autorado en sRGB CRUDO (sin THREE.Color, que convertiría a lineal): con
 * NoToneMapping lo que se escribe es lo que se ve ⇒ el stop oscuro sale exactamente
 * #04070E y cose sin costura con el CSS de abajo.
 */

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import * as THREE from "three";

/* ── Paleta (spec design-director) — hue lock 214-224°: por debajo lee teal/cyan,
      por encima entra en índigo → cliché IA. Nunca desaturar hacia gris-acero. ── */
const RAMP = {
  vacio: "#04070E", // fundido con Servicios — ya en uso, no tocar
  aire: "#060B14", // aire oscuro (mitad izquierda, detrás del texto)
  insinuacion: "#09182F", // primera insinuación: ya es azul, no gris
  profunda: "#0F2A5C", // masa en sombra
  cuerpo: "#17459E", // cuerpo iluminado — el PROMEDIO del área azul
  cresta: "#1D4ED8", // bordes luminosos
  nucleo: "#2563EB", // acento máximo — ≤5% del encuadre
} as const;

/** hex → vec3 sRGB crudo (sin THREE.Color: NO queremos conversión a lineal). */
function srgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const VERT = /* glsl */ `
  void main() {
    // Clip-space directo: inmune al setViewOffset de la cámara del vórtice.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec2  uRes;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uIntensity;
  uniform float uContrast;
  uniform float uWarp;
  uniform float uDither;
  uniform vec2  uFocus;      // foco principal, en uv medido DESDE ARRIBA
  uniform vec2  uFocus2;     // masa secundaria
  uniform vec2  uWell;       // centro del pozo oscuro (zona del nudo)
  uniform float uWellR;
  uniform float uCeilL;      // techo de densidad en la mitad izquierda
  uniform vec2  uPtr;        // puntero RETRASADO (-1..1) — τ 180 ms detrás del cursor
  uniform vec2  uPtrVel;     // velocidad acumulada, decae con τ 1.6 s (la estela)
  uniform float uPtrAmp;     // desplazamiento máximo, en fracción del ancho
  uniform float uPtrSigma;   // radio de influencia, en fracción del ancho
  uniform float uPtrStir;    // cuánto sube la turbulencia local al pasar el mouse
  uniform vec3  uC0, uC1, uC2, uC3, uC4, uC5, uC6;

  const float TAU = 6.28318530718;

  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  /* Value noise 3D — la 3ª dimensión es el tiempo ⇒ evolución sin loop. */
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  /* Gaussiana anisótropa: falloff C∞ ⇒ CERO borde duro, por construcción. */
  float blob(vec2 w, vec2 c, vec2 rad, float k) {
    vec2 d = (w - c) / rad;
    return k * exp(-dot(d, d));
  }

  /* uv (desde arriba-izquierda) → espacio p centrado y corregido por aspecto.
     GLSL no admite funciones anidadas: vive acá, no dentro de main(). */
  vec2 P(float x, float y, float a) {
    return vec2((x - 0.5) * a, (1.0 - y) - 0.5);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;          // y crece hacia ARRIBA
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    float t = uTime * uSpeed;

    /* ── ADVECCIÓN: la tinta responde a la VELOCIDAD del puntero, no a su posición,
          y sigue disipándose ~3 s después de que el mouse frena. Esa es la
          diferencia entre "medio con inercia" y "rig pegado al cursor": el vórtice
          reacciona a la POSICIÓN (lerp τ≈320 ms), así que si el fondo hiciera lo
          mismo las dos respuestas se sumarían y todo se sentiría acoplado.
          Ganancia reducida dentro del pozo: ahí ya reacciona el nudo. ── */
    vec2 ptr = vec2(uPtr.x * 0.5 * aspect, -uPtr.y * 0.5);
    float sigma = uPtrSigma * aspect;
    float infl = exp(-dot(p - ptr, p - ptr) / (2.0 * sigma * sigma));
    vec2 wc0 = vec2((uWell.x - 0.5) * aspect, (1.0 - uWell.y) - 0.5);
    float dentroPozo = exp(-dot(p - wc0, p - wc0) / (uWellR * uWellR));
    vec2 vel = uPtrVel * 8.0;
    vec2 velS = vel / (1.0 + abs(vel));        // saturación suave (tanh no existe en ES 1.00)
    float ganancia = infl * mix(1.0, 0.35, dentroPozo);
    vec2 push = velS * (uPtrAmp * aspect) * ganancia;
    /* El empuje actúa sobre la TURBULENCIA, no sobre las masas: trasladar
       gaussianas de radio ~1 es invisible (medido: <1 nivel de color). Lo que el
       ojo registra es el filamento deformándose, así que la estela advecta el
       campo de warp y además sube su amplitud localmente — la tinta se "revuelve"
       donde pasaste, y sigue revuelta mientras la velocidad se disipa. */
    float revuelto = 1.0 + uPtrStir * ganancia * length(velS);

    /* ── WARP (Íñigo Quílez, 2 etapas): estira las masas en lenguas de tinta ── */
    vec2 pw = p - push * 3.0;
    vec2 q = vec2(n3(vec3(pw * 1.05, t * 0.11)),
                  n3(vec3(pw * 1.05 + 5.2, t * 0.13))) - 0.5;
    vec2 r = vec2(n3(vec3(pw * 1.85 + 4.0 * q + 1.7, t * 0.09)),
                  n3(vec3(pw * 1.85 + 4.0 * q + 9.2, t * 0.10))) - 0.5;
    vec2 w = p + (uWarp * revuelto) * (0.55 * q + 0.32 * r) - push;

    /* ══ DISTRIBUCIÓN (v2, pedido del owner 2026-07-22) ══
       Antes: masas a la derecha + techo monótono en x ⇒ el encuadre se leía
       partido en dos (mitad azul / mitad oscura). Ahora las masas se reparten por
       TODO el ancho y la irregularidad la dan BACHES negativos salpicados en
       puntos distintos — no un degradé lateral. La legibilidad del H1 deja de
       depender de una rampa global y pasa a depender de un bache puesto justo
       sobre el bloque de texto (+ el scrim CSS que ya existe encima del canvas).
       Períodos de deriva todos coprimos entre sí. */
    /* ÓRBITAS DE LISSAJOUS (v3, pedido del owner 2026-07-22): antes cada masa solo
       respiraba alrededor de su ancla (amplitud ~5% del ancho) ⇒ el mapa de luz era
       fijo y había zonas condenadas a estar siempre oscuras. Ahora cada masa
       RECORRE la sección: amplitudes de 15-22% del ancho con períodos largos y
       coprimos en x e y por separado ⇒ trayectoria abierta que barre área en vez de
       oscilar sobre una línea, y el conjunto no se repite en la escala de una
       visita. La velocidad de borde queda en ~12-16 px/s a 1920: viaje evidente si
       mirás, imperceptible como parpadeo. */
    vec2 m1 = P(uFocus.x, uFocus.y, aspect)                              // ancla del vórtice
            + vec2(sin(t * TAU / 97.0) * 0.30, cos(t * TAU / 71.0) * 0.16);
    vec2 m2 = P(0.62, 0.20, aspect)                                      // alta centro-derecha
            + vec2(cos(t * TAU / 113.0) * 0.34, sin(t * TAU / 83.0) * 0.20);
    vec2 m3 = P(0.44, 0.72, aspect)                                      // cruza el medio
            + vec2(sin(t * TAU / 127.0) * 0.38, cos(t * TAU / 89.0) * 0.18);
    vec2 m4 = P(0.20, 0.24, aspect)                                      // BARRE EL CUADRANTE
            + vec2(cos(t * TAU / 103.0) * 0.36, sin(t * TAU / 79.0) * 0.22); // SUPERIOR IZQUIERDO
    vec2 m5 = P(0.10, 0.78, aspect)                                      // izquierda baja
            + vec2(sin(t * TAU / 139.0) * 0.32, cos(t * TAU / 101.0) * 0.20);
    vec2 m6 = P(0.34, 0.96, aspect)                                      // puente inferior
            + vec2(cos(t * TAU / 149.0) * 0.40, sin(t * TAU / 109.0) * 0.14);

    float f = blob(w, m1, vec2(0.86, 0.58) * uScale, 1.24)
            + blob(w, m2, vec2(0.60, 0.76) * uScale, 0.66)
            + blob(w, m3, vec2(0.78, 0.54) * uScale, 0.78)
            + blob(w, m4, vec2(0.72, 0.56) * uScale, 0.80)
            + blob(w, m5, vec2(0.80, 0.48) * uScale, 0.64)
            + blob(w, m6, vec2(1.10, 0.34) * uScale, 0.42);

    /* BACHES: zonas apagadas en puntos distintos del encuadre. Son lo que evita
       que "repartir el azul" termine en una sábana pareja — la tinta tiene que
       tener densidad desigual, no saturación uniforme. b1 cae sobre el bloque de
       texto: además de dar irregularidad, es el que sostiene el contraste del H1. */
    /* b1 es el ÚNICO con órbita corta: está sobre el bloque de texto y es lo que
       sostiene el contraste del H1 — si viajara, la legibilidad iría y vendría.
       Los demás recorren la sección como las masas: un bache anclado en una
       esquina es exactamente lo que dejaba el margen superior izquierdo siempre
       oscuro (b5 vivía clavado en 0.12, 0.06). */
    vec2 b1 = P(0.26, 0.52, aspect) + vec2(sin(t * TAU / 67.0) * 0.10, cos(t * TAU / 103.0) * 0.07);
    vec2 b2 = P(0.57, 0.30, aspect) + vec2(cos(t * TAU / 157.0) * 0.30, sin(t * TAU / 91.0) * 0.18);
    vec2 b3 = P(0.82, 0.88, aspect) + vec2(sin(t * TAU / 163.0) * 0.34, cos(t * TAU / 97.0) * 0.16);
    vec2 b4 = P(0.97, 0.18, aspect) + vec2(cos(t * TAU / 173.0) * 0.28, sin(t * TAU / 107.0) * 0.20);
    vec2 b5 = P(0.30, 0.10, aspect) + vec2(sin(t * TAU / 181.0) * 0.34, cos(t * TAU / 113.0) * 0.18);

    vec2 b6 = P(0.41, 0.12, aspect) + vec2(cos(t * TAU / 191.0) * 0.32, sin(t * TAU / 119.0) * 0.16);
    vec2 b7 = P(0.68, 0.62, aspect) + vec2(sin(t * TAU / 199.0) * 0.30, cos(t * TAU / 127.0) * 0.18);

    f -= blob(w, b1, vec2(0.62, 0.60) * uScale, 0.86)
       + blob(w, b2, vec2(0.52, 0.44) * uScale, 0.64)
       + blob(w, b3, vec2(0.58, 0.40) * uScale, 0.62)
       + blob(w, b4, vec2(0.56, 0.42) * uScale, 0.56)
       + blob(w, b5, vec2(0.50, 0.38) * uScale, 0.50)
       + blob(w, b6, vec2(0.54, 0.36) * uScale, 0.52)
       + blob(w, b7, vec2(0.46, 0.44) * uScale, 0.44);
    f = max(f, 0.0);

    f = 1.0 - exp(-f * uIntensity);            // satura suave, sin clamp duro
    f = pow(max(f, 0.0), uContrast);

    /* ── POZO OSCURO sobre el nudo: el vórtice es vidrio NEGRO con reflejos
          blancos; necesita fondo oscuro para que esos reflejos existan. Sobre azul
          brillante se vuelve un recorte plano. Elipse sesgada hacia arriba. ── */
    vec2 wc = vec2((uWell.x - 0.5) * aspect, (1.0 - uWell.y) - 0.5);
    vec2 wd = (w - wc) / vec2(uWellR, uWellR * 0.86);
    wd.y = wd.y < 0.0 ? wd.y * 0.70 : wd.y;    // más pozo en la mitad SUPERIOR
    f *= 1.0 - 0.62 * exp(-dot(wd, wd));

    /* ── TECHO ZONAL (reemplaza al corte duro que dejaba la izquierda en negro
          plano). La tinta existe de borde a borde; lo que se limita no es su
          PRESENCIA sino su LUMINOSIDAD: a la izquierda la densidad se comprime
          suavemente contra un techo bajo ⇒ la rampa no pasa de #0F2A5C y el H1
          conserva contraste de sobra. Compresión exponencial, no min(): un clamp
          duro dejaría mesetas planas con borde visible.
          Se evalúa sobre la coordenada YA DEFORMADA ⇒ la transición es ondulada,
          no una línea recta vertical. ── */
    float wx = 0.5 + w.x / aspect;
    /* Tres zonas INDEPENDIENTES (no sumadas: si el techo izquierdo fuera la base de
       la suma, bajarlo apagaría también la derecha y la jerarquía se aplanaría). */
    /* v2: el techo lateral pasó de rampa de 3 zonas a una inclinación SUAVE. La
       rampa fuerte era la causa estructural de que el encuadre se leyera partido
       en dos; ahora solo reserva el pico luminoso para el lado del vórtice, y la
       irregularidad la producen los baches, no la posición en x. */
    float techo = mix(uCeilL, 1.0, smoothstep(0.06, 0.58, wx));
    /* NORMALIZADO: sin el divisor, la compresión también apagaba la DERECHA (f=1
       caía a 0.63) y la jerarquía izquierda/derecha se aplanaba a 1.3×. Así
       g(techo)=techo exacto ⇒ donde el techo vale 1 la función es identidad y el
       lado luminoso conserva sus paradas altas. */
    const float A = 1.6;
    f = techo * (1.0 - exp(-A * f / max(techo, 0.001))) / (1.0 - exp(-A));

    /* ── RAMPA por segmentos (no un mix de 2 hexes: los medios salen sucios) ── */
    vec3 col = uC0;
    col = mix(col, uC1, smoothstep(0.00, 0.14, f));
    col = mix(col, uC2, smoothstep(0.12, 0.34, f));
    col = mix(col, uC3, smoothstep(0.32, 0.56, f));
    col = mix(col, uC4, smoothstep(0.54, 0.78, f));
    col = mix(col, uC5, smoothstep(0.80, 0.93, f));
    col = mix(col, uC6, smoothstep(0.94, 1.00, f));

    /* ── CORTINAS verticales (están en la referencia): la escena parece fotografiada
          dentro de un marco, no un blob centrado flotando. ── */
    float curtain = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.05, 1.0 - uv.x);
    col *= mix(0.70, 1.0, curtain);
    col *= 1.0 - 0.22 * pow(length((uv - 0.5) * vec2(1.05, 1.0)), 2.2);

    /* ── DITHER (Interleaved Gradient Noise, Jimenez): un gradiente oscuro y suave
          en 8 bits SIEMPRE bandea. Anclado a gl_FragCoord ⇒ no hierve. ±0.5 LSB. ── */
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    col += (ign - 0.5) * (uDither / 255.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

type HeroLiquidoProps = {
  /** Velocidad global de la deriva (1 = spec aprobada). */
  speed?: number;
  /** Tamaño de las masas (mayor = masas más grandes y difusas). */
  scale?: number;
  /** Foco principal en uv medido desde arriba-izquierda. */
  focus?: [number, number];
  /** Masa secundaria (rompe la diagonal única del encuadre). */
  focus2?: [number, number];
  /** Centro del pozo oscuro: la zona del vórtice. */
  well?: [number, number];
  wellRadius?: number;
  /** Techo de densidad de la mitad izquierda: bajarlo apaga el azul detrás del texto. */
  ceilLeft?: number;
  /** Puntero normalizado (-1..1) del singleton del hero — para la advección. */
  pointer?: { tx: number; ty: number };
  intensity?: number;
  contrast?: number;
  warp?: number;
  /** Amplitud del dither en LSB (subir a 1.5 si aparece banding en el panel del owner). */
  dither?: number;
};

function HeroLiquido({
  speed = 1,
  scale = 1,
  // Foco detrás-abajo-derecha del nudo: contraluz que lo ANCLA en vez de aplastarlo.
  focus = [0.88, 0.62],
  focus2 = [0.64, 0.16],
  well = [0.75, 0.46],
  wellRadius = 0.46,
  ceilLeft = 0.68,
  pointer,
  /* 1.00 y no 1.12: con las masas recorriendo la sección hay instantes en que se
     agrupan, y ahí el encuadre picaba a ~39% de azul (tope 34%). El pico manda,
     no el promedio. */
  intensity = 1.0,
  contrast = 1.0,
  warp = 1.18,
  dither = 1.0,
}: HeroLiquidoProps) {
  const gl = useThree((s) => s.gl);
  const matRef = React.useRef<THREE.ShaderMaterial>(null);
  const bufSize = React.useRef(new THREE.Vector2());
  /* Puntero RETRASADO + velocidad acumulada: la tinta no persigue al cursor, es
     EMPUJADA por él y sigue disipándose después. El vórtice ya reacciona a la
     posición del puntero; si el fondo hiciera lo mismo, todo se sentiría pegado al
     mouse. Acá el fondo responde a la derivada y con otro tiempo característico. */
  const lag = React.useRef(new THREE.Vector2(0, 0));
  const prev = React.useRef(new THREE.Vector2(0, 0));
  const vel = React.useRef(new THREE.Vector2(0, 0));

  /* Los uniforms se construyen UNA vez con neutros y NUNCA se mutan desde acá: el
     React Compiler prohíbe modificar un valor memoizado. Todo (props incluidas) se
     escribe por el ref del material dentro de useFrame — patrón idiomático de R3F,
     costo despreciable (una decena de floats) y sin recompilar el programa. */
  const uniforms = React.useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uScale: { value: 1 },
      uIntensity: { value: 1 },
      uContrast: { value: 1 },
      uWarp: { value: 1 },
      uDither: { value: 1 },
      uFocus: { value: new THREE.Vector2(0.88, 0.62) },
      uFocus2: { value: new THREE.Vector2(0.64, 0.16) },
      uWell: { value: new THREE.Vector2(0.75, 0.46) },
      uWellR: { value: 0.46 },
      uCeilL: { value: 0.34 },
      uPtr: { value: new THREE.Vector2(0, 0) },
      uPtrVel: { value: new THREE.Vector2(0, 0) },
      uPtrAmp: { value: 0.075 },
      uPtrSigma: { value: 0.15 },
      uPtrStir: { value: 2.8 },
      uC0: { value: srgb(RAMP.vacio) },
      uC1: { value: srgb(RAMP.aire) },
      uC2: { value: srgb(RAMP.insinuacion) },
      uC3: { value: srgb(RAMP.profunda) },
      uC4: { value: srgb(RAMP.cuerpo) },
      uC5: { value: srgb(RAMP.cresta) },
      uC6: { value: srgb(RAMP.nucleo) },
    }),
    [],
  );

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uSpeed.value = speed;
    u.uScale.value = scale;
    u.uIntensity.value = intensity;
    u.uContrast.value = contrast;
    u.uWarp.value = warp;
    u.uDither.value = dither;
    u.uFocus.value.set(focus[0], focus[1]);
    u.uFocus2.value.set(focus2[0], focus2[1]);
    u.uWell.value.set(well[0], well[1]);
    u.uWellR.value = wellRadius;
    u.uCeilL.value = ceilLeft;
    if (pointer) {
      const dt = Math.min(delta, 0.05);
      prev.current.copy(lag.current);
      // Posición con lag τ=180 ms: la tinta va DETRÁS del cursor.
      const aPos = 1 - Math.exp(-dt / 0.18);
      lag.current.x += (pointer.tx - lag.current.x) * aPos;
      // Sin negar: el shader ya invierte el eje (gl_FragCoord.y crece hacia arriba).
      // Negar en los dos lados dejaba la influencia en el espejo vertical del cursor.
      lag.current.y += (pointer.ty - lag.current.y) * aPos;
      // Velocidad acumulada con decaimiento τ=1.6 s ⇒ estela perceptible ~3-4 s
      // aun con el mouse quieto (criterio de desacople del design-director).
      const decay = Math.exp(-dt / 1.6);
      vel.current.x = vel.current.x * decay + (lag.current.x - prev.current.x);
      vel.current.y = vel.current.y * decay + (lag.current.y - prev.current.y);
      u.uPtr.value.copy(lag.current);
      u.uPtrVel.value.copy(vel.current);
    }
    // gl_FragCoord vive en píxeles del DRAWING BUFFER (no CSS) ⇒ uRes debe serlo.
    gl.getDrawingBufferSize(bufSize.current);
    u.uRes.value.copy(bufSize.current);
  });

  return (
    <ScreenQuad renderOrder={-1000}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        transparent={false}
      />
    </ScreenQuad>
  );
}

export { HeroLiquido, RAMP };
