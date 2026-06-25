---
section: casos
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-06-26
decision: code-first
---

# Reference Lock — Casos ("Campo de señales")

> Bajo `docs/creative-library/living-web-doctrine.md` (web viva, Fase 5 de rollout).
> Análisis read-only por `website-experience-auditor` + `creative-director` +
> `product-experience-designer` (2026-06-26); dirección elegida por el owner.
> **Este lock NO autoriza código hasta `status: approved`.**

## Objetivo comercial / rol en la landing

Casos responde *"¿esto sirve para un negocio como el mío?"* mediante reconocimiento por
rubro (inmobiliarias/legal/salud/pymes) + una escena de chat real que termina en un
resultado concreto (sello HECHO). Es el **capítulo humano** del recorrido (entre el "qué
hacemos" de Servicios y el "cómo lo construimos" de Proceso). KPI: auto-identificación
en <3s + credibilidad de la demostración. **Esta intervención NO cambia ese rol**: lo
pone al nivel de la web viva (campo vivo propio) y cose la transición hacia Proceso.

## Referencias aprobadas

> Trabajo **code-first generativo** (campo 3D + scroll). Referencias concretas:

**Ref-1 — Wireframe de campo (aprobado por el owner al elegir "Campo de señales"):**

```
CASOS · campo de señales

  · ·   ·    · ·   (trazos cálidos derivan ↓ = consultas entrando)
   ·  ·   · ·
  [ selector rubros ]  [ escena chat WhatsApp ]   ← CONSERVAR intacto
     ·   ·  ·   ·
        ·  ·  ·
  \\  electric tenue (convergencia)  //
  ───────── borde se enfría ─────────
        ↓ anticipa (no contiene) el cable de Proceso
```

**Ref-2 — Escenas vivas en repo (live):** `living-background.tsx` (Servicios arco / Proceso
conducto) como referencia de material/calidad/perf del motor a reutilizar.

**Ref-3 — Corazón a conservar (live):** `application-selector.tsx` + `use-case-chat-scene.tsx`
(selector por rubro + chat WhatsApp image-led + sello HECHO). Es el activo de la sección.

## Qué se toma de cada referencia

- **De Ref-1:** campo de **trazos/partículas de luz tenues** que derivan hacia abajo (las
  consultas "entrando"), **convergen y se enfrían a electric** en el ~15% inferior →
  anticipan el nacimiento del cable de Proceso. El cuerpo del campo mantiene la **calidez**
  (`--accent-warm`) como identidad humana de Casos.
- **De Ref-2:** motor `<LivingBackground>` parametrizado (nueva `variant="casos"`):
  Environment/Bloom/Poster/CanvasBoundary/dpr capado/pausa fuera de viewport/reduced-motion.
  Patrón de **scrim de legibilidad** de Proceso (texto siempre legible sobre el campo).
- **De Ref-3:** TODO el corazón image-led se conserva **sin tocar**.

## Qué NO se toma

- **NO** un cable físico continuo que cruce el `SectionBridge` (su doctrina prohíbe
  conectores visuales) ni que entre a Proceso → el cable sigue siendo **clímax exclusivo de
  Proceso**. Casos lo **anticipa por temperatura/convergencia**, no lo contiene.
- **NO** geometría del arco (Servicios) ni del conducto (Proceso): campo distinto (§4).
- **NO** enfriar el chat WhatsApp (verde/beige = realismo) ni migrar Casos al azul.
- **NO** imponer scroll-linealidad: Casos es **exploración libre** por selector (no recorrido
  vertical como Proceso). El campo es fondo, no esqueleto.
- **NO** unificar los arcos: `Entra→Se ordena→Se actúa→Listo` (cliente) ≠
  `PENDIENTE→ACTIVO→HECHO` (método). Solo el **HECHO/cyan** es el ancla compartida.

## Dirección visual elegida

**"Campo de señales".** Campo vivo generativo: trazos de luz cálidos que derivan hacia abajo
y **convergen enfriándose a electric** en el borde inferior, anticipando el cable de Proceso.
Cuenta visualmente "la consulta entra → se resuelve (HECHO) → y así la construimos (Proceso)".
Conserva selector + escenas de chat. Es **capa de fondo + cosido de temperatura, NO
reestructuración.**

## Decisión asset-first / code-first

**code-first.** El protagonista nuevo es un **campo generativo** (no un asset estático); las
escenas image-led ya existen y se conservan. Se reutiliza el motor (variant nueva). Anti-loop:
**máx. 2 iteraciones** de código; en la 3ª se vuelve a este lock.

## Signature Palette Exception

**¿Aplica excepción de paleta?** no

**Justificación:** todo usa tokens (`--accent-warm` = humano/resultado para el cuerpo;
`--brand-electric` para la convergencia inferior; `--brand-cyan` reservado al HECHO). Casos
es el capítulo cálido dentro del 90/10 frío del recorrido — diferenciación con propósito,
sin drift.

**Cómo se mantiene la marca:** acento cálido del token, electric solo en el borde, cyan solo
en el sello HECHO existente. **Cómo se protege la legibilidad:** scrim (patrón Proceso) +
las escenas/paneles sobre superficie propia.

Referencia: `docs/creative-library/signature-palette-exception.md`

## Criterios binarios de aprobación

- [ ] Casos tiene **campo vivo propio** (`LivingBackground variant="casos"`, lazy `ssr:false`,
      pausa fuera de viewport, reduced-motion → Poster), **distinto** del arco y del conducto.
- [ ] El campo **converge y se enfría a electric** en el borde inferior (anticipa el cable),
      **sin** cable físico continuo y **sin** tocar el `SectionBridge`.
- [ ] Selector por rubro + escenas de chat WhatsApp image-led + sello HECHO + nota de
      honestidad: **intactos**.
- [ ] El chat conserva su paleta (verde/beige); el cuerpo de Casos conserva la **calidez**.
- [ ] **cyan** solo en HECHO; electric acotado a la convergencia; 90/10 respetado.
- [ ] La sección sigue siendo **exploración libre** (selector), sin scroll-jacking ni
      linealidad impuesta.
- [ ] **Cose** con Servicios (arriba) y con Proceso (abajo): sin salto de "otra época".
- [ ] **CLS 0** · **Lighthouse ~90+ mobile** · reduced-motion → estado final · sin errores
      de consola. No degrada la base técnica ya sana de Casos.
- [ ] Mobile: calidad reducida/fallback; reconocimiento por rubro sigue siendo lo primero.

## Riesgos visuales

- **Partículas → "crypto/gamer"** (anti-patrón duro): densidad MUY baja, trazos finos (no
  puntos-estrella), sin glow saturado. Debe leerse "señal entrando", no wallpaper tech.
- **Borrar la frontera con Proceso:** se evita manteniendo la calidez del cuerpo + el cambio
  de temperatura solo en el borde (rol distinto: anticipación, no estructura).
- **Tapar el contenido image-led:** el campo es fondo tenue + scrim; las escenas mandan.

## Riesgos técnicos / performance

- **Dos campos 3D en scroll** (Casos + Proceso): por eso NO cable continuo; cada uno lazy +
  pausado fuera de viewport. Medir mobile (dpr capado / fallback).
- **LCP:** `dynamic(ssr:false)`; el contenido vive sin el 3D (progressive enhancement).
- **CLS 0:** campo `absolute inset-0` detrás; alturas del split ya reservadas.

## Owner approval

Estado: **approved** — Matias / SYNTRA CORE (owner), 2026-06-26.
