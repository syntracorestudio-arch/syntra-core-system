# SYNTRA CORE — DAILY BOOTSTRAP

Arrancamos sesión de trabajo.

No tocar archivos todavía.
No modificar código.
No editar documentación.
No commitear.
No pushear.
No ejecutar cambios destructivos.
No aplicar stashes.
No usar `git add .`.

Sí podés leer archivos y ejecutar comandos de diagnóstico.

## Objetivo

Quiero que te ubiques en el sistema SYNTRA antes de trabajar.

Antes de proponer o ejecutar cualquier tarea, cargá contexto, revisá el estado real del repo y reportá riesgos.

## Leer contexto obligatorio

La gobernanza SYNTRA se reparte así: `CLAUDE.md` enruta tarea→agente;
`agents/ROLE-AUTHORITY-MAP.md` define autoridad; `agents/governance/SYNTRA-CONTEXT-ROUTER.md`
define **modo de operación + Context Receipt + flujo de PR**. No existe
`agents/SYNTRA-OPERATING-SYSTEM.md` y no debe crearse ni buscarse.

Revisar:

```text
CLAUDE.md
agents/governance/SYNTRA-CONTEXT-ROUTER.md
agents/ROLE-AUTHORITY-MAP.md
agents/governance/syntra-knowledge-map.md
agents/development/web-delivery-pipeline.md
projects/syntra-core-website/TASKS.md   (si existe)
docs/reference-locks/   (locks vigentes por sección)
docs/creative-library/ si existe
.claude/skills/ · .claude/agents/ · .claude/commands/ · .claude/hooks/
```

## Confirmar herramientas disponibles

Confirmar si están disponibles/invocables:

```text
# Agentes / skills SYNTRA
visual-quality-director · creative-director · ui-ux-designer · product-experience-designer
design-system-guardian · website-experience-auditor · motion-3d-engineer
frontend-engineer · backend-engineer · qa-performance-guard
technical-product-owner · project-manager
syntra-premium-section-design · syntra-reference-lock · syntra-visual-gate
syntra-premium-motion-system · syntra-living-motion · syntra-copy-system
syntra-safe-commit-gate · ui-ux-pro-max · syntra-daily-bootstrap

# MCP + loop visual  (revisar .mcp.json)
shadcn (componentes) · playwright (loop visual: navegar + screenshots con GPU)
npm run visual:shots (full · --mode=section)

# Plugin externo (subordinado a la gobernanza SYNTRA)
superpowers — usar selectivo: verification-before-completion, systematic-debugging,
writing-skills/plans, TDD solo backend; lo visual va por los gates SYNTRA
```

GitHub CLI: instalado pero fuera de PATH → confirmar con
`"/c/Program Files/GitHub CLI/gh.exe" auth status`.

Si alguna no aparece, reportarlo.

## Estado esperado reciente

Usar esto solo como referencia inicial. **La fuente real siempre es Git y los
archivos del repo** (los estados puntuales se derivan de `git log`/`git status`).

Hechos durables (no asumir, verificar):


Stashes:

```text
Verificar con `git stash list`. Normalmente NO debería haber stashes (el spike3d y los de
Contacto/visual-reset ya fueron integrados o descartados). Si aparece alguno, reportarlo.
```

No aplicar ni borrar ningún stash sin aprobación explícita.

## Revisar estado del repo

Ejecutar:

```bash
git branch --show-current
git status --short
git status
git stash list
git log --oneline -5
```

## Revisar estado del proyecto web

Indicar:

```text
- branch actual
- si main está intacto
- working tree limpio o no
- archivos modificados / nuevos
- stashes importantes
- si existe stash de Contacto 013C u otro WIP relevante
- última tarea cerrada
- próxima tarea según TASKS.md
- riesgos abiertos
- migraciones pendientes
- cambios visuales sin commit
- branch visual activa si existe
```

## Si hay cambios visuales sin commit

No asumir que están aprobados.

Reportar:

```text
- archivos tocados
- sección afectada
- si tienen QA
- si tienen screenshots
- si falta aprobación visual del owner
- si conviene ajustar, commitear o descartar
```

## Reglas de aprobación

El bootstrap es **read-only**: primero reportá el estado, después se trabaja. No tocar
archivos durante el bootstrap.

Una vez reportado, el trabajo se rige por los **modos** del Context Router
(`agents/governance/SYNTRA-CONTEXT-ROUTER.md`):

```text
- Autopilot (técnico/bugfix, docs/governance, visual Cat A): Claude puede
  branch → implementar → QA → commit (staging explícito) → push → abrir PR.
  El owner mergea manualmente.
- Checkpoint (visual Cat B/C, cambios riesgosos): frena en gates de aprobación.
- Manual: solo propone.
```

Siempre requieren OK explícito del owner: **merge/push a main**, **commit visual
Cat B/C** (necesita reference-lock + visual gate), `.claude/settings.json`,
`package.json`/deps, migraciones/datos/env, aplicar/borrar stashes. Para trabajo
visual, "dale/ok/seguí" no es autorización de commit: el commit visual va por el gate.

## Recordatorio de estructura (post-bootstrap)

Terminado el bootstrap, en CADA prompt no trivial: usar la **estructura SYNTRA completa**
(agents · skills · MCP `shadcn`/`playwright` · `superpowers` selectivo) según el routing de
`CLAUDE.md`, y **reportar el tooling usado** en el output. Evidencia antes de cantar "listo"
(`verification-before-completion`). Esto vive en `CLAUDE.md` (cada turno); el bootstrap solo
lo reactiva.

## Responder con

```text
# SYNTRA DAILY BOOTSTRAP

## Sistema cargado

## Fuente de gobernanza
agents/ROLE-AUTHORITY-MAP.md

## Skills / agentes disponibles

## Estado Git

## Estado de tareas

## Riesgos abiertos

## Cambios o stashes importantes

## Estado visual actual

## Próxima acción recomendada

## Pregunta al owner antes de tocar archivos
```
