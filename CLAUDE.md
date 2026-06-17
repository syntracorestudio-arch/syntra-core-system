# SYNTRA CORE — CLAUDE SYSTEM CONTEXT

## Identidad

SYNTRA CORE es una Software Factory AI-Native especializada en:

- desarrollo web premium,
- automatización,
- sistemas inteligentes,
- arquitectura escalable,
- y workflows impulsados por IA.

---

# Filosofía

SYNTRA CORE no funciona como una agencia tradicional.

Opera como:

- un ecosistema operativo,
- una software factory modular,
- y una infraestructura digital impulsada por sistemas inteligentes.

---

# Prioridades Absolutas

1. Performance
2. Escalabilidad
3. UX Premium
4. Arquitectura Modular
5. Automatización
6. SEO Técnico
7. Mobile First

---

# Stack Oficial

## Frontend

- Next.js
- React
- TypeScript
- TailwindCSS
- Framer Motion
- shadcn/ui

---

## Backend

- Supabase
- PostgreSQL
- Prisma

---

## Infraestructura

- Vercel
- Cloudflare

---

## Automatización

- n8n
- APIs
- Webhooks

---

# Reglas Generales

Todo código debe:

- ser modular,
- reutilizable,
- tipado,
- escalable,
- mantenible,
- y performante.

---

# Reglas Obligatorias

## TypeScript

Usar TypeScript estricto.

Nunca usar:

- any innecesario
- lógica insegura
- tipados débiles

---

## Arquitectura

Priorizar:

- Server Components
- separación de responsabilidades
- componentes reutilizables
- escalabilidad futura

---

## UI

La interfaz debe sentirse:

- moderna,
- tecnológica,
- premium,
- minimalista,
- elegante.

Inspiración:

- Linear
- Vercel
- Stripe
- Raycast
- Framer

---

# UX Rules

Obligatorio:

- mobile-first,
- spacing amplio,
- animaciones suaves,
- accesibilidad,
- excelente legibilidad.

---

# Motion Rules

Permitido:

- fade-in
- blur reveal
- subtle glow
- smooth hover
- elegant transitions

Evitar:

- animaciones exageradas
- efectos caricaturescos
- motion distractivo

---

# Calidad

Objetivos mínimos:

- Lighthouse +95
- SEO técnico completo
- WCAG AA
- Sin errores consola
- Excelente performance mobile

---

# Automatización

Todo proceso repetitivo debe automatizarse.

Priorizar:

- workflows,
- integraciones,
- pipelines,
- y sistemas escalables.

---

# Estructura Operativa

Leer siempre:

- /docs
- /context
- /projects
- /agents
- /sops

antes de realizar implementaciones importantes.

---

# Agent Routing Rules

Esta sección es operativa y obligatoria. Define qué subagent usar en cada tarea.
Los wrappers de routing viven en `.claude/agents/*.md`; esta tabla solo enruta.
La definición profunda de cada rol se rige por **Fuente de verdad de agentes** (abajo).

## Fuente de verdad de agentes

Existen dos capas y **no se contradicen**:

- **`.claude/agents/*.md` = runtime / routing operativo de Claude Code.** Wrappers
  finos que Claude usa para invocar subagents. **No deben duplicar el prompt completo**
  del rol.
- **`agents/*.md` = biblioteca completa de especificaciones de agentes** (roles,
  autoridad, pipelines, frameworks). Es la fuente de la definición profunda de cada rol.
  Declarada **V1.1 CONGELADA**: priorizar simplificación/fusión antes que expansión.

Reglas:

1. La edición profunda de un rol (responsabilidades, límites, autoridad) se hace en
   `agents/`, **nunca** en el wrapper.
2. Un wrapper de `.claude/agents/` debe apuntar a una spec existente en `agents/`
   (línea `Reference source:`), o justificar por qué crea una nueva.
3. Si CLAUDE.md y un wrapper parecen contradecirse, **manda esta sección**:
   `.claude/agents` enruta, `agents/` define.
4. **No crear nuevos wrappers en `.claude/agents/` sin evidencia operativa o
   aprobación explícita.**

## Principio de routing

Ante cualquier tarea no trivial:

1. Identificar el dominio de la tarea antes de actuar.
2. Seleccionar el o los subagents correctos según la tabla.
3. Separar siempre las fases: diagnóstico → plan → implementación → QA.
4. La dirección, el producto, la auditoría y la arquitectura preceden a la implementación.

## Tabla tarea → agente

| Si la tarea es sobre… | Usar | Modo |
| --- | --- | --- |
| Roadmap, prioridades, orden de tareas, asignación de agentes, dependencias, riesgos | `project-manager` | read-only |
| Lógica funcional, reglas de sistema, entidades, arquitectura de información, scope, criterios de aceptación | `technical-product-owner` | read-only |
| Arquitectura de automatización, flujos end-to-end, integración de servicios, fuentes de verdad, seguridad/escalabilidad de automatizaciones | `automation-architect` | read-only |
| Implementar/planificar workflows n8n (webhooks, nodos, Gmail, Sheets, LLM steps, condiciones, manejo de errores) | `n8n-workflow-engineer` | planning |
| Validar automatizaciones (retries, error handling, idempotencia, logging, seguridad, fiabilidad en producción) | `automation-qa-reliability-guard` | read-only / bloqueante |
| Journey de usuario, narrativa de scroll, ritmo de información, momentos de confianza y conversión, reducción de fricción | `product-experience-designer` | read-only |
| Dirección visual premium, diferenciación de marca, innovación creativa, bloquear lo genérico/template | `creative-director` | read-only |
| Design tokens, componentes reutilizables, consistencia visual global, spacing, prevención de drift | `design-system-guardian` | read-only |
| Layout, jerarquía visual, grids, composición, responsive, motion de interfaz, accesibilidad visual | `ui-ux-designer` | read-only |
| Auditoría de experiencia web sección por sección (premium vs genérico, conversión, confianza, mobile) | `website-experience-auditor` | read-only |
| Implementar UI ya aprobada en React/Next/TypeScript/Tailwind, componentes, integración del design system, refactors controlados | `frontend-engineer` | edita (solo si aprobado) |
| Implementar backend ya aprobado: Supabase (modelo de datos, migraciones SQL), server actions, APIs/route handlers, auth/session, validaciones server-side, rate limiting, seguridad de webhooks (HMAC) | `backend-engineer` | edita (solo si aprobado) |
| Validar TypeScript, lint, build, responsive, accesibilidad, performance y regresiones antes de cerrar/deploy | `qa-performance-guard` | read + valida |
| Aprobar/vetar visualmente tareas que afecten composición, layout visual, percepción premium, jerarquía, Hero, Servicios, Casos, Proceso, Contacto, motion visible, responsive visual o uso del espacio | `visual-quality-director` | read-only / veto de commit visual |

## Reglas de gobierno

1. Ante una tarea no trivial, identificar el dominio y seleccionar los subagents antes de actuar.
2. Separar siempre diagnóstico, plan, implementación y QA en fases distintas.
3. No modificar archivos sin aprobación explícita cuando la tarea afecte código, diseño, configuración, datos o automatizaciones.
4. `frontend-engineer` y `backend-engineer` solo implementan trabajo ya aprobado
   (TASK ID + OK explícito); ante ambigüedad, frenan y derivan.
5. `qa-performance-guard` valida antes de cerrar cualquier trabajo web.
6. Los agentes de diseño, producto, auditoría y arquitectura trabajan siempre read-only: nunca implementan.
7. Para automatizaciones, seguir la secuencia:
   `automation-architect` → `n8n-workflow-engineer` → `automation-qa-reliability-guard`.
8. Para UI premium, seguir la secuencia:
   `website-experience-auditor` → `creative-director` / `product-experience-designer` → `ui-ux-designer` → `design-system-guardian` → `frontend-engineer` → `qa-performance-guard` → `visual-quality-director` (gate de commit visual).
9. Antes de commits, ejecutar `git status` y proponer commits atómicos.
10. No mezclar cambios no relacionados en un mismo commit.
11. **Gate visual (tareas visuales/perceptuales): no commitear sin aprobación visual
    explícita del owner.** Build verde (`tsc`/`lint`/`build`/Lighthouse) NO alcanza para
    cerrar una tarea visual. Flujo obligatorio: implementar local → QA técnico → review
    en navegador/screenshot (360x640, 390x844, 768x1024, 1024x768, 1440x900, 1920x1080) →
    Visual Review de `visual-quality-director` → aprobación del owner → commit. Hasta la
    aprobación, dejar los cambios en working tree sin commitear.
    Protocolo: `agents/governance/visual-quality-gate.md`.
12. Diferenciar el tipo de tarea: las técnicas/bugfix pueden commitearse si pasan QA
    técnico y respetan el scope; las visuales/perceptuales (composición, layout, percepción
    premium, jerarquía, Hero/Servicios/Casos/Proceso/Contacto, motion visible, responsive
    visual, uso del espacio) requieren el gate de la regla 11. Ante la duda, tratar como visual.
13. `visual-quality-director` puede **bloquear el commit** de un cambio visual aunque
    `qa-performance-guard` lo haya aprobado; su veto es sobre calidad visual aprobable en
    navegador, no técnica. No reemplaza al QA técnico: lo complementa.

---

# Filosofía Final

SYNTRA CORE construye:

- sistemas inteligentes,
- automatizaciones,
- productos digitales modernos,
- y arquitectura AI-Native.

No construir soluciones genéricas.
Construir infraestructura digital premium.