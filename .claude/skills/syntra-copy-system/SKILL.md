---
name: syntra-copy-system
description: Use when WRITING or REVISING final copy / UX-writing for the SYNTRA web — section copy (eyebrow/title/subtitle), CTAs, labels, form helper text, validation/error messages, empty/loading/success states, badges, microcopy. Executes the SYNTRA voice (profesional, claro, humano; español rioplatense neutro; premium-accesible; sin genérico/corporativo frío) under the Product Strategist's message authority. Content-driven (copy lives in site.ts, never hardcoded). Honesty intact (no invented clients/metrics/testimonials). Scope: SYNTRA marketing web (StudioFlow copy is handled separately).
---

# SYNTRA Copy System

**Skill de ejecución de copy.** No define estrategia ni claims (eso es del **Product
Strategist**) ni organiza el contenido (eso es del **Technical Product Owner**): **ejecuta el
copy final y el microcopy** con la voz SYNTRA, bajo esa dirección. Cierra el hueco de "nadie
es dueño del copy final" sin sumar un opinador de mensaje a la jerarquía.

## Cuándo aplica
Al escribir o revisar copy real de la web SYNTRA: encabezados de sección (eyebrow / title /
subtitle), cards, CTAs, labels de formulario, helper/placeholder, mensajes de validación y
error, estados vacío/loading/éxito, badges, tooltips, microcopy. También al de-jargonizar
copy existente. **Alcance: web de marketing SYNTRA.** El copy de StudioFlow (app pilates) se
trata por separado.

## Frontera de autoridad (no la cruza)
- **Product Strategist** = dueño del **mensaje, claims, propuesta de valor, posicionamiento,
  narrativa**. Esta skill NO inventa claims ni cambia el posicionamiento.
- **Technical Product Owner** = organiza qué contenido va en cada sección (arquitectura de
  información). Esta skill redacta lo que el TPO ya estructuró.
- **Creative Director + Design System Guardian** pueden **vetar** drift de tono/marca.
- En secciones visuales (Cat B/C) el copy entra dentro del trabajo que pasa por el
  **visual gate**: "dale/ok" no autoriza commitear copy visible sin el gate. Copy-only en
  sección ya aprobada = Cat A (puede commitearse con QA técnico), pero **reescrituras grandes
  de copy comercial se consultan** (es decisión de negocio del owner).

## La voz SYNTRA (no negociable)

**Es:** profesional, clara y **humana**. Español **rioplatense neutro** (vos/tenés), directo,
sin vueltas. Premium-accesible: calidad de redacción nivel Linear/Vercel/Stripe pero
**entendible para cualquier dueño de negocio no técnico — de cualquier tamaño y rubro**. Habla de **resultados de negocio**, no de
tecnología. **Honesta**: si algo es condicional, se dice en condicional.

**No es:** ni informal/canchera ni corporativa fría. **Registro parejo: ni demasiado técnico
ni vulgar** — profesional y humano. **Que NO parezca escrito por IA**: concreto y con sustancia
real, sin pulido genérico, sin frases hechas ni relleno. Sin jerga técnica para el lector no
técnico (nada de "stack", "pipeline", "deploy", "endpoint" en copy visible). Sin clichés de
SaaS template / crypto / gamer / "revolucioná tu negocio" / "potenciá con IA" vacío.
**Evitar latiguillos/coloquialismos** tipo "vender humo" / "sin humo" / "sin vueltas" y
similares (suenan a muletilla, no a marca).

**Reglas de estilo:**
- **Beneficio antes que feature.** "Más consultas desde tu sitio" > "formulario optimizado".
- **Frases cortas, una idea por frase.** Verbos activos. Voz en segunda persona (vos).
- **Concreto y específico** > abstracto. "Turno confirmado · Mar 10:30" > "gestión de turnos".
- **Sin relleno** ni superlativos vacíos ("la mejor", "líder", "revolucionario").
- **Español-only** (no i18n; no mezclar inglés salvo término propio inevitable).
- **Sentence case** en títulos/labels (no Title Case ni MAYÚSCULAS salvo eyebrows tracking).

**Ejemplos canónicos (ya aprobados, úsalos de calibración):**
- Servicios/Web: *"Una presencia profesional que genera confianza y convierte visitas en consultas."*
- Proceso/paso 1: *"El primer paso es sin compromiso."* · cierre: *"No te dejamos solo después de lanzar."*
- Casos (honestidad): *"Escenarios de aplicación — ejemplos de cómo trabajamos, adaptados a cada negocio. No representan clientes específicos."*

## Honestidad (regla dura, hereda de gobernanza)
- **Cero** clientes, logos, métricas, testimonios o casos inventados.
- Escenarios/demos = **ilustrativos**, declarados como tales (tono condicional: "podría",
  "diseñaríamos", "tu rubro").
- Claims solo si son reales y sostenibles por el negocio (p. ej. "sin compromiso" solo si lo es).
- Cyan/HECHO y demás señales son del sistema visual; el copy no promete estados falsos.

## Banco de microcopy (patrones — adaptar, no pegar literal)
- **CTA primario:** acción + valor, no genérico. "Contanos tu proyecto" · "Empecemos por
  entender tu negocio" · "Quiero que me recomienden el mejor módulo". Evitar "Enviar"/"Click aquí".
- **CTA secundario:** bajo compromiso. "Ver ejemplos" · "Ver cómo trabajamos".
- **Label de form:** sustantivo claro ("Nombre", "Email", "Contanos sobre tu proyecto").
  Helper breve debajo si reduce fricción. Sin asteriscos crípticos: marcar lo opcional, no lo
  obligatorio, cuando ayude.
- **Validación/error:** específico, sin culpar, cerca del campo. "Necesitamos un email para
  responderte." > "Campo inválido." Nunca un error genérico rojo sin guía.
- **Empty state:** explica + invita a la acción. "Todavía no hay consultas. Cuando llegue la
  primera, la vas a ver acá."
- **Loading:** breve y honesto ("Enviando…"), sin spinners eternos sin texto.
- **Éxito/confirmación:** confirma el resultado concreto + próximo paso. "Listo, recibimos tu
  consulta. Te respondemos en las próximas horas." (eco-neutro, sin euforia).
- **Badge/sello:** corto y factual ("Visita agendada · Jueves 18:00").
- **Eyebrow de sección:** 2–4 palabras, categoría (tracking widest uppercase es estilo, no copy).

## Content-driven (obligatorio)
El copy vive en **`src/config/site.ts`** (y tipos en `src/types`), **nunca hardcodeado** en
componentes. Al sumar copy nuevo: extender el tipo + `site.ts`, no incrustar strings en JSX.
Esto mantiene el copy editable, auditable y separado de la implementación.

## Anti-patrones a bloquear antes de escribir
- Jerga técnica en copy visible para dueños de negocio · superlativos vacíos · "potenciá/revolucioná con
  IA" sin sustancia · CTAs genéricos ("Enviar", "Más info") · Title Case / MAYÚSCULAS de
  relleno · inventar prueba social · copy que promete lo que el producto no hace · mezclar
  inglés innecesario · muros de texto (más de ~2 líneas por bloque sin jerarquía).

## Precedencia
Skill **ejecutora**, subordinada a: **Product Strategist** (mensaje/claims),
**Technical Product Owner** (estructura), **Creative Director** y **Design System Guardian**
(veto de tono/marca), `CLAUDE.md` (sección Copy + Filosofía) y la gobernanza SYNTRA. En
secciones visuales rige además `syntra-visual-gate`. `ui-ux-pro-max` es consultiva y no la
contradice.

## Referencias
- `CLAUDE.md` (sección **Copy**: tono profesional/claro/humano, español-only, no genérico)
- `agents/business/product-strategist.md` (autoridad de mensaje; declara que no redacta copy final)
- `agents/business/technical-product-owner.md` (arquitectura de información)
- `projects/syntra-core-website/src/config/site.ts` (hogar del copy, content-driven)
- Memoria: *Positioning premium-accesible* · *Website Spanish-only, no i18n*
