# Live System — Spec de Motion Unificado

> Norte único de "vida visual" de la Home de SYNTRA CORE. Aprobado en
> `WEB-LIVE-SPEC` (2026-06-12), derivado de `WEB-LIVE-SYSTEM-RESET`.
> Cualquier motion nuevo de la Home **debe cumplir este spec o no entra**.
> Gate por sección: `design-system-guardian` (coherencia/no-drift) +
> `qa-performance-guard` (Lighthouse +95, CLS, reduced-motion).

---

## 0. Principio rector

**La página debe parecer trabajando, no decorada.** Norte narrativo: *El recorrido
de una consulta*. No animamos adornos; mostramos algo real que entra, se transforma
y queda resuelto.

---

## 1. El patrón: PENDIENTE → ACTIVO → HECHO

Un gesto = **algo entra → se transforma → queda resuelto**, disparado por **evento**
(entrar en viewport una vez, o un clic del usuario), corre **una sola vez**, y
termina en HECHO que **persiste**.

| Estado | Significado | Señal visual | Tokens (existentes) |
|---|---|---|---|
| **PENDIENTE** | en reposo, todavía no pasó | neutro, atenuado | `border-strong`, `text-muted-foreground`, dot gris |
| **ACTIVO** (transitorio) | el sistema está trabajando ESO ahora | acento azul que realza por **opacidad/scale** | `accent-primary` (`brand-electric`) |
| **HECHO** (persiste) | quedó resuelto, deja marca | cyan + check, **se queda encendido** | `accent-secondary`/`brand-cyan`, lucide `Check` |

**Dos reglas que lo hacen acción→resultado y no decoración:**

1. **Disparo por evento; por defecto un GESTO one-shot, nunca un loop perpetuo
   decorativo.** Excepciones de loop son acotadas y justificadas (ver §8): el
   "latido constante" del Hero (FROZEN) y, si se decide, la demo de Automatización
   (operación que corre sola). El loop nunca es el default.
2. **HECHO persiste.** El cierre queda encendido; no se apaga. Un gesto cuyo
   resultado no permanece no se registra como "resuelto".

---

## 2. Los tres momentos, representados

- **Una consulta ENTRA** → un objeto-consulta sobrio (una tarjeta/línea; **nunca**
  avatar, cara ni emoji) aparece desde un borde con `opacity` + `translate`.
  Copy: *"Entra una consulta"*.
- **El sistema TRABAJA** → el acento ACTIVO **recorre** los pasos, **uno encendido
  por vez**, con realce por opacidad/scale. Copy: *"Queda ordenada"* / *"El sistema
  responde"*.
- **Algo quedó HECHO** → estado final persistente: check cyan + label de cierre en
  lenguaje de cliente. Copy: *"Te llega el aviso"* / *"El cliente recibe respuesta"*.

---

## 3. Léxico único de 4 verbos (toda la Home)

El mismo protagonista (una **consulta de un cliente**) y los mismos 4 verbos
atraviesan la página, con la misma tipografía/acento, para que se lea como **un solo
sistema visto desde distintos ángulos**:

> **Entra una consulta → Queda ordenada → El sistema responde → Te llega el aviso**

Cero jerga visible. Prohibido: `pipeline`, `módulo`, `input/output`, `API`,
`workflow`, `CRM`, `arquitectura`, `sistema operativo`, `stack`. El **sujeto del
verbo de cierre es el negocio o su cliente, nunca el software** ("Te llega el aviso",
no "output enviado").

---

## 4. Aplicación por sección

| Sección | "Entra" | "Trabaja" | "Hecho" (persiste) | Disparo |
|---|---|---|---|---|
| **Proceso** *(piloto)* | paso 1 pendiente | la línea avanza y enciende cada paso | cada paso queda ✓ (checklist completo) | viewport |
| **Servicios — Web** | una visita entra a la web | clic → se captura | tarjeta "Nueva consulta" ✓ persiste | viewport |
| **Servicios — Automatización** | la consulta entra | recorre Entra→Se ordena→Avisa | los 3 quedan ✓ ("Te llega el aviso") | viewport |
| **Servicios — IA** | la consulta **llega** (animar entrada) | typing | "Respuesta enviada" ✓ (ya persiste) | viewport |
| **Casos** | — | el escenario del rubro **se ejecuta** al elegirlo | el último paso queda encendido | **clic** del usuario |
| **Contacto** | la consulta del usuario (sus clics) | el resumen se arma con sus selecciones | "Lista para revisar" (eco neutro, **no** veredicto) | input real |
| **Transiciones** | — | el resultado de una sección es el input visible de la siguiente | conector-puente + frase-bisagra | scroll |

---

## 5. Motion PERMITIDO

- **Solo `transform` (translate/scale) y `opacity`.**
- Disparo por **viewport** (`useInView`/`whileInView` con `once`) o por **clic**.
- **Un solo elemento ACTIVO por momento** dentro de un gesto.
- **Máx. 1 zona-loop protagonista por viewport** (las demás en reposo neutro).
- **Los loops pausan fuera de viewport** (IntersectionObserver togglea
  `animation-play-state` o corta el `repeat`). No negociable al escalar.
- Scroll como **disparador** de gestos one-shot.
- Velocidad premium: lenta e intencional (`EASE_PREMIUM`). Observable y serena.

---

## 6. Motion PROHIBIDO

- Animar `box-shadow`, `filter`, `width`, `height`, `top/left`, `margin`,
  `background-color` — **especialmente en loop, pero también el default es evitarlos**.
- **Loop perpetuo decorativo** (el "pulso azul sin fin").
- Más de un foco/glow encendido por viewport; más de una zona-loop co-visible.
- **Scroll-scrubbing** atado al dedo, parallax decorativo, pin/scroll-jacking.
- Caras/avatares/emojis para la consulta, confeti, sonido, rebotes elásticos.
- Dramatizar el **mecanismo interno** (CRM, "IA que decide", coordenadas, "pipeline").
- Animar el envío del form como "analizando/generando diagnóstico" (over-promise).

---

## 7. Qué queda FROZEN

- **Hero / Synapse Graph** (motion + estructura), **Canvas / Sistema** (motion +
  estructura) y **Nosotros**. No reabrir sin descongelamiento nominal del owner.
- Excepción ya aprobada: el **copy** del Canvas se limpia en `WEB-LIVE-JARGON`
  (content-only), **sin tocar su motion ni su estructura**.

---

## 8. Una sola familia de motion (fin de las animaciones aisladas)

Hoy hay **3 dialectos** del mismo gesto: CSS `sys-*` (7s, anima `box-shadow`),
SMIL del Hero (8s), framer `times[]` de la demo de Automatización (6.3s). El spec
exige **una sola fuente de verdad** y resuelve la contradicción del box-shadow:

- **`sys-*` = inspiración ESTÉTICA, no mecánica.** Los `sys-*` actuales pueden
  inspirar la estética visual —nodos, conectores, puntos, grilla—, pero la mecánica
  nueva de vida debe implementarse con **`opacity`/`transform` únicamente**.
- **No replicar keyframes `sys-*` que animen `box-shadow`.** El glow/realce se logra
  con opacidad (p. ej. una capa `::after` o un overlay de acento que sube/baja
  `opacity`), no con `box-shadow` animado.
- Si se crea un **componente compartido tipo `LiveFlow`**, debe usar
  `opacity`/`transform`, **`reduced-motion` explícito** (rama `useReducedMotion()`
  que pinta el estado final completo) y **estado final HECHO persistente**. Se
  consume por data; las secciones no reescriben la mecánica.
- **No crear keyframes/prefijos nuevos por sección** (= dialecto nuevo). Extender la
  familia existente o el componente compartido.
- Técnica por categoría: reveals = variants de `motion.ts`; gestos "vida" =
  `LiveFlow`/opacity+transform; SMIL queda **congelado al Hero**.

### Constantes a centralizar en `lib/motion.ts`

El patrón **por defecto es GESTO** (entra, trabaja, termina en HECHO), no loop:

- **`SYSTEM_GESTURE_DURATION`** — duración del gesto one-shot (entra→trabaja→hecho).
  Es la constante por defecto del patrón.
- **`SYSTEM_STAGGER`** — escalonado entre pasos/nodos de un gesto.
- **`SYSTEM_LOOP_DURATION`** — *solo* para los casos excepcionales con loop
  justificado (p. ej. Automatización si se decide mantenerla en loop). Separada a
  propósito para que la regla default sea **gesto, no loop**.
- Reusar `EASE_PREMIUM`, `DURATION`, `VIEWPORT_ONCE` ya existentes. **Ninguna sección
  define su propio número de timing/curva.**

---

## 9. Accesibilidad / performance (gate duro)

- **`reduced-motion` = estado final COMPLETO y legible** en cada sección (no el
  estado inicial vacío). Framer requiere rama `useReducedMotion()` explícita; los
  loops CSS los cubre el kill-switch global.
- **CLS = 0:** todo lo que "aparece" entra por opacity/transform dentro de un
  contenedor con **alto reservado** (`min-h`/`aspect-ratio`); nunca
  `display:none→block` ni insertar nodos que empujen el flujo.
- **Objetivo Lighthouse +95 mobile.** `qa-performance-guard` valida Lighthouse, CLS,
  reduced-motion y listeners passive antes de cerrar cada sección.

---

## 10. Comprensión para clientes no técnicos (regla de oro)

> Se anima el **beneficio entendible** (entra una consulta, queda ordenada, te llega
> el aviso, el cliente recibe respuesta, una tarea se completa), **nunca el mecanismo
> interno**. Toda animación lleva un label en lenguaje de cliente. Si para entender la
> animación hay que saber qué es un CRM o un pipeline, **no va**.

---

## 11. Gobierno y secuencia

- **Commits atómicos**, uno por sección.
- Roadmap: este spec → `WEB-LIVE-JARGON` (copy Canvas) →
  **WEB-010 Proceso (piloto del patrón)** → Servicios (elevar Web/Automatización) →
  Casos (ejecuta al seleccionar) → Transiciones → Contacto (microdiagnóstico; toca
  backend). Hero/Canvas-motion/Nosotros permanecen FROZEN salvo descongelamiento.
- Cada sección "de vida" pasa el gate doble bloqueante (guardian + performance).
