# "Para quién" V1 — Implementation Spec (Antes / Después)

> Target path in repo: `projects/syntra-core-website/docs/specs/para-quien-v1-spec.md`
> Scope: rediseñar la sección "Pensado para tu rubro" como 4 bandas full-width antes/después alternadas con reveal al entrar en viewport. No tocar otras secciones.

---

## Objetivo

Reemplazar la grilla de 4 cards de la sección "Para quién" por 4 bandas full-width. Cada banda contrasta un estado "antes" (dolor del rubro, apagado) contra un estado "después" (soluciones, iluminado con acento azul), reveladas una vez al entrar en viewport con un beat narrativo entre ambos lados. Romper el patrón de grilla de cards del resto del sitio.

---

## Criterio de éxito

- La sección ya no usa grilla de cards; usa 4 bandas full-width apiladas.
- Cada banda muestra antes (gris) y después (azul/iluminado) con alternancia de lado izq/der por índice par/impar (desktop).
- El reveal de cada banda ocurre una sola vez al entrar en viewport, con beat de 300ms entre lado "antes" y lado "después".
- El contenido textual proviene exclusivamente de la tabla de Contenido de esta spec.
- Sin layout shift (CLS = 0 en la sección).
- Funciona en 390 / 768 / 1024 / 1440px sin overflow horizontal.
- `prefers-reduced-motion` respetado: estado final visible sin secuencia.

---

## Pre-flight (bloqueante — verificar antes de codear)

1. Confirmar framework/router en `package.json` (Next App Router vs Pages).
2. Confirmar si `framer-motion` está en `dependencies`.
   - Si existe → usarlo para reveals (viewport detection + variants + stagger).
   - Si NO existe → NO instalarlo. Usar IntersectionObserver + transiciones CSS.
3. Confirmar sistema de estilos (Tailwind / CSS Modules / vanilla). Usar el existente.
4. Localizar el archivo de la sección "Para quién" actual (candidatos: `src/components/sections/para-quien*.tsx`, `src/components/marketing/**`, o inline en `src/app/page.tsx`). Anotar ruta real.
5. Localizar los íconos de rubro actuales (inmobiliaria, jurídico, clínica, PyME) y el componente de check usado en Servicios/Para quién. Anotar rutas para reutilizar.
6. Confirmar tokens de color/tipografía existentes para no duplicar.

Si 1–6 no se confirman, detener y reportar. No asumir rutas.

---

## Contenido (FUENTE DE VERDAD ÚNICA)

> Esta tabla es la única fuente de verdad de textos para la sección.
> NO reutilizar textos del modelo de cards anterior.
> Los textos "antes" y "después" se toman exactamente de aquí.
> Columna Origen: `[sitio]` = solución ya presente en el sitio actual (conservar literal). `[nuevo]` = texto "antes" creado para esta spec (redactado en tono del sitio, honesto, no alarmista).

| Idx | Rubro | Antes (dolor) `[nuevo]` | Después (3 soluciones) `[sitio]` |
|-----|-------|------------------------|----------------------------------|
| 0 | Inmobiliarias | "Respondiendo las mismas consultas a mano, una por una." | Catálogo de propiedades con buscador y filtros · Captación de interesados desde la web · Respuestas y seguimiento automatizados |
| 1 | Estudios jurídicos | "Consultas que entran desordenadas y tiempo administrativo que se pierde." | Sitio institucional sobrio y confiable · Formularios de consulta calificada · Automatización de turnos y seguimiento |
| 2 | Clínicas y profesionales | "Idas y vueltas constantes con pacientes para coordinar cada turno." | Web clara con servicios y especialidades · Solicitud de turnos online · Recordatorios y mensajes automáticos |
| 3 | Empresas de servicios y PyMEs | "Tareas repetitivas que consumen horas todos los días." | Sitio o sistema a medida de tu operación · Captación y gestión de clientes · Automatización de procesos internos |

---

## Componentes nuevos

### `IndustryBand`
- Ruta: `src/components/marketing/para-quien/industry-band.tsx` (ajustar al patrón del repo).
- `"use client"` si App Router (usa viewport detection / observer).
- Un único componente instanciado 4 veces con props. NO crear un componente por rubro.
- Props: `index: number`, `industry: string`, `icon`, `pain: string`, `solutions: string[]`, `reversed: boolean`.
- `reversed` deriva de `index % 2` (par = antes a la izquierda; impar = después a la izquierda). El lado "después" es siempre el iluminado, sin importar el lado físico.
- Estructura interna: rótulo (ícono + nombre rubro) → lado "antes" → conector → lado "después" (título + checks).

### `TransformConnector`
- Ruta: `src/components/marketing/para-quien/transform-connector.tsx`.
- Elemento decorativo: línea/flecha que apunta de "antes" hacia "después".
- Desktop: horizontal. Mobile: vertical (apunta hacia abajo).
- `aria-hidden`. Sin interacción.

---

## Componentes a modificar

### Sección "Para quién" actual (ruta de Pre-flight #4)
- Conservar el encabezado de sección (badge "Para quién" + título "Pensado para tu rubro" + subtítulo) usando el componente de encabezado existente.
- Eliminar la grilla de 4 cards.
- Renderizar 4 `<IndustryBand />` apiladas, alimentadas con la tabla de Contenido.
- No tocar el ancla/id de la sección (preservar navegación del navbar).

---

## Layout desktop / tablet / mobile

### Desktop (>=1024px)
- Bandas full-width, dos lados horizontales: antes | conector | después.
- Ancho de cada lado ~50%, conector centrado entre ambos.
- Alternancia: idx par → antes izquierda / después derecha. idx impar → después izquierda / antes derecha.
- Espaciado vertical entre bandas: 96–120px.
- `min-height: 420px` por banda.
- Lado "después" con glow ambiental azul tenue (ver Estado de banda activa).

### Tablet (768–1023px)
- Mantener horizontal si entra cómodo.
- Si aprieta, adoptar el modo vertical de mobile. Sin estados intermedios.
- `min-height: 380px` por banda.

### Mobile (<768px)
- Layout vertical dentro de cada banda: rótulo arriba → "antes" (apagado) → conector vertical (flecha hacia abajo) → "después" (iluminado).
- Alternancia izq/der desactivada (1 columna).
- Bandas, no cards. No comprimir en formato card.
- `height: auto` con padding vertical generoso (sugerido 48–64px arriba/abajo).
- Márgenes laterales 24px.

---

## Estado de banda activa

Una banda se considera "activa" únicamente durante su primer reveal.

Tras completar la secuencia `rótulo → antes → conector → después → checks`, el glow del lado "después" permanece visible en estado estático de forma permanente.

- No existe estado hover, focus ni active adicional.
- El glow no se re-dispara ni se apaga al salir/entrar del viewport.
- Bajo `prefers-reduced-motion`: no hay secuencia; el glow nace directamente en su estado estático final junto con el resto de la banda.

---

## Motion system exacto

- Easing global: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Trigger: entrada en viewport (umbral ~30% de la banda visible). NO timers globales, NO scroll-jacking.
- Reveal único por banda: se dispara una sola vez; no re-disparar al volver a entrar en viewport.
- Encabezado de sección: fade-up 20px, 400ms.
- Beat narrativo: 300ms de delay entre el reveal del lado "antes" y el del lado "después".

### Secuencia de reveals (por banda, en orden)
1. **Rótulo rubro (ícono + nombre):** fade-up 20px, 350ms. Dispara la secuencia.
2. **Lado "antes" (texto dolor):** fade-in + translate sutil (12px), 350ms, inicia +120ms tras el rótulo. Tono gris, sin glow.
3. **Conector (antes→después):** línea que se traza en la dirección de la transformación, 300ms, inicia con el fin del "antes".
4. **Lado "después" (título):** fade-up 20px, 350ms, inicia tras el beat de 300ms posterior al "antes". Aquí entra el acento azul.
5. **Checks de soluciones:** cascada (stagger) 80–100ms entre cada uno, pop sutil (scale 0.9→1), tras el título "después".
6. **Glow del lado "después":** fade-in del glow ambiental azul tenue, acompaña al título; queda estático tras completarse (ver Estado de banda activa).

---

## Archivos afectados

**Crear**
- `src/components/marketing/para-quien/industry-band.tsx`
- `src/components/marketing/para-quien/transform-connector.tsx`
- (Opcional, según sistema de estilos) sus `.module.css`

**Modificar**
- Archivo de la sección "Para quién" actual (ruta de Pre-flight #4).

**No crear**
- Un componente por rubro (se usa `IndustryBand` x4).

---

## Responsive behavior — criterios de aceptación

Validar 390 / 768 / 1024 / 1440px. En todos:
- Sin overflow horizontal ni scroll inesperado.
- CLS = 0 en la sección (reservar espacio de cada banda antes del reveal vía min-height/aspect).
- Desktop: alternancia izq/der correcta por índice; min-height 420px.
- Tablet: min-height 380px.
- Mobile: layout vertical antes→después con conector vertical; sin alternancia; height auto con padding generoso.
- Ancla/id de la sección intacta (navbar sigue funcionando).

---

## Accessibility

- `prefers-reduced-motion: reduce` → todos los elementos en estado final, sin secuencia, sin beat, sin trazado de conector, glow estático. El contraste antes/después se mantiene por color y opacidad, no por movimiento. Obligatorio.
- Orden del DOM lógico: rótulo → antes → después, independientemente del orden visual (la alternancia es solo visual, no de DOM).
- Contraste de texto: el lado "antes" gris debe cumplir contraste mínimo legible AA (no degradar por debajo de AA por el efecto "apagado").
- Íconos decorativos `aria-hidden`; el nombre del rubro es texto real.
- Conector `aria-hidden`.

---

## Performance constraints

- Sin scroll-jacking, sin listeners de scroll manuales atando posiciones.
- Reveal vía viewport detection (Framer Motion) o IntersectionObserver (fallback). Desconectar el observer tras disparar (reveal único).
- Sin imágenes nuevas; íconos reutilizados del set actual.
- Glow vía CSS (radial-gradient / blur), no assets.
- No agregar dependencias si `framer-motion` no existe.
- Animaciones solo sobre `transform` y `opacity` (evitar reflow).

---

## Fuera de scope (NO TOCAR)

- Scroll horizontal / scroll-jacking (Concepto 2, descartado).
- Selector/tabs interactivos (Concepto 1, descartado).
- SEO, metadata, `sitemap`, `robots`, JSON-LD.
- Formulario de contacto y conexión a Supabase.
- Panel de leads.
- Cualquier sección que no sea "Para quién" (Hero, Servicios, Por qué, Quiénes somos, Proceso, FAQ, Contacto, Footer).
- Tema/fondo global del sitio.
- Navbar y el ancla/id de la sección.
- Crear la sección "Casos" (es otro trabajo).
- Nuevas secciones o cambios de arquitectura de rutas.