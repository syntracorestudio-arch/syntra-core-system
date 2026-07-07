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
- **Skills** SYNTRA: `ui-ux-pro-max` (research estándar del design-director),
  `syntra-living-motion` + `syntra-premium-motion-system` (implementación de motion),
  `syntra-copy-system`, `syntra-safe-commit-gate`; `syntra-reference-lock` =
  documentación POST-aprobación; `syntra-premium-section-design` = análisis opcional.
- **MCP**: `shadcn` (componentes) y `playwright` (loop visual — ver "Herramientas / MCP").
- **Plugins**: `superpowers` de forma SELECTIVA y subordinada (ver "Plugins / superpowers").

**Reportar en cada output el tooling usado** (qué agent/skill/MCP/plugin) — **en UNA
línea**. Si el prompt es vago, marcarlo y devolver una versión más afilada. Cuestionar
los pedidos cuando convenga.

## Formato de outputs (obligatorio, pedido del owner 2026-07-07)

- **Breve, claro y denso.** Liderar con el RESULTADO en 1-2 líneas; después solo el
  detalle que cambia decisiones del owner.
- Reporte de tarea típico: **~10-15 líneas máximo**. Análisis/propuestas que el owner
  pidió en profundidad son la excepción.
- QA/verificaciones: UNA línea agregada ("QA verde, 0 errores de consola") — listar
  solo lo que FALLÓ o lo que requiere su decisión.
- Sin repetir contexto que el owner ya tiene, sin secciones ceremoniales, sin
  narrativa del proceso. Tablas solo si comparan opciones.
- Cerrar siempre con el próximo paso o la pregunta concreta (una).

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

> **Doctrina vigente: `docs/creative-library/design-freedom-v2.md` (2026-07-07).**
> Ante conflicto de reglas de diseño/paleta/motion, manda ese documento.

La interfaz debe sentirse:

- **viva y rica** (motion visible, color, profundidad — la sobriedad requiere
  justificación; la riqueza no),
- moderna,
- tecnológica,
- premium,
- memorable.

Inspiración primaria:

- Raycast
- Aceternity / Magic UI
- Vercel
- Linear (su precisión, no su quietud)
- Framer

Paleta: familia de marca (slate + electric + cyan + violeta + warm) de **uso libre
con criterio** — sin regla 90/10, sin "cyan solo HECHO" (cyan conserva semántica de
resultado solo en los componentes de sistema), sin trámite de excepción de paleta.

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

**La belleza es propósito suficiente** (design-freedom-v2 §2): motion decorativo de
calidad es bienvenido. Límites DUROS (técnicos, los únicos):

- scroll-jacking que secuestre el control del usuario
- animar layout (width/height/top/left) o cualquier cosa que rompa CLS 0
- loops que no pausan fuera de viewport · 3D/canvas que bloquee LCP (lazy siempre)
- templates/stock sin adaptar a la marca · ilegibilidad (AA en peor caso)

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
- **`agents/*.md` = biblioteca de especificaciones** (detalle profundo de cada rol).
  Desde la **reforma V2 (2026-07-07)** es **archivo de referencia**: ante conflicto
  con un wrapper o con `docs/creative-library/design-freedom-v2.md`, **manda el
  wrapper/doctrina V2** (ver `agents/README.md`).

Reglas:

1. El comportamiento operativo de un rol vive en su wrapper; la spec de `agents/`
   es contexto profundo, no autoridad superior.
2. Roster V2 = 10 wrappers. Fusiones: `design-director` (= creative-director +
   ui-ux-designer + website-experience-auditor, con `ui-ux-pro-max` como herramienta
   estándar) · `product-experience-designer` (absorbe technical-product-owner) ·
   `visual-quality-director` (absorbe design-system-guardian).
3. Crear/fusionar wrappers requiere evidencia de uso real o pedido del owner
   (evolución con evidencia, no congelamiento).

## Principio de routing

Ante cualquier tarea no trivial:

1. Identificar el dominio de la tarea antes de actuar.
2. Seleccionar el o los subagents correctos según la tabla.
3. Separar siempre las fases: diagnóstico → plan → implementación → QA.
4. La dirección, el producto, la auditoría y la arquitectura preceden a la implementación.

## Tabla tarea → agente

| Si la tarea es sobre… | Usar | Modo |
| --- | --- | --- |
| TODO el diseño: dirección creativa, composición, layout, jerarquía, responsive, motion de interfaz, auditoría de secciones, diferenciación premium, research de diseño (usa `ui-ux-pro-max`) | `design-director` | read-only |
| Journey, narrativa de scroll, momentos de confianza/conversión, fricción, Y contenido/arquitectura de información (qué va en cada sección, entidades, criterios, scope) | `product-experience-designer` | read-only |
| Review visual con VISIÓN de prototipos/renders (percepción premium, composición, consistencia de marca/tokens, regresiones) — diagnóstico, no trámite | `visual-quality-director` | read-only |
| Implementar UI en React/Next/TypeScript/Tailwind, componentes, refactors | `frontend-engineer` (Opus) | edita |
| Implementar motion vivo/3D: three/R3F/drei, fondos vivos, escenas-firma, scroll-linked | `motion-3d-engineer` (Opus) | edita |
| Implementar backend: Supabase (modelo, migraciones), server actions, APIs, auth, validaciones, HMAC | `backend-engineer` (Opus) | edita |
| Validar TypeScript, lint, build, responsive, a11y, performance y regresiones | `qa-performance-guard` | read + valida |
| Arquitectura de automatización end-to-end | `automation-architect` | read-only |
| Workflows n8n (webhooks, nodos, condiciones, errores) | `n8n-workflow-engineer` | planning |
| Validar automatizaciones (retries, idempotencia, logging, fiabilidad) | `automation-qa-reliability-guard` | read-only / bloqueante |

(Roadmap/prioridades/orquestación: las lleva el agente principal, sin subagent.)

## Reglas de gobierno

1. Ante una tarea no trivial, identificar el dominio y seleccionar los subagents antes de actuar.
2. Separar siempre diagnóstico, plan, implementación y QA en fases distintas.
3. **Modo de operación.** En **Autopilot** (default para técnico/bugfix y
   docs/governance) Claude ejecuta el ciclo completo:
   `branch → implementar → QA → commit (staging explícito) → push → abrir PR`; el
   owner **mergea manualmente**. Lo que SIEMPRE requiere aprobación del owner:
   merge/push a main, **commit de trabajo visual** (regla 8), `.claude/settings.json`,
   `package.json`/lockfiles/deps, migraciones/datos/env/Supabase, aplicar/borrar
   stashes, borrar branches no mergeadas.
4. Los agentes de análisis (`design-director`, `product-experience-designer`,
   `visual-quality-director`, `automation-architect`) son read-only; los engineers
   (Opus) implementan.
5. `qa-performance-guard` valida antes de cerrar cualquier trabajo web.
6. Para automatizaciones:
   `automation-architect` → `n8n-workflow-engineer` → `automation-qa-reliability-guard`.
7. Antes de commits: `git status` + commits atómicos; no mezclar temas.
8. **Trabajo visual = WORKFLOW DE VARIANTES VIVAS** (`design-freedom-v2.md` §4):
   análisis opcional (`design-director` + `product-experience-designer` en paralelo)
   → construir 1-3 **prototipos VIVOS directamente** (motion desde el minuto uno) →
   **el owner juzga en SU navegador** e itera en vivo → **su OK al prototipo vivo ES
   el gate de commit** → el reference-lock se escribe DESPUÉS como documentación de
   lo aprobado. `visual-quality-director` = herramienta de diagnóstico en cualquier
   iteración (no trámite previo obligatorio). Verificación mínima antes de mostrar:
   `tsc` · `lint` · consola limpia · render revisado con visión a 1920 + 390.
   Hasta el OK del owner, los cambios visuales quedan sin commitear.

---

# Modo de Operación, Context Receipt y Flujo de PR

> Detalle completo: **`agents/governance/SYNTRA-CONTEXT-ROUTER.md`**. Resumen operativo:

## Context Receipt
Solo para tareas **riesgosas o ambiguas** (migraciones, deps, reformas, scope dudoso):
una línea con tarea · modo · qué requiere aprobación. Las tareas normales arrancan
directo (el formato de outputs breves manda).

## Modos
- **Autopilot (autonomía guiada)** — default para técnico/bugfix y docs/governance:
  Claude hace branch → implementa → QA → commit (staging explícito) → push →
  **abre PR**; el owner **mergea manualmente**.
- **Checkpoint** — default para trabajo VISUAL y cambios riesgosos: autónomo para
  construir prototipos vivos, pero **el commit espera el OK del owner sobre el
  prototipo en su navegador** (variantes vivas, design-freedom-v2 §4); migraciones/
  deps también frenan.
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
  `proceso`, `contacto` (Contacto v2 = **campo vivo + núcleo SC**), `nosotros` (v3
  "Brasa"), `faq` ("Puente térmico"), `footer` ("Cierre de marca"); `servicios` en
  **draft**. La sección **"Sistema" fue eliminada** (ya no existe `#sistema`).

## QA mínimo (trabajo web)
`npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run visual:shots`
(`--mode=section` para detalle) + **review en el loop visual** (Playwright MCP / leer los
PNG) antes de cerrar trabajo visual. No existe `npm run lighthouse` → medir Lighthouse
manual. Sin errores de consola; objetivo **Lighthouse ~90+ mobile / +95 desktop**.
**Evidencia antes de cantar "listo"** (`verification-before-completion`): correr el comando
y leer la salida; no asumir.

## Copy
Tono profesional, claro y humano (sin informal/corporativo frío). **Registro parejo: ni
demasiado técnico ni vulgar; que NO parezca escrito por IA** (concreto, con sustancia, sin
frases hechas ni relleno). Evitar latiguillos tipo "vender humo" / "sin humo" / "sin vueltas".
Web 100% español, sin i18n. Diseño premium, no genérico (sin SaaS/crypto/gamer/dashboard/glass
excesivo). Detalle y voz completa: `syntra-copy-system`.

---

# Filosofía Final

SYNTRA CORE construye:

- sistemas inteligentes,
- automatizaciones,
- productos digitales modernos,
- y arquitectura AI-Native.

No construir soluciones genéricas.
Construir infraestructura digital premium.