---
section: grilla
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-22
decision: code-first (prototipo vivo juzgado en navegador — workflow variantes vivas)
supersedes: "—— (no existía lock de grilla: esa ausencia ES la causa documentada acá)"
---

# Reference Lock — Grilla ("Dos rails")

> **Documentación POST-aprobación.** El owner aprobó el resultado en su navegador
> el 2026-07-22 (PR #151). Este lock es transversal: no describe una sección sino
> el sistema de anchos que todas comparten.

## Por qué existe este archivo

Es el único lock que nace de un defecto, no de una dirección. Hasta el 2026-07-22
**no había ninguna fuente de verdad escrita de los anchos del sitio**, y por eso
tres shells distintos se fueron despegando sin que nadie lo notara. A 1920 el
contenido llegó a arrancar en **cuatro** valores según la sección:

| a 1920 | dónde |
| --- | --- |
| 256px | Navbar + Hero |
| 352px | Casos (shell propio, huérfano) |
| 416px | Servicios · Nosotros · FAQ · Contacto · Footer |
| 448px | cuerpo de Servicios y cierre de Proceso (`max-w-5xl` re-centrado adentro del Container) |

El escalón de 32px era el peor: un casi-acierto sobre una línea nítida
(`border-t`) se lee como descuido, no como decisión. **Si esto no está escrito,
vuelve a pasar.**

## Los dos rails (vinculante)

### 1 · Rail Escenario — `SHELL_ESCENARIO`

```
mx-auto w-full max-w-6xl px-6 lg:max-w-7xl lg:px-8 2xl:max-w-[94rem] 2xl:px-12
```

- **Quién lo usa: SOLO Navbar + Hero.** Nadie más.
- Ancho interior: **1216px** (lg–xl) · **1408px** (2xl+).
- Vive exportado en `src/components/layout/container.tsx`. Antes estaba
  duplicado string-a-string en `navbar.tsx` y `hero-section.tsx`: dos copias del
  mismo valor que nadie iba a mantener sincronizadas.

**Por qué es distinto y no se unifica** (dirección de `design-director` +
`visual-quality-director`, 2026-07-22):
1. El logo tiene que alinear con el H1 — se ven juntos en la primera pantalla.
   Llevar la navbar al Container arregla un problema invisible y crea uno visible.
2. La cámara del vórtice (`hero-anillos-3d.tsx`, `setViewOffset`) está anclada al
   **viewport**, no al shell. Mover este rail descoloca la escena 3D aprobada.
3. Está separado del resto por un viewport entero: 160px de diferencia se leen
   como decisión, no como error.

### 2 · Rail Página — `Container`

```
mx-auto w-full max-w-6xl px-6 sm:px-8
```

- **Quién lo usa: TODO lo que va debajo del Hero.** Servicios, Casos, Proceso,
  Nosotros, FAQ, Contacto, Footer.
- Ancho interior: **1088px** desde sm.
- `px-6` y no `px-5`: con px-5 las secciones con Container arrancaban 4px a la
  izquierda del Hero/Casos/Navbar y el ojo veía el escalón al scrollear en mobile.

**El ancho fijo es la decisión, no una limitación.** Es lo que mantiene legible
FAQ/Nosotros/Contacto a 1920: escenario ancho, documento de medida estable. **No
agregar un escalón 2xl al Container.**

## Reglas duras

1. **Ninguna sección define su propio shell.** Si una sección necesita ancho,
   usa `Container`; si es el acto de apertura, `SHELL_ESCENARIO`. No hay un tercero.
2. **Nada de `mx-auto max-w-*` re-centrado adentro del Container** para bloques
   con borde visible (`border-t`, reglas, hairlines): nacen corridos respecto del
   heading de su propia sección. Fue exactamente el defecto de los cierres de
   Servicios y Proceso.
3. Unificar todo en el rail ancho **está evaluado y descartado**: estira la medida
   de lectura de FAQ/Nosotros/Contacto, toca tres valores con firma del owner
   (`33rem` de Contacto, pistas del Footer, rail de FAQ) y encima agranda el
   escalón interno de 32 a 96px, porque los `mx-auto` no se mueven.

## Excepción única y aprobada

`services-showcase.tsx` conserva su `max-w-5xl` (queda +32px respecto del rail).
**Se mantiene a propósito:** el carrusel lleva máscara de fundido en los bordes,
así que el desalineo no se percibe; y sacarlo llevaría las cards del modo
reduced-motion a ~584px, rompiendo el balance imagen/texto del lock de Servicios v5.

## Criterios binarios (verificados en la aprobación)

Medido con Playwright sobre el borde izquierdo del heading de cada sección:

| viewport | Hero/Navbar | todo lo demás | ¿pasa? |
| --- | --- | --- | --- |
| 1440 | 112 | 176 | ✓ un solo borde bajo el Hero |
| 1920 | 256 | 416 | ✓ |
| 2560 | 576 | 736 | ✓ |

- Mobile (320/390): **todas** las secciones a 24px, footer incluido. ✓
- Abajo de lg los dos rails colapsan al mismo ancho ⇒ **cero cambios** en
  mobile/tablet al aplicar este sistema. ✓
- Desktop a 1440 tras el cambio: alturas de sección idénticas a `origin/main`. ✓

## Archivos

- `src/components/layout/container.tsx` — `Container` + `SHELL_ESCENARIO` (fuente única).
- `src/components/layout/navbar.tsx`, `src/components/sections/hero-section.tsx` — consumen `SHELL_ESCENARIO`.
- `src/components/sections/use-cases-section.tsx` — pasó de shell propio a `Container`.
- `src/components/marketing/servicios/services-decide.tsx`, `src/components/sections/workflow-section.tsx` — cierres sin `max-w-5xl`.

## Anti-loop

- **Lo que se ve no es la diferencia entre 1088 y 1216.** Es el zigzag en una sola
  pantalla y el casi-acierto de 32px sobre una línea nítida. Atacar eso primero.
- **64px de diferencia es el peor valor posible**: demasiado poco para leerse como
  intención, suficiente para leerse como error. O comparten borde, o se separan
  de verdad (como el Hero, con 160px y un viewport de por medio).
- Cuando dos agentes se contradigan sobre si un cambio de ancho rompe algo
  (pasó: uno decía que angostar Casos comprimía las demos, el otro que no),
  **medir con un override en runtime** antes de arbitrar. La demo tenía tope
  propio de 480px y la pista quedaba en 593: no se comprimía.
