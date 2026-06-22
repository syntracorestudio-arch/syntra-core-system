# SYNTRA CONTEXT ROUTER

> Fuente de verdad operativa para **cómo Claude Code arranca y ejecuta cada tarea**
> en SYNTRA CORE. Define el **Context Receipt** obligatorio, los **modos de
> operación** (Autopilot / Checkpoint / Manual), qué contexto cargar por tipo de
> tarea, y qué puede hacer Claude sin pedir permiso vs. qué requiere aprobación.
>
> Relación con el resto: `CLAUDE.md` enruta tarea→agente; `agents/` define los roles;
> `agents/ROLE-AUTHORITY-MAP.md` define autoridad; este router define **el modo y el
> contexto**. Ante conflicto sobre *modo/contexto*, manda este documento.

---

## 1. Context Receipt (obligatorio)

Ante **cualquier tarea no trivial**, antes de actuar, Claude emite un **Context
Receipt** corto (3–7 líneas) que confirma que entendió el encuadre:

```
CONTEXT RECEIPT
- Tarea: <una línea>
- Tipo: <technical | docs/governance | visual Cat A | visual Cat B/C | automation | research>
- Modo: <Autopilot | Checkpoint | Manual>
- Contexto cargado: <docs/specs/reference-locks/skills relevantes>
- Haré sin pedir permiso: <…>
- Requiere tu aprobación: <…>
- Guardas: branch propia, no main, no settings.json, staging explícito
```

Trivial (no requiere receipt): responder una pregunta, un lookup, una corrección de
una línea ya pedida. Todo lo demás lleva receipt.

---

## 2. Modos de operación

### Autopilot (Autonomía guiada) — default para trabajo no visual y Cat A
Claude ejecuta el ciclo completo **sin pedir aprobación paso a paso**:
`branch → implementar → QA → commit (staging explícito) → push → abrir PR`.
**El owner mantiene el merge manual.** Aplica a:
- bugfix / refactor técnico / cambios de config dentro de alcance;
- documentación, governance, skills;
- **visual Cat A / code-first** (ajustes que no cambian composición/percepción premium);
- tareas ya aprobadas con TASK ID.

### Checkpoint — default para visual Cat B/C y cambios riesgosos
Claude trabaja autónomo pero **frena en gates definidos** para aprobación del owner:
- visual Cat B/C: requiere **reference-lock aprobado** antes de implementar, y **visual
  gate + OK del owner** antes de commitear;
- migraciones / cambios de esquema / datos: confirmar antes de aplicar en prod;
- acciones outward-facing o difíciles de revertir.

### Manual — para lo sensible/ambiguo
Claude **solo propone**; no edita/commitea sin aprobación explícita por paso. Úsese
ante ambigüedad de scope, datos sensibles, o cuando el owner lo pida.

> Cambio de modo: el owner puede fijar el modo ("trabajá en autopilot", "modo
> checkpoint", "modo manual"). Sin indicación, Claude elige el default por tipo de
> tarea (tabla §4) y lo declara en el Context Receipt.

---

## 3. Qué puede hacer Claude SIN pedir permiso (en Autopilot)

✅ Crear branch desde main (`chore/*`, `feature/*`, `fix/*`).
✅ Implementar el cambio dentro del alcance declarado.
✅ Correr QA (`tsc`, `lint`, `build`, `visual:shots`) y corregir errores simples.
✅ **Commit con staging explícito por archivo** (nunca `git add .`/`-A`/`--all`).
✅ Push de la branch propia.
✅ **Abrir PR con GitHub CLI** (ver §6) → dejar el link.
✅ Usar UI UX Pro Max para research/auditoría (ver §5).
✅ Leer cualquier archivo; usar las skills SYNTRA.

## Qué REQUIERE aprobación explícita del owner

⛔ **Merge a main** (siempre manual del owner) y push directo a main.
⛔ **Commit de cambios visuales Cat B/C** sin reference-lock aprobado + visual gate + OK.
⛔ Commitear `.claude/settings.json` (nunca) o cualquier archivo prohibido (ver hooks §7).
⛔ Tocar `package.json`/lockfiles, instalar dependencias/globales, MCP.
⛔ Aplicar migraciones/cambios de datos en producción; tocar env vars / Supabase.
⛔ Aplicar/borrar stashes; borrar branches no mergeadas; operaciones destructivas.
⛔ Acciones outward-facing (enviar, publicar) más allá de abrir un PR.

---

## 4. Tipo de tarea → contexto, skills, modo

| Tipo | Contexto a cargar | Skills | Modo default |
| --- | --- | --- | --- |
| **Technical / bugfix / refactor** | código afectado, `docs/standards.md` | `syntra-safe-commit-gate` | Autopilot |
| **Docs / governance** | doc afectado, este router, `syntra-knowledge-map.md` | — | Autopilot |
| **Visual Cat A (code-first)** | `globals.css` tokens, `visual-quality-gate.md` §2 | `syntra-premium-motion-system` | Autopilot (con visual gate técnico) |
| **Visual Cat B/C** | `docs/reference-locks/<section>.md`, `ui-direction.md`, creative-library | `syntra-premium-section-design` → `syntra-reference-lock` → `syntra-visual-gate` | **Checkpoint** |
| **Automation (n8n)** | `agents/automation/*`, fuentes de verdad | — | Checkpoint |
| **Research / auditoría UI/UX** | sección/objetivo | **`ui-ux-pro-max`** (apoyo) + `website-experience-auditor` | Autopilot (read-only) |

---

## 5. Cuándo usar UI UX Pro Max

Skill local de **apoyo** (`.claude/skills/ui-ux-pro-max`). Política completa:
`agents/governance/ui-ux-pro-max-usage.md`. Resumen operativo:
- **Sí:** research de estilos/paletas/tipografías, auditoría de accesibilidad
  (contraste/focus/ARIA/touch), chequeo de spacing/jerarquía/responsive, validación
  de patrones, inspiración.
- **No:** imponer paleta/tipografía/layout, sobreescribir tokens, derivar en SaaS
  genérico/crypto/gamer/dashboard/glass excesivo.
- **Filtro:** toda recomendación pasa por **Creative Director + Design System
  Guardian** (DSG puede vetar). Los **reference-locks aprobados mandan**.
- CLI: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|ux|landing|chart|product>` (Python real, no el alias de Store).

---

## 6. Flujo de PR (GitHub CLI)

`gh` está **instalado pero NO en PATH** → invocar por ruta completa:
- Bash: `"/c/Program Files/GitHub CLI/gh.exe" …`
- PowerShell: `& "C:\Program Files\GitHub CLI\gh.exe" …`

Cuenta autenticada: `syntracorestudio-arch` (scope `repo`). Flujo Autopilot:
```
git switch main && git pull --ff-only origin main
git switch -c <tipo>/<slug>
# implementar + QA
git add <rutas-explícitas>            # nunca git add . / -A / --all
git commit -m "<tipo>(scope): <mensaje>"
git push -u origin <tipo>/<slug>
"/c/Program Files/GitHub CLI/gh.exe" pr create --base main --head <branch> --title "…" --body "…"
```
**El owner mergea manualmente.** Post-merge: sync local + cleanup de branch.

---

## 7. Cuándo usar reference-locks + hooks activos

- **Reference-locks** (`docs/reference-locks/<section>.md`, `status: approved`):
  precondición de todo trabajo **visual Cat B/C** (regla 14 de CLAUDE.md). Cat A no
  los requiere. Locks vigentes: `hero.md` (approved), `contacto.md` (approved).
- **Hooks de git activos** (Claude Code `PreToolUse/Bash`, ver `.claude/hooks/README.md`):
  - `guard-git-add.mjs` → bloquea `git add .` / `-A` / `--all`.
  - `guard-forbidden-commit.mjs` → bloquea `git commit -a/-am/--all` y el commit si hay
    archivos prohibidos staged (`.claude/settings.json`, `.visual-review/`, `tools/`,
    `*.glb`, `*.blend`, `docs/reference-locks/assets/hero-stratos-3d*`); advierte por
    `package.json`/lock.
  - Los **scripts** se versionan; el **wiring** vive en `.claude/settings.json` (local,
    no se commitea) → reactivar tras clonar con el snippet del README.

---

## 8. Guardas permanentes (siempre, en cualquier modo)

- Nunca push a main; merge manual del owner.
- Nunca commitear `.claude/settings.json` (siempre aparece `M`; es local/harness).
- Staging explícito por archivo; commits atómicos por tema.
- No tocar `package.json`/lockfiles, deps, MCP, env vars, Supabase, migraciones sin OK.
- No aplicar/borrar stashes ni borrar branches no mergeadas sin OK.
- Gate visual Cat B/C: build verde NO alcanza; requiere visual gate + OK del owner.
- "dale/ok/seguí" no es autorización de commit visual; el commit visual va por el gate.
