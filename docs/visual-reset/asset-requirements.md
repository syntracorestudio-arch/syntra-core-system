# SYNTRA — Visual Asset Requirements

> Reglas de calidad para todo asset visual que entre a la web (VISUAL-RESET-004).
> Complementa `assets-plan.md`. Normativo: ningún asset se integra si no cumple.
>
> **Balance:** el asset protagonista debe dominar visualmente la composición y pasar
> el Composition Balance Gate antes de pedir aprobación del owner
> (`agents/governance/visual-quality-gate.md` §6.5).

## Prohibido

- **No** stock genérico (fotos de "equipo feliz", handshakes, etc.).
- **No** mockups vacíos ni barras grises como contenido.
- **No** dashboards azules inventados ni cards azules planas como protagonista.
- **No** screenshots crudos sin tratamiento (sin frame, sin recorte, sin atmósfera).
- **No** imágenes pixeladas, borrosas o mal escaladas.
- **No** assets pesados sin optimizar.
- **No** cyan como decoración (ver regla de color).

## Formato y peso

- **Formato:** `.webp` o `.avif` (preferidos). PNG solo si necesita transparencia y no hay alternativa.
- **Optimización:** comprimir antes de commitear; apuntar a **< ~200 KB** por imagen de sección (menos en thumbnails).
- **Servir con `next/image`** (lazy por defecto, `sizes` por breakpoint). Sin librerías nuevas.
- **Densidad:** evitar 2x innecesario en piezas grandes (peso); 1x suele alcanzar con buen tratamiento.

## Tamaños (orientativos)

| Uso | Desktop (ancho) | Mobile (ancho) |
| --- | --- | --- |
| Hero | ~1400–1600px | ~820px |
| Card de servicio | ~720–960px | ~640px |
| Escena de caso | ~960–1200px | ~720px |
| Thumbnail (Sistema) | ~360–520px | ~320px |

## Accesibilidad

- **`alt` obligatorio** y descriptivo (qué muestra la escena, no "imagen").
- Contraste AA en cualquier texto/overlay sobre la imagen.
- Respetar `prefers-reduced-motion` en el motion que acompañe al asset (estado final sin animación).

## Color y material

- La imagen aporta el color; el **azul SYNTRA queda como fondo/atmósfera**, no como material del protagonista.
- **cyan SOLO para HECHO/resultado** (sellos/overlays), nunca en la base de la imagen ni como decoración.
- **Materiales permitidos** para el protagonista: claro, cálido, papel, glass claro, imagen, objeto o escena real/pseudo-real.
- Acentos cálidos por rubro permitidos (terracota/ámbar/sage/neutro), sobrios.

## Performance

- Lighthouse +95 se mantiene: lazy-load bajo el fold, `sizes` correctos, dimensiones explícitas (CLS 0).
- Nada de canvas/video pesado de fondo. Sin assets que bloqueen el render del Hero (LCP).

## Procedencia

- **Preferido:** capturas de **demos propias** de SYNTRA (in-house, sin stock).
- Alternativa: mockups de alta fidelidad diseñados y exportados como imagen.
- Fotografía/ilustración licenciada: solo con aprobación explícita del owner.
- Cada asset versionado en `public/visual-assets/syntra/<sección>/`, nombre kebab-case descriptivo.

## Checklist antes de integrar un asset

```text
[ ] ¿Es real/pseudo-real, no una card inventada?
[ ] ¿.webp/.avif y < ~200 KB?
[ ] ¿alt descriptivo?
[ ] ¿el azul es fondo, no el material del protagonista?
[ ] ¿cyan solo en HECHO?
[ ] ¿dimensiones explícitas (sin CLS)?
[ ] ¿se ve premium, no template/stock?
```
