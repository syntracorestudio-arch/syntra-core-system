# Hero Synapse Graph — Icons & Flow FIX v2

> Target path in repo: `/docs/hero-synapse-graph-icons-fix.md`
> Scope: refinar el Synapse Graph YA funcional (nodos con label, conexiones, IA dominante, partícula). Agrega íconos dentro de los hexágonos, reagrupa los nodos en flujo izquierda→derecha, rompe la simetría plana y suma un anillo de pulso en el nodo IA. NO rediseña layout, NO cambia color system, NO cambia el mecanismo de motion.

---

## Objetivo

El grafo actual ya comunica un sistema (Lead, Consulta, IA, CRM, Acción conectados, con partícula). Este fix lo lleva de "buen diagrama simétrico" a "sistema de automatización que se entiende de un vistazo y se siente vivo", mediante 4 mejoras puntuales:
A) ícono dentro de cada hexágono, B) reagrupación en flujo izq→derecha, C) profundidad por capas (romper simetría), D) anillo de pulso en IA.

Mantiene el hexágono como contenedor (identidad de marca, nace del logo). El ícono aporta significado instantáneo SIN eliminar la forma.

---

## Pre-flight (bloqueante)

1. Localizar el componente del grafo del Hero (probable: `src/components/marketing/hero/synapse-graph.tsx` o `hero-visual.tsx`). Anotar ruta real.
2. Confirmar mecanismo de animación en uso (Framer Motion o CSS/RAF). Mantenerlo; NO introducir otro.
3. Confirmar de dónde salen los íconos del resto del sitio (las cards de Servicios/Para quién usan un set de íconos: lucide-react u otro). REUSAR ese mismo set; NO instalar uno nuevo.
4. Confirmar tokens de color/glow existentes. REUSAR; NO crear nuevos.

Si 1–4 no se confirman, detener y reportar.

---

## A. Íconos dentro de los hexágonos (glass nodes)

Cada nodo conserva su hexágono + su label visible debajo, y suma un ícono centrado dentro del hexágono.

| Nodo | Label | Ícono sugerido (set existente) | Tratamiento |
|------|-------|-------------------------------|-------------|
| `node-lead` | Lead | sobre / user-plus (entrada de contacto) | glass neutro |
| `node-consulta` | Consulta | mensaje / message-circle | glass neutro |
| `node-ia` | IA | chip / sparkles / cpu | DOMINANTE: ícono + glow azul |
| `node-crm` | CRM | base de datos / database | glass neutro |
| `node-accion` | Acción | rayo / check / send | glass neutro |

- "Glass": hexágono semitransparente (relleno con baja opacidad sobre el fondo) + borde de luz tenue (token de borde existente). NO usar surface sólido tipo card.
- El ícono usa color neutro en los satélites; en `node-ia` puede llevar el acento azul.
- Si el set de íconos del sitio no tiene un equivalente exacto, elegir el más cercano del MISMO set. No mezclar sets.
- El nodo IA puede conservar el texto "IA" junto al ícono, o solo el ícono si queda más limpio — preferir ícono + glow, label "IA" debajo como los demás.

---

## B. Reagrupar en flujo izquierda → derecha

Reemplazar la disposición en "X" simétrica por una lectura de flujo clara:

```
   ENTRADAS          PROCESO            SALIDAS
   (izquierda)       (centro)           (derecha)

   ◇ Lead  ┐                          ┌─ ◇ CRM
           ├──────►  ⬢ IA  ──────────┤
   ◇ Consulta ┘        (dominante)     └─ ◇ Acción
```

- `node-lead` y `node-consulta`: apilados a la izquierda (entradas).
- `node-ia`: centro, dominante.
- `node-crm` y `node-accion`: apilados a la derecha (salidas).
- Conexiones: las dos entradas convergen en IA; IA diverge hacia las dos salidas.
- La partícula viaja SIEMPRE izquierda→derecha: entra por una entrada → IA → sale hacia las salidas. Refuerza el sentido del flujo.

---

## C. Profundidad por capas (romper la simetría plana)

- Los 4 satélites NO deben quedar a distancia/tamaño idénticos respecto a IA (eso lee como diagrama técnico plano).
- Variación sutil: entradas un poco más cercanas a IA y ligeramente más tenues (opacidad ~85%); salidas un poco más abiertas y nítidas (100%). Diferencias pequeñas, no dramáticas.
- Tamaño de satélites: variación leve (±8%) entre ellos para evitar la grilla perfecta.
- `node-ia` siempre el mayor y el único con glow permanente.
- Objetivo: que el grafo se sienta orgánico/espacial, no un diagrama de Visio.

---

## D. Anillo de pulso en el nodo IA

- Cuando la partícula llega a `node-ia` (o en el latido del ciclo idle), un anillo concéntrico azul tenue se expande hacia afuera desde IA y se desvanece (scale 1→1.6, opacity 0.4→0, ~800ms).
- Refuerza la lectura "el cerebro está procesando".
- Reusar el mecanismo de motion existente. Bajo costo en SVG.
- En idle (sin partícula activa), el pulso puede repetir lento (~cada 3s) o quedar solo con el glow base — preferir un pulso lento para dar vida.

---

## State System (sin cambios respecto al fix anterior)

- **idle:** nodos visibles con ícono, label tenue, IA con glow + pulso lento.
- **active flow:** partícula recorre entrada→IA→salida; nodo tocado se ilumina; al llegar a IA dispara el anillo de pulso.
- **focus:** IA en pico de glow/escala.
- `prefers-reduced-motion`: estado idle estático — nodos + íconos + labels + conexiones + glow base, SIN partícula, SIN pulso, SIN latido. Obligatorio.

---

## Mobile

- Conservar el responsive ya existente.
- Si los 5 nodos no entran, degradar a 3 en línea horizontal: `Entrada → IA → Acción`, con íconos, label, conexión y partícula. Sin caja. Pulso de IA conservado.

---

## Archivos afectados

**Modificar**
- Componente del grafo del Hero (ruta de Pre-flight #1): agregar íconos, reposicionar nodos al flujo izq→derecha, aplicar variación de capas, agregar anillo de pulso.

**No tocar**
- Layout 2 columnas del Hero, texto, título, CTAs, trust row.
- Color system / tokens.
- Mecanismo de motion base.
- El set de íconos (se reusa el existente).
- Cualquier otra sección.

---

## Criterio de éxito

- Cada hexágono contiene un ícono del set existente + conserva su label.
- Los nodos están agrupados como entradas (izq) → IA (centro) → salidas (der), no en X simétrica.
- El flujo se entiende a primera vista; la partícula viaja izq→derecha.
- Los satélites tienen variación sutil de distancia/tamaño/opacidad (no grilla perfecta).
- IA dispara un anillo de pulso al recibir la partícula y/o late en idle.
- `prefers-reduced-motion` muestra estado idle estático.
- Layout, tokens, motion base e íconos del sitio permanecen sin cambios estructurales.

---

## Fuera de scope (NO TOCAR)

- WebGL / Three.js / canvas / 3D real / glassmorphism con blur pesado.
- Instalar un nuevo set de íconos o nuevas dependencias.
- Rediseño de UI, layout, tipografía o color system.
- Reescritura del sistema de motion.
- Quitar el azul de la palabra "crecer" del título (fix aparte).
- Otras secciones, SEO, metadata, formulario, panel.