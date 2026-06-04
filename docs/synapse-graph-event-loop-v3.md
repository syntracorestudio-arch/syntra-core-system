# Synapse Graph — Event Loop Simulator v3

> Target path in repo: `/docs/synapse-graph-event-loop-v3.md`
> Scope: evolucionar el Synapse Graph de "diagrama con estados" a "simulación del sistema en ejecución" mediante un event loop secuencial. NO cambia layout, tokens, estructura de nodos, íconos ni mecanismo de motion. Construye sobre Material System v2.

---

## Objetivo

El grafo ya tiene 5 nodos con material glass, IA dominante y partícula. Este fix lo convierte en una simulación de event loop: cada nodo se activa en secuencia narrativa representando un evento real del sistema (Lead entra → Consulta → IA procesa → CRM registra → Acción sale → reset). El azul deja de ser animación continua y pasa a ser señal de evento puntual.

Principio rector obligatorio: **cada glow = un evento del sistema. Si un elemento no representa un evento, no puede iluminarse.**

Tono: lento, intencional, "infraestructura real trabajando". NO frenético, NO demo. Loop de 6-10s.

---

## Pre-flight (bloqueante)

1. Confirmar componente: `src/components/marketing/hero/hero-visual.tsx`.
2. Confirmar motion: SMIL (`animateMotion`) + CSS keyframes + `useReducedMotion` de Framer. Mantener.
3. Confirmar que Material System v2 (glass + profundidad + estados REST/ACTIVE/FOCUS) ya está implementado. Este fix se apoya en él; si no está, implementarlo primero.
4. Confirmar tokens: `accent-primary`, `accent-secondary`, `surface-2`, `border-strong`, `glow-focus`, `glow-ambient`.
5. Identificar cómo se dispara hoy el estado ACTIVE de un nodo (CSS class toggled, variant, animación SMIL) para encadenarlo en secuencia.

Si 1–5 no se confirman, detener y reportar.

---

## 1. Event Loop — definición técnica

Ciclo continuo de 6 fases. Duración total sugerida: 8s (dentro del rango 6-10s).

| Fase | Evento del sistema | Nodo activo | t (inicio) | duración activación |
|------|-------------------|-------------|-----------|---------------------|
| 1 | Lead generado | `node-lead` | 0.0s | 0.7s |
| 2 | Consulta recibida | `node-consulta` | 1.0s | 0.7s |
| 3 | IA procesa | `node-ia` (pico) | 2.2s | 1.2s |
| 4 | CRM registra | `node-crm` | 3.8s | 0.7s |
| 5 | Acción ejecutada | `node-accion` | 4.8s | 0.7s |
| 6 | Reset suave → idle | ninguno (solo IA late) | 5.8s | 2.2s hasta reinicio |

- La partícula SMIL existente se sincroniza con esta secuencia: viaja de cada nodo al siguiente, llegando justo cuando ese nodo entra en ACTIVE.
- Solapamiento permitido leve entre fin de una activación y la siguiente (transición fluida), pero NUNCA todos los nodos activos a la vez.
- Tras la fase 6, el loop reinicia desde fase 1.

---

## 2. Estados (heredados de Material System v2, aplicados por evento)

### IDLE (reposo)
- Nodo en material glass neutro, sin glow, ícono gris, sin azul.
- Es el estado de todos los satélites entre sus fases de activación.

### ACTIVE (evento ocurriendo)
- Glow `accent-primary` (radio ~40px, pico opacity ~0.5).
- Borde → `accent-primary`. Ícono → azul claro/blanco. Scale 1.0→1.08→1.0.
- Aparece SOLO durante la fase del nodo, luego retorna a IDLE (~400ms transición).

### IA FOCUS (permanente)
- IA es el único nodo con estado activo permanente (glow constante + anillo de pulso).
- En su fase (3), intensifica al pico: glow máximo + pulso reforzado = "procesamiento", el clímax del loop.
- Fuera de su fase, sigue latiendo suave (es el centro gravitacional que nunca se apaga).

---

## 3. Mapping UI → evento (regla de significado)

| Elemento visual | Evento del sistema que representa |
|-----------------|-----------------------------------|
| Glow de `node-lead` | Un lead entró al sistema |
| Glow de `node-consulta` | Una consulta fue detectada |
| Pico de `node-ia` | La IA está procesando/decidiendo |
| Glow de `node-crm` | Se registró el dato |
| Glow de `node-accion` | Se ejecutó la acción de salida |
| Partícula viajando | El dato moviéndose entre etapas |

Regla obligatoria: ningún glow ocurre sin un evento que lo justifique. Nada se ilumina "decorativamente".

---

## 4. Ghost System Labels (CAPA OPCIONAL — apagada por defecto)

> Esta capa es opcional y debe implementarse con un flag/prop que la deje DESACTIVADA por defecto. El grafo debe verse completo y premium SIN ella. Se activa solo para evaluación en vivo.

Si se activa:
- Una micro-etiqueta de texto aparece cerca del nodo activo durante su fase: "Lead detectado", "Procesando intención…", "Registrando en CRM", "Acción enviada".
- Opacidad muy baja (~0.4 máx). Tipografía pequeña, mono o sistema, color neutro tenue (NO azul).
- Fade in/out suave (~300ms), sincronizado con la fase del nodo.
- UNA sola label visible a la vez (la del nodo activo). Nunca dos.
- No es UI tradicional: sin caja, sin fondo, sin borde. Texto flotante tenue, "del sistema".
- Posición: junto al nodo activo, sin tapar el ícono ni la conexión.

Reglas de seguridad de esta capa:
- Por defecto OFF. El criterio de éxito del fix NO depende de ella.
- Si al evaluarla en vivo agrega ruido o compite con el titular del Hero, se deja OFF permanentemente sin tocar el resto del grafo.

---

## 5. Color behavior

- IDLE = neutro (gris). Sin azul.
- ACTIVE = azul `accent-primary` aparece como EVENTO temporal.
- IA = único azul persistente.
- Regla: el azul es evento, no decoración. Un satélite es gris hasta que su evento ocurre.

---

## 6. Reglas de consistencia del sistema

- Máximo 1 ciclo activo por loop (no múltiples partículas/secuencias simultáneas).
- No todos los nodos brillan al mismo tiempo. La activación es secuencial.
- IA es el centro gravitacional permanente (nunca se apaga del todo).
- El sistema siempre vuelve a idle (fase 6) antes de reiniciar.
- Timing lento e intencional (loop 6-10s). Sensación de backend trabajando, no de UI animada.
- "El sistema respira": ritmo desigual, pausas entre eventos, no metrónomo.

---

## 7. Implementación con el motion system actual (sin cambiarlo)

- Usar el mismo mecanismo que dispara ACTIVE en Material System v2, encadenado en secuencia temporal.
- Sincronización: la secuencia de activaciones y la partícula SMIL deben compartir línea de tiempo. Opciones, en orden de preferencia, según lo que el componente ya soporte:
  1. Si Material v2 usa CSS keyframes para ACTIVE: definir keyframes con `animation-delay` escalonado según la tabla de fases (0.0s, 1.0s, 2.2s, 3.8s, 4.8s) y `animation-duration` = duración del loop, para que el ciclo se repita en fase con la partícula.
  2. Si usa estado/variant controlado por JS: un timeline (puede ser un `requestAnimationFrame` o el mecanismo Framer ya presente) que setee el nodo activo según `t % loopDuration`.
- NO introducir una librería de animación nueva. Reusar SMIL + CSS + Framer.
- La partícula SMIL existente ajusta sus `keyTimes`/`begin` para alinear su llegada a cada nodo con el inicio de la fase de ese nodo.

---

## Accesibilidad

- `prefers-reduced-motion`: el event loop NO corre. Se muestra estado estático = todos los satélites en IDLE con material glass, IA con glow estático. Sin secuencia, sin partícula, sin ghost labels. Obligatorio.

---

## Mobile

- Conservar responsive existente.
- Si el grafo mobile es de 3 nodos, el event loop se reduce a 3 fases: Entrada → IA procesa → Acción. Mismo principio, menos fases.
- Ghost labels: OFF en mobile siempre (espacio insuficiente, riesgo de ruido alto).

---

## Archivos afectados

**Modificar**
- `src/components/marketing/hero/hero-visual.tsx`: secuenciar las activaciones en event loop, sincronizar partícula, (opcional, OFF) ghost labels.

**No tocar**
- Layout, texto, título, CTAs, trust row.
- Color system / tokens.
- Mecanismo de motion base.
- Estructura/cantidad de nodos (5).
- Íconos.
- Material System v2 (se apoya en él, no lo reescribe).
- Otras secciones.

---

## Criterio de éxito

- Los nodos se activan en secuencia narrativa (Lead→Consulta→IA→CRM→Acción→reset), no todos juntos.
- Cada activación coincide con la llegada de la partícula a ese nodo.
- IA tiene su pico de procesamiento como clímax del loop y nunca se apaga del todo.
- En reposo los satélites son neutros; el azul aparece solo como evento.
- El loop dura 6-10s y se siente lento/intencional, no frenético.
- El grafo se percibe como "sistema ejecutándose", no como diagrama con animación.
- Ghost labels implementados pero OFF por defecto; el grafo funciona sin ellos.
- `prefers-reduced-motion` muestra estado estático.
- Layout, tokens, motion base, estructura de nodos e íconos sin cambios.

---

## Fuera de scope (NO TOCAR)

- WebGL / 3D / canvas complejo.
- Nuevos íconos o ilustraciones.
- Cambios de layout, tokens, estructura de nodos, arquitectura.
- Nuevas dependencias de animación.
- Ghost labels ON por defecto (deben nacer apagados).
- Quitar el azul de "crecer" del título (fix aparte).
- Otras secciones, SEO, metadata, formulario, panel.