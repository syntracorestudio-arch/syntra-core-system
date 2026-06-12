# SYNTRA COLOR SYSTEM & DEPTH SPEC v1

> Target path in repo: `projects/syntra-core-website/docs/specs/syntra-color-depth-spec.md`
> Scope: capa visual y sistema de uso del color + profundidad. NO cambia paleta de identidad, NO cambia IA, NO rediseña secciones.

---

## 1. Core Philosophy

El azul SYNTRA deja de ser pintura y pasa a ser señal. Hoy el azul aparece en badges, títulos, íconos, bordes y botones por igual: cuando todo es azul, nada destaca, y la página se aplana a una sola capa. La regla que ordena todo este sistema es:

**El azul marca acción, inteligencia y resultado. Nada más.** Todo lo demás es neutro. La profundidad no la dan objetos nuevos: la dan capas de oscuridad, glow ambiental controlado y contraste de foco. La identidad no cambia — cambia la disciplina con que se usa.

Tres principios irrenunciables:
1. **Escasez del acento.** Regla 90/10: máximo ~10% de la superficie visible lleva azul.
2. **Profundidad por capas, no por adornos.** El fondo tiene niveles de elevación; el contenido flota sobre ellos.
3. **El glow es funcional.** Solo brilla lo que es importante (foco, IA, acción). El glow nunca es decoración ambiental sin propósito.

---

## 2. Color Roles Definition

> Los valores hex de azul son los de identidad SYNTRA existentes. Si los tokens actuales del repo difieren levemente, conservar los del repo y solo adoptar los ROLES. Los neutros sí se definen aquí para construir la escala de profundidad.

### Primary Accent — acción y foco
- Token: `accent-primary` = `#3B82F6`
- Uso exclusivo: CTA primario, el foco único de cada sección, el nodo IA, la partícula de ejecución.
- Es el azul más saturado de la pantalla. Aparece poco y siempre significa "esto importa / esto es accionable".

### Secondary Accent — soporte e inteligencia
- Token: `accent-secondary` = `#60A5FA` (highlight más claro del mismo azul)
- Uso: highlights de nodos secundarios, estados activos sutiles, detalle de iconografía de IA. Soporta al primario, nunca compite con él.

### Background System (escala de profundidad — base oscura)
- `bg-core` = `#08080C` — base del sistema, el plano más profundo.
- `bg-raised` = `#0E1119` — fondo de secciones elevadas / zonas de contenido.
- `bg-sunken` = `#060609` — zonas hundidas (separadores, pies), para crear valles.

### Surface System (cards / containers, elevación sobre el fondo)
- `surface-1` = `#0E1119` — card en reposo.
- `surface-2` = `#141823` — card elevada / hover.
- `surface-3` = `#1A1F2C` — capa de foreground (panel destacado, ej. lado "después" de Para quién).

### Border System
- `border-subtle` = `#1C212C` — bordes de cards y contenedores en reposo (casi imperceptible).
- `border-strong` = `#2A2E38` — bordes de elementos neutros con más presencia (nodos en reposo).
- `border-accent` = `#3B82F6` a 40–100% opacidad — SOLO en hover/active/foco. Nunca en reposo salvo el CTA.

### Glow System
- `glow-ambient` = `radial-gradient` de `#3B82F6` a 6% opacidad, blur 80–120px — profundidad de fondo detrás del foco de sección.
- `glow-focus` = `#3B82F6` a 18–26% opacidad, radio 80px — halo de elemento clave (nodo IA, panel "después").
- `glow-action` = `#3B82F6` a 45% opacidad, radio 110px — pico momentáneo (pulso del CTA al click, ejecución del grafo).
- Regla: el glow nunca se aplica a más de un foco por viewport.

### Neutral Text Scale
- `text-primary` = `#FFFFFF` — títulos.
- `text-secondary` = `#9BA1AD` — cuerpo / subtítulos.
- `text-muted` = `#7A8089` — labels, trust rows, estado "antes".

---

## 3. Usage Rules

### DO
- Usar `accent-primary` SOLO en: CTA primario, un foco por sección, nodo IA, partícula.
- Mantener todos los badges, íconos secundarios y bordes en reposo en NEUTRO.
- Construir cada sección sobre una de las capas de `bg-*` para crear ritmo de profundidad (no todas las secciones al mismo nivel).
- Aplicar `glow-ambient` detrás del elemento más importante de cada sección — uno solo.
- Reservar `border-accent` para estados interactivos (hover/focus/active).
- Usar la escala de texto para jerarquía: blanco solo en títulos, gris en cuerpo, muted en labels.

### DON'T
- NO poner azul en badges de sección (pasan a neutro: texto `text-secondary`, fondo `surface-1`, borde `border-subtle`).
- NO resaltar palabras del título en azul (los títulos son blancos).
- NO usar azul en íconos decorativos por defecto (neutros salvo el de IA).
- NO aplicar glow a cards genéricas ni a más de un foco por pantalla.
- NO usar bordes azules en reposo (excepto el CTA primario que es relleno azul).
- NO dejar todas las secciones en el mismo nivel de fondo (eso recrea la planitud).
- NO introducir colores fuera de la escala azul + neutros (sin verdes/violetas salvo el check de éxito existente `#34D399`).

---

## 4. Depth System

La profundidad se construye con cuatro mecanismos, sin agregar objetos:

**1. Capas de fondo (elevación tonal).** Las secciones alternan entre `bg-core`, `bg-raised` y `bg-sunken`. Una sección de contenido sobre `bg-raised` flota visiblemente sobre los separadores en `bg-sunken`. Esto crea valles y mesetas en el scroll en vez de un plano uniforme.

**2. Gradientes sutiles direccionales.** Cada sección puede tener un degradado vertical muy leve (de `bg-raised` arriba a `bg-core` abajo, ~4% de diferencia) que evita el "rectángulo de color plano" del template. Imperceptible conscientemente, decisivo en la percepción.

**3. Glow ambiental como background layer.** El `glow-ambient` se posiciona DETRÁS del contenido (z menor), creando un foreground (contenido nítido) y un background (glow difuso). Esa separación foreground/background es literalmente lo que falta hoy y lo que da sensación de espacio 3D.

**4. Foco por contraste.** El elemento importante de cada sección gana: surface más elevada (`surface-3`), glow de foco, y borde más presente. Todo lo demás baja un escalón de contraste. El ojo va al foco porque es el único punto "encendido" en un campo atenuado.

Regla maestra de profundidad: **en cada viewport debe existir un foreground claramente más cercano que el background.** Si todo está a la misma distancia, es PowerPoint.

---

## 5. Section Application Examples

### Hero
- Fondo: `bg-core` (`#08080C`).
- `glow-ambient` detrás del nodo IA del Synapse Graph.
- Azul SOLO en: CTA primario (relleno), nodo IA + su `glow-focus`, partícula.
- Título blanco puro (quitar resaltado azul de "crecer").
- Badge "Software Factory AI-Native": neutro.

### Services
- Fondo: `bg-raised` (eleva la sección sobre el Hero).
- Cards en `surface-1`, borde `border-subtle`. Íconos NEUTROS en reposo.
- Sin glow en reposo. El glow aparece solo en hover (ver §6).
- Romper el centrado del encabezado a alineación izquierda para crear un segundo acento asimétrico.

### Para quién
- Fondo: `bg-core` con `glow-ambient` por banda detrás del lado "después".
- Lado "antes": `text-muted`, sin surface, sin glow (estado apagado intencional). Darle algo más de cuerpo visual en V2 (ver nota) sin encender azul.
- Lado "después": `surface-3` + `glow-focus` + checks con acento. Es el único lado encendido.
- El conector usa `accent-secondary` tenue para marcar dirección.

### Nosotros
- Fondo: `bg-raised`.
- Los tres diferenciadores: íconos neutros, un solo acento azul en el ícono de "Proceso impulsado por IA" (es el que conecta con la identidad AI-native).
- Surface de la columna derecha a `surface-2` para elevarla sobre el texto y equilibrar el peso de columnas.

### Patrón general por sección
- Alternar `bg-raised` / `bg-core` sección a sección para ritmo de profundidad.
- Un `glow-ambient` por sección, detrás del foco.
- Un solo elemento con azul de acento por sección.

---

## 6. Interaction Color Behavior (hover / focus / active)

### Cards
- Reposo: `surface-1`, `border-subtle`, sin glow.
- Hover: eleva a `surface-2`, `border` transiciona hacia `border-accent` 40%, aparece `glow-focus` tenue siguiendo al cursor (spotlight). Transición 180ms.
- Active/press: leve descenso de elevación.

### CTA primario
- Reposo: relleno `accent-primary`, sin borde.
- Hover: fondo a `#4F8FF7`, brillo interno que barre izq→der (200ms), flecha +4px.
- Active/click: pulso `glow-action` que emana del borde (300ms).

### CTA secundario
- Reposo: transparente, `border-strong`.
- Hover: `border` a `border-subtle` claro, fondo `surface-1`. SIN azul.

### Focus (accesibilidad)
- Anillo de foco visible en `border-accent` para navegación por teclado, en todos los interactivos.

### Links / nodos
- Hover de nodo: borde a `border-accent` 100%, label sube opacidad, resalta su path. Resto atenúa a 30%.

Regla de interacción: **el azul puede aparecer en hover donde no estaba en reposo** — es la recompensa al tacto, la señal de que el elemento está vivo. Eso es lo que separa "producto" de "lámina".

---

## 7. Premium Feel Principles

1. **El color es bisturí, no pintura.** Stripe/Linear/Vercel usan su acento en <10% de la superficie. Adoptar esa escasez es el cambio más premium y más barato.
2. **Profundidad en cada pantalla.** Siempre un foreground y un background distinguibles. Sin capas, es presentación.
3. **Neutros que no son grises planos.** La escala de superficies (`surface-1/2/3`) da elevación; el negro `bg-core` da densidad. El gris azulado plano actual es lo que lee "template".
4. **El movimiento revela el color.** El azul que aparece en hover/reveal hace que la interfaz se sienta reactiva.
5. **Consistencia ritual.** Un foco por sección, un glow por viewport, un acento por bloque. La repetición de la *regla* (no del formato) es lo que lee como sistema de diseño maduro.

---

## 8. Implementation Notes (for frontend engineer)

### Pre-flight
1. Confirmar dónde viven los design tokens actuales (`globals.css`, `tailwind.config`, archivo de theme). Adoptar el mecanismo existente; no introducir uno nuevo.
2. Confirmar los hex de azul de identidad ya en uso. Si difieren de `#3B82F6`/`#60A5FA`, conservar los del repo y mapear solo los ROLES.
3. Confirmar sistema de estilos (Tailwind / CSS Modules / vanilla).

### Cómo aplicar
- Definir los tokens neutros y de glow como CSS custom properties / theme tokens centralizados. Un solo punto de verdad.
- Migrar los usos dispersos de azul a los roles: auditar cada aparición de azul actual y reclasificarla como accent-primary (queda), o neutralizarla (badge, ícono, borde en reposo → token neutro).
- Aplicar fondos por capa a nivel de contenedor de sección, no global.
- Glows como pseudo-elementos o divs de fondo con `pointer-events: none`, `aria-hidden`, posicionados detrás del contenido.
- Animaciones de color/glow solo sobre `opacity` y `transform` / `background` (evitar reflow).

### Performance & a11y
- Glows vía CSS (`radial-gradient` + `blur`), sin imágenes.
- Respetar `prefers-reduced-motion`: glows estáticos, sin barridos ni pulsos.
- Verificar contraste AA del texto neutro sobre cada capa de fondo (especialmente `text-muted` sobre `bg-core` y el estado "antes").
- No animar `box-shadow`/`filter` en bucle continuo en mobile (coste de GPU).

### Fuera de scope
- Cambiar la paleta de identidad (los azules se mantienen).
- Introducir colores nuevos (salvo el check de éxito existente).
- Rediseñar IA, estructura o copy.
- Crear secciones nuevas.
- Tocar SEO, metadata, formulario, panel.

---

## Principio final

No se cambia la identidad visual de SYNTRA. Se cambia la *gramática* con que se usa: el azul pasa de estar en todos lados (estética dispersa) a marcar exactamente lo que importa (sistema de experiencia), y la profundidad pasa de inexistente a estructural. Misma marca, misma paleta — pero ahora el color trabaja.