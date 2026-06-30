# SYNTRA CORE — CLAUDE SYSTEM CONTEXT

## Identidad

SYNTRA CORE es una Software Factory AI-Native especializada en:

- desarrollo web premium,
- automatización,
- sistemas inteligentes,
- arquitectura escalable,
- y workflows impulsados por IA.

---

# Uso Obligatorio de la Estructura SYNTRA (cada tarea)

Ante CUALQUIER tarea no trivial, usar la estructura completa de SYNTRA antes y durante la
ejecución — no improvisar:

- **Agents** (routing tarea→agente, abajo): diagnóstico, dirección y QA con el subagent correcto.
- **Skills** SYNTRA: `syntra-premium-section-design`, `syntra-reference-lock`,
  `syntra-visual-gate`, `syntra-safe-commit-gate`, `syntra-living-motion`,
  `syntra-premium-motion-system`, `syntra-copy-system`, `ui-ux-pro-max`.
- **MCP**: `shadcn` (componentes) y `playwright` (loop visual — ver "Herramientas / MCP").
- **Plugins**: `superpowers` de forma SELECTIVA y subordinada (ver "Plugins / superpowers").

**Reportar en cada output el tooling usado** (qué agent/skill/MCP/plugin) — es la auditoría
que permite al owner verificar y corregir el drift. Si el prompt es vago, marcarlo y
devolver una versión más afilada. Cuestionar los pedidos cuando convenga; no asumir que
todo pedido está bien planteado.

> Vive en CLAUDE.md (se carga cada turno); el `syntra-daily-bootstrap` lo reactiva al
> inicio del día. Ningún setup vuelve esto 100% automático → el reporte de tooling + el
> control del owner son parte del diseño, no un extra.

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

> **Dirección vigente: "web viva" (`docs/creative-library/living-web-doctrine.md`,
> 2026-06-23).** Ante conflicto sobre motion/3D/fondos/scroll, manda esa doctrina.

Permitido (con intención y bajo el norte técnico de la doctrina §3):

- fade-in / blur reveal / smooth hover / elegant transitions
- subtle glow, aurora y derivas con propósito de profundidad
- **fondos vivos por sección** (Canvas/WebGL **lazy**, pausados fuera de viewport)
- **3D real** (three/R3F) como escena-firma o fondo de profundidad, lazy + reduced-motion safe
- **animación ligada al scroll** (reveals por progreso, parallax controlado, capas)

Evitar:

- efecto/3D/partículas **sin concepto ni función** (wow vacío)
- scroll-jacking que secuestre el control del usuario
- animar layout (width/height/top/left) o cualquier cosa que rompa CLS 0
- loops perpetuos que no pausan fuera de viewport
- clichés genéricos (SaaS template, crypto/gamer, glass excesivo, nodos universales)

---

# Calidad

Objetivos mínimos:

- Lighthouse **~90+ mobile** (techo ajustado por la web viva; ver
  `docs/creative-library/living-web-doctrine.md` §2-3). Desktop apuntar a +95.
- **CLS 0 (duro, sin excepción)** y LCP no bloqueado por 3D (lazy)
- SEO técnico completo
- WCAG AA · reduced-motion safe (frame final estático)
- Sin errores consola
- Excelente performance mobile (3D con calidad reducida / fallback)

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
| Implementar motion vivo aprobado: 3D (three/R3F/drei), fondos vivos por sección, escenas-firma, animación ligada al scroll, sistema `<LivingBackground>` (web viva) | `motion-3d-engineer` | edita (solo si aprobado) |
| Implementar backend ya aprobado: Supabase (modelo de datos, migraciones SQL), server actions, APIs/route handlers, auth/session, validaciones server-side, rate limiting, seguridad de webhooks (HMAC) | `backend-engineer` | edita (solo si aprobado) |
| Validar TypeScript, lint, build, responsive, accesibilidad, performance y regresiones antes de cerrar/deploy | `qa-performance-guard` | read + valida |
| Aprobar/vetar visualmente tareas que afecten composición, layout visual, percepción premium, jerarquía, Hero, Servicios, Casos, Proceso, Contacto, motion visible, responsive visual o uso del espacio | `visual-quality-director` | read-only / veto de commit visual |

## Reglas de gobierno

1. Ante una tarea no trivial, identificar el dominio y seleccionar los subagents antes de actuar.
2. Separar siempre diagnóstico, plan, implementación y QA en fases distintas.
3. **Modo de operación (ver `agents/governance/SYNTRA-CONTEXT-ROUTER.md`).** En
   **Autopilot** (default para trabajo técnico/bugfix, docs/governance y visual Cat A)
   Claude puede ejecutar el ciclo completo sin aprobación paso a paso:
   `branch → implementar → QA → commit (staging explícito) → push → abrir PR`; **el
   owner mantiene el merge manual**. **Checkpoint** (default visual Cat B/C y cambios
   riesgosos) frena en gates de aprobación. **Manual** solo propone. Lo que SIEMPRE
   requiere aprobación: merge/push a main, commit visual Cat B/C sin reference-lock +
   visual gate, `.claude/settings.json`, `package.json`/lockfiles/deps, migraciones/
   datos/env/Supabase, aplicar/borrar stashes, borrar branches no mergeadas.
4. `frontend-engineer` y `backend-engineer` implementan trabajo dentro del modo
   declarado: en Autopilot, cambios técnicos/Cat A dentro de alcance; el trabajo
   visual Cat B/C sigue exigiendo reference-lock aprobado. Ante ambigüedad, frenan.
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
14. **Reference-lock (visual Cat B/C):** el trabajo visual Cat B/C requiere un
    reference-lock aprobado (`docs/reference-locks/<section>.md`, `status: approved`)
    antes de implementar. Flujo: `syntra-premium-section-design` →
    `syntra-reference-lock` → `syntra-visual-gate`. Cat A / code-first no lo requiere.

---

# Modo de Operación, Context Receipt y Flujo de PR

> Detalle completo: **`agents/governance/SYNTRA-CONTEXT-ROUTER.md`**. Resumen operativo:

## Context Receipt
Ante cualquier tarea no trivial, antes de actuar, emitir un **Context Receipt** corto
(tarea · tipo · modo · contexto cargado · qué hago sin permiso · qué requiere aprobación
· guardas). Las tareas triviales (lookup, pregunta, corrección de una línea ya pedida)
no lo requieren.

## Modos
- **Autopilot (autonomía guiada)** — default para técnico/bugfix, docs/governance y
  visual Cat A: Claude hace branch → implementa → QA → commit (staging explícito) →
  push → **abre PR**; el owner **mergea manualmente**.
- **Checkpoint** — default visual Cat B/C y cambios riesgosos: autónomo pero frena en
  gates (reference-lock, visual gate, migraciones) para OK del owner.
- **Manual** — solo propone.

## GitHub CLI / PR automation
`gh` está **instalado pero NO en PATH** → invocar por ruta completa:
`"/c/Program Files/GitHub CLI/gh.exe"` (Bash) · `& "C:\Program Files\GitHub CLI\gh.exe"`
(PowerShell). Cuenta `syntracorestudio-arch`. Claude **puede crear PRs automáticamente**
(`gh pr create --base main --head <branch> …`); el **merge es manual del owner**. Nunca
push a main.

## Hooks de seguridad activos
Claude Code `PreToolUse/Bash` (ver `.claude/hooks/README.md`): `guard-git-add.mjs`
(bloquea `git add .`/`-A`/`--all`) y `guard-forbidden-commit.mjs` (bloquea
`git commit -a/-am/--all` y el commit con archivos prohibidos staged). Scripts
versionados; **wiring** en `.claude/settings.json` (local, **no se commitea**).

## UI UX Pro Max (skill de apoyo)
`.claude/skills/ui-ux-pro-max` — research/auditoría/inspiración UI/UX, **nunca**
autoridad. Política: `agents/governance/ui-ux-pro-max-usage.md`. Los reference-locks y
los tokens de `globals.css` mandan; toda recomendación pasa por Creative Director +
Design System Guardian; prohibido derivar en genérico/glass excesivo.

## Herramientas / MCP (loop visual)
- **shadcn MCP** (`.mcp.json`): buscar/traer componentes (shadcn + registries premium
  Magic UI / Aceternity / React Bits) como base, siempre sobre tokens de marca.
- **Playwright MCP** (`.mcp.json`, `--isolated`): **loop visual**. Claude navega el sitio,
  usa snapshot a11y (texto, barato) para navegar/inspeccionar y **screenshots on-demand**
  (navegador con GPU → captura el 3D) para juzgar lo visual. Disciplina de tokens: a11y
  para navegar; screenshot **solo** para juicio visual, de a una sección/viewport.
- **`npm run visual:shots`**: capturas batch. Modo `full` (Home completa) y `--mode=section`
  (element screenshot por sección, nítido). Claude **lee los PNG con visión**.
- Ya no dependemos solo del ojo del owner: usar el loop visual para revisar antes de cerrar
  trabajo visual.

## Plugins / superpowers (subordinado, selectivo)
Plugin oficial `superpowers` instalado: metodología **genérica** y **subordinada a esta
gobernanza** (su propio meta defiere a CLAUDE.md). Adopción **selectiva** para no duplicar gates:
- **Usar:** `verification-before-completion` (evidencia antes de cantar "listo/verde"),
  `systematic-debugging`, `writing-skills` (al crear/editar skills SYNTRA),
  `writing-plans`/`executing-plans` (técnico multi-paso), `test-driven-development`
  **solo backend/lógica** (no para lo visual).
- **No en lo visual:** `brainstorming` y `finishing-a-development-branch` **duplican**
  nuestros gates → mandan `syntra-premium-section-design`/`reference-lock`/`visual-gate` y
  `syntra-safe-commit-gate`. `brainstorming` solo para features NO-visuales sin gate propio.
- Conflicto superpowers ↔ gobernanza SYNTRA → **manda SYNTRA**.

## Rutas correctas
- Web: `projects/syntra-core-website/` (componentes en `src/components/**`, incl.
  `marketing/servicios/`, `marketing/aplicaciones/`, `marketing/hero/`).
- Tokens: `projects/syntra-core-website/src/app/globals.css`.
- Reference-locks: `docs/reference-locks/<section>.md` — **approved**: `hero`, `casos`,
  `proceso`, `contacto` (Contacto v2 = **campo vivo + núcleo SC**); `servicios` en **draft**.
  La sección **"Sistema" fue eliminada** (ya no existe `#sistema`).

## QA mínimo (trabajo web)
`npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run visual:shots`
(`--mode=section` para detalle) + **review en el loop visual** (Playwright MCP / leer los
PNG) antes de cerrar trabajo visual. No existe `npm run lighthouse` → medir Lighthouse
manual. Sin errores de consola; objetivo **Lighthouse ~90+ mobile / +95 desktop**.
**Evidencia antes de cantar "listo"** (`verification-before-completion`): correr el comando
y leer la salida; no asumir.

## Copy
Tono profesional, claro y humano (sin informal/corporativo frío). Web 100% español, sin
i18n. Diseño premium, no genérico (sin SaaS/crypto/gamer/dashboard/glass excesivo).

---

# Filosofía Final

SYNTRA CORE construye:

- sistemas inteligentes,
- automatizaciones,
- productos digitales modernos,
- y arquitectura AI-Native.

No construir soluciones genéricas.
Construir infraestructura digital premium.