# SYNTRA — Doctrina de Libertad de Diseño v2 (2026-07-07)

> **Fuente única de las reglas de diseño.** Supersede las reglas restrictivas
> dispersas en: `signature-palette-exception.md` (el trámite de excepción muere),
> `do-not-use.md` (lista larga → lista corta de abajo), `background-patterns.md`
> (el "aurora = cliché a evitar" muere — shippeamos auroras aprobadas),
> los anti-patrones de `agents/frameworks/*` y toda mención de "90/10",
> "cyan solo HECHO" o "motion decorativo prohibido" en skills/docs.
> Ante conflicto, **manda este documento**.

## Por qué existe (evidencia, no teoría)

En el ciclo 2026-06/07, tres diseños consecutivos de Nosotros fueron rechazados por
el owner por "apagados/genéricos". La causa raíz no fue falta de habilidad: fueron
las reglas (90/10, cyan prohibido, "sin wow", minimalismo como norte, gates de
prosa) empujando cada decisión hacia la sobriedad. Cuando se diseñó con libertad
(cards con color por principio, atmósferas generadas, neón, interactividad), el
owner aprobó a la primera o segunda iteración. **El gusto de la marca es riqueza
visible**: registro Raycast / Aceternity / Vercel-rich. Memoria:
`owner-taste-vida-rich-visuals`.

## 1. Paleta — libre con criterio de marca

- Familia de marca: slate/near-black base + **electric #2563eb** + **cyan #38bdf8**
  + **violeta #6d5dfb** + **warm #e7c8a0** (+ blancos/grises del sistema).
- **Uso libre de los 4 acentos.** Sin proporción obligatoria, sin trámite de
  excepción, sin "reservas" — un color de la propia paleta nunca necesita permiso.
- Única semántica que se conserva: en los componentes de SISTEMA (estados
  PENDIENTE→ACTIVO→HECHO de Proceso/Casos), cyan sigue significando "resultado".
  Eso no prohíbe cyan en ningún otro lugar.
- Fuera de familia (arcoíris, neones ajenos a la marca): solo con decisión del owner.

## 2. Motion — la belleza ES propósito

"Si solo queda lindo, no lo animes" queda **derogado**. Un fondo que respira, un
glow que late, una partícula que deriva: si suma vida y calidad, va. Los límites
son **técnicos, no morales**:

- CLS 0 (duro) · LCP no bloqueado por 3D/canvas (lazy siempre)
- Pausa fuera de viewport · `reduced-motion` → frame final digno
- Sin scroll-jacking (scroll-linked sí; secuestro no)
- No animar layout (width/height/top/left)
- Mobile: fallback o calidad reducida · 0 errores de consola

## 3. Lo ÚNICO prohibido (lista corta y real)

1. Templates/assets de stock **sin adaptar** a la marca (el asset comunitario
   reconocible es lo contrario de una firma).
2. **Ilegibilidad**: texto sin AA sobre el fondo del peor caso.
3. **Scroll-jacking**.
4. **Deshonestidad**: clientes, métricas, testimonios o social proof inventados.
5. Color fuera de la familia de marca sin decisión del owner.

Auroras, beams, partículas, glass, 3D decorativo, nodos, spotlights, wordmarks:
**todo permitido** — la vara es la calidad de ejecución, no la categoría.

## 4. Workflow oficial: VARIANTES VIVAS (enmendado 2026-07-15: reference-first)

El ceremonial "concepto → reference-lock → código" queda reemplazado por lo que
demostró funcionar (Nosotros v3, FAQ, Footer):

0. **REFERENCE-FIRST POR DEFECTO (enmienda 2026-07-15).** Ningún objeto visual
   NUEVO (protagonista de sección, asset, artefacto firma) arranca en código:
   arranca con **2-3 candidatos visuales baratos** — imágenes generadas
   (Pollinations/ChatGPT/Gemini), moodboard o referencias reales — que el owner
   elige en minutos. El código llega DESPUÉS de elegida la dirección visual
   concreta. Evidencia: TODOS los destrabes de retrabajo largo (Servicios v5,
   Contacto v3, Nosotros v4, Proceso v2) vinieron de una referencia concreta —
   suya o real —, nunca de iterar código desde adjetivos. Si el owner tiene una
   referencia propia, esa manda (pedírsela es válido desde la PRIMERA iteración,
   no desde la segunda). Excepción razonable: ajustes sobre lenguaje ya aprobado
   (variantes de una card existente, pulido, responsive) van directo a código.
1. **Análisis** (opcional según complejidad): `design-director` +
   `product-experience-designer` en paralelo — dirección + contenido. Ambos
   calibran con la **biblioteca de gusto** (`docs/creative-library/taste/`).
2. **Construir prototipos VIVOS** (motion desde el minuto uno; componentes
   premium de @magicui/@aceternity/shadcn + assets aprobados en el paso 0,
   siempre adaptados a tokens). **Para piezas firma: 2 variantes MÍNIMO** —
   la variante extra cuesta menos que una ronda de retrabajo (regla dura;
   antes era "1-3" y en la práctica fue 1).
3. **El owner juzga EN SU NAVEGADOR** (nunca prosa, nunca solo PNGs) e itera en
   vivo — máx. sensato ~3 rondas antes de replantear dirección.
4. **Gate de commit = el OK del owner sobre el prototipo vivo.** El
   `visual-quality-director` es herramienta de diagnóstico en cualquier iteración
   (con visión, valores concretos), no un trámite previo obligatorio.
5. **El reference-lock se escribe DESPUÉS**, como documentación de lo aprobado
   (dirección, decisiones del owner, criterios verificados) — no antes como permiso.

Verificación mínima antes de mostrar al owner: `tsc` · `lint` · consola limpia ·
mirar el render con visión a **1920** + 390 (1440 si aplica) · **correr la
pre-show checklist** (`docs/creative-library/pre-show-checklist.md` — los
patrones de rechazo históricos del owner, verificados con visión, en binario).

## 5. Norte estético

La interfaz debe sentirse: **viva, rica, tecnológica, premium, memorable**.
Inspiración primaria: **Raycast, Aceternity/Magic UI, Vercel, Linear, Framer** —
tomando de Linear/Stripe la precisión, no la quietud.

## 6. Audiencia (para todo copy y dirección)

SYNTRA es para **cualquier negocio que quiera crecer** — cualquier tamaño, cualquier
rubro. Los escenarios por rubro de la sección Casos son EJEMPLOS ilustrativos, no el
mercado. El lenguaje sigue siendo claro para lectores no técnicos, sin infantilizar
ni encasillar.
