---
section: contacto
status: approved
approved_by: owner (validación visual + success check completa; commit pendiente de OK explícito)
date: 2026-06-22
decision: on-system materiality (WEB-013C) — extiende el sistema de Casos/Proceso
---

# Reference Lock — contacto

> **APPROVED (dirección visual).** Implementación en `feature/contacto-013c`
> (stash `Contacto 013C` aplicado con `git stash apply`, sin commit). Validación
> completa: 5 breakpoints + envío real con success state + lead guardado + QA verde.
> **Sin commitear** hasta el OK explícito del owner para el commit/merge.

## Objetivo de la sección
Cierre de la landing y captación de leads (`#contacto`). Es el **último beat** del
recorrido "el sistema ordena una consulta": tras ver cómo SYNTRA procesa una
consulta (Hero → Casos → Proceso → Sistema), el usuario **entra la suya**. Debe
sentirse continuación natural del sistema, no una sección genérica pegada al final.
KPI: envío de formulario sin fricción + percepción de confianza/seriedad.

## Patrón visual aprobado
- **Materialidad on-system** (idéntica a Casos/Proceso/Sistema): chasis
  `bg-depth-sunken`, `<SceneAtmosphere />` (mesh azul/cyan por opacidad + grilla),
  hairline de acento superior (`via-accent-primary/60`). **Reemplaza** el viejo
  `surface-glass` + `GlowOrb` (que destacaba como sección aparte).
- **Cyan = HECHO**: el estado de éxito y los acentos de cierre usan `brand-cyan`
  (no `brand-electric`), coherente con el patrón PENDIENTE→ACTIVO→HECHO del sistema.
- Sin glow exagerado (se removió el `shadow-[0_0_60px…]` del success).

## Layout
- Card a **ancho de sección** (sin margen extra, como el resto del sistema).
- Desktop (`lg`): grid **asimétrico** `lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]`
  — **rail izquierdo** (cierre narrativo + email + confianza/privacidad) +
  **formulario protagonista** a la derecha (más ancho).
- Mobile/tablet: stack centrado, formulario full-width, radios full-width, CTA
  full-width.
- Botón enviar: `w-full` en mobile → `sm:w-auto sm:self-end` en desktop.

## Microcopy de confianza (copy polish aprobado, tono profesional/humano)
- `finalCta.title`: **"Hablemos de tu proyecto"**.
- `finalCta.subtitle`: **"Contanos qué necesitás mejorar y te respondemos con una
  propuesta clara, viable y sin compromiso."**
- Línea de email (rail): **"También podés escribirnos a {email}"**.
- **Privacidad reubicada** desde el form al **rail izquierdo** (no se pierde):
  "Usamos tus datos solo para responder esta consulta. Podés ver cómo los tratamos
  en nuestra [Política de privacidad]." — sin prometer tiempos.

## Estados del formulario
- Campos: Nombre, Email, Empresa (opcional), **Tipo de proyecto** (radios:
  Web para mi negocio / Automatización de procesos / IA / integración inteligente /
  Todavía no lo tengo claro → mapea a `project_type`), **Contanos qué necesitás**
  (textarea, placeholder: "Describí brevemente tu proyecto, problema u objetivo…").
- Botón: **"Enviar consulta"** (pending: "Enviando…").
- Lógica **intacta**: server action + Zod + Supabase + `project_type` (migración
  0004) **sin cambios**. El cambio es 100% visual/copy.
- Estado de éxito (`contactSuccess`): **"Consulta recibida / Gracias. Vamos a revisar
  tu mensaje y te responderemos para definir el próximo paso. / Te escribimos con una
  orientación clara para avanzar sin compromiso. / Mensaje enviado"** — hairline +
  check en `brand-cyan`, sin glow.

## Criterios de aprobación
- Mejora claramente la percepción premium vs. el Contacto actual.
- No rompe el formulario ni su lógica server-side.
- No pierde la confianza/privacidad.
- El cierre **no** pesa más que el Hero (sigue siendo cierre, no clímax).
- Se siente parte del sistema actual (materialidad Casos/Proceso, cyan=HECHO).

## Riesgos
- Cambio visual Cat B/C sobre sección **en producción** → requiere gate visual +
  aprobación owner antes de commit.
- `site.ts` es compartido: el apply hizo *auto-merge* limpio (hunks de `finalCta`/
  `contactSuccess` no solapan con los cambios live-system ya en main), pero
  revalidar el diff antes de cerrar.
- Tablet (`768`/`1024`): verificar el salto del grid asimétrico al stack.
- Estado de éxito sólo verificable enviando el form (no aparece en captura estática).

## Estado de validación (2026-06-22, branch feature/contacto-013c)
- QA técnico: `tsc` ✅ · `lint` ✅ · `build` ✅ · `visual:shots` ✅ (6 breakpoints).
- Revisión visual `#contacto` en 390 / 768 / 1024 / 1440 / 1920: rail legible,
  privacidad visible, form protagonista, `project_type` visible, CTA alineado,
  densidad/contraste correctos, cierre no más pesado que el Hero, on-system.
  - 390/768: stack centrado (grid asimétrico arranca en `lg`/1024).
  - 1024/1440/1920: grid asimétrico `28rem | 1fr` (rail + form protagonista).
- **Envío real** (Test SYNTRA / email owner / projectType=unsure / mensaje TEST):
  submit OK → `submitLead` retornó success → **lead guardado en Supabase** (vía
  server action; confirmar en dashboard). Success state premium y legible
  ("Tu consulta ya está adentro" / "Lista para revisar"), sin glow, on-system.
- **Lead de prueba NO borrado** (a confirmar por el owner).
- Pendiente: **OK explícito del owner para commit/merge** (gate visual rule 11/14).
