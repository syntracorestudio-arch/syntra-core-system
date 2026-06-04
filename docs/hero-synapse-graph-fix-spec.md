# Hero Synapse Graph — FIX Spec v1

> Target path in repo: `/docs/hero-synapse-graph-fix-spec.md`
> Scope: completar la implementación parcial del Synapse Graph en el Hero. NO rediseña layout, NO cambia color system, NO cambia el sistema de motion base. Solo cierra la brecha entre lo implementado (cascarón) y lo especificado (sistema vivo).

---

## Objetivo

El Hero ya tiene: layout 2 columnas, hexágonos, motion base. Le falta lo que convierte el cascarón en sistema: nodos con significado, conexiones, flujo, jerarquía y la eliminación del contenedor que hoy parece placeholder. Este fix completa eso sin tocar nada más.

---

## Estado actual (lo que hay) vs estado objetivo (lo que falta)

| Elemento | Estado actual | Estado objetivo |
|----------|---------------|-----------------|
| Hexágonos | Huecos, sin etiqueta, sin significado | Nodos con label de negocio real |
| Conexiones | No existen | Líneas dirigidas entre nodos |
| Jerarquía | Todos los hexágonos iguales | Nodo IA dominante (mayor + glow) |
| Contenedor | Caja gris redondeada tipo card → efecto "placeholder roto" | Eliminado; graph directo sobre el fondo |
| Label "IA" | Texto suelto sin pertenecer a un nodo | Etiqueta del nodo IA central |
| Flujo | Inexistente | Micro-animación de partícula entre nodos |

---

## Pre-flight (bloqueante)

1. Localizar el componente actual del visual del Hero (probable: `src/components/marketing/hero/hero-visual.tsx` o `synapse-graph.tsx`). Anotar ruta real.
2. Confirmar si la animación base usa Framer Motion o CSS/RAF. Mantener el mismo mecanismo; NO introducir otro.
3. Confirmar tokens de color existentes (azul accent, neutros, glow). Reusar; NO crear nuevos.
4. Identificar el contenedor gris que envuelve los hexágonos (la "card") para removerlo sin romper el layout 2 columnas.

Si 1–4 no se confirman, detener y reportar.

---

## 1. Semantic Nodes (CRÍTICO)

Convertir cada hexágono hueco en un nodo con significado. Cinco nodos:

| Nodo ID | Label visible | Rol en el sistema | Jerarquía |
|---------|---------------|-------------------|-----------|
| `node-lead` | Lead | Entrada: captación | Secundario |
| `node-consulta` | Consulta | Entrada: consulta entrante | Secundario |
| `node-ia` | IA | Procesamiento central | **Dominante** |
| `node-crm` | CRM | Almacenamiento / registro | Secundario |
| `node-accion` | Acción | Salida: respuesta/turno enviado | Secundario |

- Cada nodo lleva su label visible (no oculto). Sin label, un nodo no comunica y viola la Rule of Meaning.
- El label "IA" actual deja de ser texto suelto y pasa a ser el label del `node-ia`.
- Layout sugerido: dos nodos de entrada a la izquierda (`lead`, `consulta`) → `node-ia` al centro → dos nodos de salida a la derecha (`crm`, `accion`). Flujo izquierda → derecha.

### Rule of Meaning
Todo elemento del graph debe responder "¿qué parte del sistema representa?". Si un hexágono o adorno no tiene respuesta, se elimina o se degrada a soporte visual (conexión/fondo). No se permiten nodos decorativos sin función.

---

## 2. Flow Connections

- Trazar líneas que conecten: `lead → ia`, `consulta → ia`, `ia → crm`, `ia → accion`.
- Dirección de flujo clara: las líneas nacen en entradas, convergen en IA, divergen hacia salidas. Izquierda → centro → derecha.
- Líneas en reposo: color neutro tenue (token de borde sutil existente). No azul en reposo.
- Jerarquía visual: `node-ia` es el punto de convergencia de todo el flujo — es el centro gravitacional del graph.

---

## 3. Visual Clarity — eliminar el "placeholder box"

- **Eliminar el contenedor gris/card** que hoy envuelve los hexágonos. Es la causa principal del efecto "imagen no cargada".
- El graph se integra **directamente sobre el fondo del Hero** (`bg-core`), sin caja, sin borde, sin fondo de surface propio.
- Permitir bleed: el graph puede extenderse hasta el borde derecho del viewport (el Hero ya debe tener `overflow-x: hidden`).
- Glow ambiental azul tenue (token glow existente) detrás del `node-ia`, directamente sobre el fondo — reemplaza visualmente a la caja como "ancla" del graph, pero con profundidad en vez de borde.

---

## 4. State System

Tres estados, usando el mecanismo de motion ya presente (no introducir otro):

### idle (reposo)
- Nodos visibles con relleno neutro, label tenue.
- `node-ia` con latido lento (escala sutil) y glow base.
- Conexiones en color neutro, sin partícula.

### active flow (micro animación suave)
- Una partícula (azul accent existente) recorre el flujo: entra por un nodo de entrada → viaja a `ia` → sale hacia un nodo de salida.
- El nodo por el que pasa la partícula se ilumina brevemente.
- Loop lento (~6-7s), suave, nunca frenético. Reusar el easing del motion base.

### focus (IA destacado)
- `node-ia` en su punto de mayor glow y escala.
- Es el pico del ciclo (cuando la partícula llega a IA) o el estado al hover del graph, según lo que el motion base ya soporte.

### Accesibilidad
- `prefers-reduced-motion`: mostrar el graph en estado idle estático (nodos + conexiones + labels + glow base), sin partícula ni latido. Obligatorio.

---

## 5. Mobile

- Mantener el comportamiento responsive ya existente del Hero.
- Si el graph de 5 nodos no entra en mobile, degradar a 3 nodos en línea: `Entrada → IA → Acción`, conservando labels, conexión y la partícula. Sin caja, igual que desktop.

---

## Archivos afectados

**Modificar**
- Componente del visual del Hero (ruta de Pre-flight #1): rellenar nodos, agregar labels, conexiones, partícula, estados; eliminar el contenedor card.

**No tocar**
- Layout 2 columnas del Hero.
- Bloque de texto, título, CTAs, trust row.
- Color system / tokens.
- Mecanismo de motion base (se usa el existente).
- Cualquier otra sección.

---

## Criterio de éxito

- Los 5 hexágonos tienen label de negocio visible y rol definido.
- Existen conexiones dirigidas que convergen en IA.
- `node-ia` es visiblemente dominante (tamaño + glow).
- El contenedor gris tipo card YA NO existe; el graph vive sobre el fondo.
- Hay una partícula que recorre el flujo en loop suave.
- En reposo el sistema "late" en el nodo IA.
- `prefers-reduced-motion` muestra estado idle estático.
- Ningún elemento del graph queda sin significado (Rule of Meaning).
- El layout, los tokens y el motion base permanecen sin cambios.

---

## Fuera de scope (NO TOCAR)

- WebGL / Three.js / canvas / partículas físicas pesadas.
- Rediseño de UI, layout o tipografía del Hero.
- Cambios al color system o a los tokens.
- Reescritura del sistema de motion (solo se completa con el mecanismo actual).
- Otras secciones (Servicios, Para quién, etc.).
- SEO, metadata, formulario, panel.
- Quitar el azul de la palabra "crecer" del título (es otro fix; no se aborda aquí salvo que se indique).