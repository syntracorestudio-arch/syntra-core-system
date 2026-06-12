# Hero V1 — Implementation Spec (FASE 1)

> Target path in repo: `projects/syntra-core-website/docs/specs/hero-v1-spec.md`
> Scope: layout 2 columnas + placeholder estático + glow ambiental. Sin animaciones, sin partículas, sin Synapse Graph.

---

## Objetivo

Convertir el Hero actual (texto centrado, mitad derecha vacía) en un layout de 2 columnas: copy a la izquierda, `HeroVisual` estático a la derecha con un `GlowOrb` ambiental de fondo. Mantener copy, CTAs y arquitectura. Cero animación. Esta fase deja el layout y el sistema visual listos para que una FASE 2 inserte el grafo animado sin refactor.

---

## Pre-flight (verificar antes de codear)

1. Confirmar framework/router en `package.json` (Next App Router vs Pages).
2. Confirmar sistema de estilos (Tailwind / CSS Modules / vanilla). Usar el que ya exista. No introducir uno nuevo.
3. Localizar el archivo del Hero actual (candidatos: `src/components/**/hero*.tsx`, `src/components/sections/Hero.tsx`, `src/app/page.tsx`). Anotar ruta real.
4. Localizar dónde se define fondo/tema global. El `#08080C` se aplica SCOPEADO al Hero, nunca al `<body>`.

Si 1–4 no se confirman, detener y reportar. No asumir rutas.

---

## Layout / UI changes

### Desktop (>=1024px)
- Hero como CSS Grid de 12 columnas, gutter 24px, márgenes laterales 96px.
- Texto (badge + H1 + subtítulo + CTAs + trust row): columnas 1–6.
- `HeroVisual`: columnas 7–12.
- Bloque de texto anclado ~45% de altura (sobre el centro óptico).
- `min-height: 720px; max-height: 920px`.
- Contenedor Hero: `overflow-x: hidden`.

### Tablet (768–1023px)
- Mantener 2 columnas si entra; si no, 1 columna con `HeroVisual` debajo del texto.

### Mobile (<768px)
- 1 columna, márgenes 24px, `height: auto`.
- Orden: badge → H1 → subtítulo → CTAs (full-width) → HeroVisual → trust row.

### Tipografía
- H1 desktop: 76px / lh 1.02 / weight 600 / tracking -0.03em / `#FFFFFF`.
- H1 mobile: 40px / lh 1.05.
- Subtítulo: 20px desktop, 17px mobile / weight 400 / `#9BA1AD`.
- Badge: 13px / weight 500 / tracking 0.04em / UPPERCASE / `#C4C9D4`.
- Trust row: 14px / weight 400 / `#7A8089`.
- H1 100% blanco. Quitar el resaltado azul de la palabra del H1.

---

## Componentes nuevos

### `HeroVisual` (placeholder estático)
- Ruta: `src/components/marketing/hero/hero-visual.tsx` (ajustar al patrón del repo).
- Render estático. Sin estado, sin efectos, sin `requestAnimationFrame`, sin librerías.
- Contenido: una tarjeta/superficie simple centrada en la columna derecha que reserva el espacio del futuro grafo.
  - Surface: `border-radius: 24px`, fondo `#0E1119`, borde `1px solid #1C212C`.
  - Dimensiones via `aspect-ratio` fijo (sugerido 620/560 desktop) para evitar CLS y dejar el hueco exacto de FASE 2.
  - Dentro: un único hexágono SVG estático (geometría del logo, mismo ángulo) centrado, relleno `#121620`, borde `#2A2E38`, con la etiqueta `IA` debajo en `#9BA1AD` 13px. Sin glow azul propio.
- `GlowOrb` se renderiza detrás de esta surface (ver abajo).
- `role="img"`, `aria-label` breve.

### `GlowOrb` (glow ambiental)
- Ruta: `src/components/marketing/hero/glow-orb.tsx`.
- Render estático. Un único `div`/SVG con `radial-gradient`.
- Color: `#3B82F6` al 6% de opacidad, blur grande (`filter: blur(80–120px)`), posicionado detrás del hexágono del `HeroVisual`.
- `pointer-events: none`, `aria-hidden`. No interactivo.

---

## Componentes a modificar

### Hero actual (ruta de Pre-flight #3)
- Envolver contenido en grid 12 col (desktop) / stack vertical (mobile).
- Texto a col 1–6. Copy y CTAs sin cambios de texto.
- Insertar `<HeroVisual />` en col 7–12, con `<GlowOrb />` detrás.
- Fondo `#08080C` SCOPEADO a la sección Hero.
- Noise overlay opcional 3% sobre la sección Hero.
- Eliminar acentos azules del Hero salvo: CTA primario, hexágono `IA` puede quedar neutro (sin azul en FASE 1), GlowOrb, logo.

### CTA primario (Hero)
- Fondo `#3B82F6` sólido.
- Hover: fondo `#4F8FF7`, flecha `→` +4px. (Transición CSS simple, sin JS.)

### CTA secundario (Hero)
- Borde gris → gris claro en hover. Sin azul.

---

## Reglas de diseño

- Fondo Hero: `#08080C` (scopeado).
- Azul `#3B82F6` permitido SOLO en: CTA primario, GlowOrb, logo. (En FASE 1 el hexágono va neutro.)
- Hexágono en reposo: relleno `#121620`, borde `#2A2E38`.
- Surface `HeroVisual`: fondo `#0E1119`, borde `#1C212C`.
- Texto etiqueta: `#9BA1AD`.
- Geometría del hexágono idéntica al detalle del logo. No repetir el logo grande en el Hero.
- Sin animación de ningún tipo en esta fase.

---

## Archivos afectados

**Crear**
- `src/components/marketing/hero/hero-visual.tsx`
- `src/components/marketing/hero/glow-orb.tsx`
- (Opcional, según sistema de estilos) sus `.module.css`

**Modificar**
- Archivo del Hero actual (ruta de Pre-flight #3).
- Archivo de tokens/estilos SOLO si fondo/glow/noise se gestionan con custom properties scopeadas. No tocar el tema global.

---

## Responsive — criterios de aceptación

Validar 390 / 768 / 1024 / 1440px. En todos:
- Sin overflow horizontal ni scroll inesperado.
- CLS = 0 en el Hero (espacio del visual reservado vía `aspect-ratio`).
- Layout colapsa correctamente a 1 columna en mobile.

---

## Fuera de scope (NO TOCAR)

- Synapse Graph, partículas, animaciones, parallax, hover de nodos. (Eso es FASE 2.)
- SEO, metadata, `sitemap`, `robots`, JSON-LD.
- Formulario de contacto y conexión a Supabase.
- Panel de leads.
- Copy aprobado (textos del Hero idénticos).
- Cualquier sección que no sea el Hero.
- Tema/fondo global (el `#08080C` es scopeado al Hero).
- Navbar.
- Agregar dependencias. No instalar nada nuevo.
- Nuevas secciones o cambios de arquitectura de rutas.