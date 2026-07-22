# Claude Code hooks — SYNTRA CORE

Hooks de seguridad para el flujo de Claude Code en este repo. Los **scripts**
viven acá (versionados); el **wiring** vive en `.claude/settings.json`, que **NO
se versiona** (es local/harness). Por eso, tras clonar el repo, hay que activar
el hook manualmente con el snippet de abajo.

## guard-git-add.mjs — Hook 1: anti `git add` global
Bloquea el staging global y obliga a staging explícito por archivo
(alineado con `syntra-safe-commit-gate`).

- **Bloquea:** `git add .`, `git add -A`, `git add --all` (y `-all`).
- **Permite:** staging explícito → `git add <ruta>` (incluido `git add ./ruta`),
  y cualquier comando que no sea `git add` global.
- **Qué es:** un **Claude Code hook** (`PreToolUse` sobre la tool `Bash`) — actúa
  cuando Claude Code ejecuta comandos Bash. **No** es un Git hook global ni
  protege comandos `git add .` tipeados manualmente en otra terminal.
- **Cómo funciona:** lee el JSON del evento por stdin, inspecciona
  `tool_input.command` y, si detecta `git add` con pathspec global, sale con
  `exit 2` (bloquea y muestra el mensaje a Claude). Si no, `exit 0` (permite).

## guard-forbidden-commit.mjs — Hook 2: guard de commit
Complementa al Hook 1 protegiendo el `git commit` (alineado con `syntra-safe-commit-gate`).

- **Bloquea `git commit -a` / `-am` / `--all`:** estos commitean archivos *tracked
  modificados* sin staging explícito → riesgo de arrastrar `.claude/settings.json`
  (que suele estar `M`) u otros. (No matchea `--amend`.)
- **Bloquea `git commit` si hay PROHIBIDOS staged** (revisa `git diff --cached --name-only`):
  `.claude/settings.json`, `.visual-review/`, `tools/`, `*.glb`, `*.blend`,
  `docs/reference-locks/assets/hero-stratos-3d*`. Mensaje incluye el fix:
  `git restore --staged <archivo>`.
- **Advierte (no bloquea) si hay deps staged:** `package.json`, `package-lock.json`,
  `projects/**/package.json|package-lock.json` → recordatorio de aprobación explícita.
- **Permite:** commits normales con staging explícito y sin prohibidos.
- **Qué es:** Claude Code hook (`PreToolUse`/`Bash`), no un Git hook global.

## syntra-structure-radar.mjs — Hook 3: radar de estructura
Inyección de salience (lección codegraph 2026-07-22: "adapt the tool to the
agent" — el wording en system prompts largos es low-salience; contexto inyectado
junto al prompt del usuario sí mueve comportamiento).

- **Qué es:** hook `UserPromptSubmit` — antes de cada prompt del owner, si el
  texto matchea un dominio con disparador automático (visual/backend/commit/
  copy/rechazo-iterativo), imprime 1-3 líneas `[SYNTRA-RADAR]` que Claude Code
  agrega como contexto del turno.
- **Targeted, no wallpaper:** si el prompt no matchea ningún dominio (o es un
  comando slash), no inyecta NADA — costo cero. Máximo 3 líneas por turno.
- **Nunca bloquea:** siempre `exit 0`, todo envuelto en try/catch. Un fallo del
  script jamás frena el prompt.
- **Mantenimiento:** las reglas (regex→línea) viven en el propio script y deben
  reflejar los "Disparadores AUTOMÁTICOS" de CLAUDE.md — una línea por dominio,
  sin duplicar el detalle (single source of truth: CLAUDE.md manda).

## Diseño de mensajes de deny (lección codegraph: "errors teach abandonment")
Un bloqueo seco enseña al agente a abandonar o rodear la herramienta. Por eso
todo mensaje de deny de estos hooks debe: (1) decir que es comportamiento
ESPERADO del gate, no un error del entorno; (2) enseñar el camino correcto
exacto (comandos concretos para reintentar); (3) cubrir el falso positivo con
su salida. Al editar mensajes, mantener las tres partes.

## Activación local (wiring)
Los scripts ya están versionados, pero los hooks **no se activan** hasta cablearlos
en `.claude/settings.json` (local, no commitear). Pegá la clave `hooks` (Hook 1 +
Hook 2 en la misma cadena Bash, en orden):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-git-add.mjs\""
          },
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-forbidden-commit.mjs\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/syntra-structure-radar.mjs\""
          }
        ]
      }
    ]
  }
}
```

> ⚠️ Si `.claude/settings.json` ya tiene otras claves (p. ej. `permissions`),
> **fusioná** la clave `hooks` como hermana **sin borrar** la configuración
> existente. No commitees `.claude/settings.json`.

Tras cablearlo, reiniciar/recargar la sesión de Claude Code si hace falta para
que tome el hook.

## Pruebas
Con el hook activo, desde Claude Code:

```bash
git add .
```
**Esperado:** bloqueado con el mensaje `[SYNTRA] Bloqueado por safe-commit-gate…`.

```bash
git add .claude/hooks/guard-git-add.mjs
```
**Esperado:** permitido (staging explícito).

Validación directa del script (sin depender del wiring):
```bash
echo '{"tool_input":{"command":"git add ."}}' | node .claude/hooks/guard-git-add.mjs ; echo "exit=$?"   # exit=2
echo '{"tool_input":{"command":"git add ruta.ts"}}' | node .claude/hooks/guard-git-add.mjs ; echo "exit=$?"  # exit=0
```

**Hook 2** — con el hook activo, desde Claude Code:
```bash
git commit -am "x" --dry-run
```
**Esperado:** bloqueado (no se ejecuta).

```bash
git add .claude/settings.json && git commit -m "x" --dry-run   # bloquea por prohibido staged
git restore --staged .claude/settings.json                      # limpiar
```
**Esperado:** bloqueado; luego staging vacío.

Validación directa del script:
```bash
echo '{"tool_input":{"command":"git commit -am x"}}' | node .claude/hooks/guard-forbidden-commit.mjs ; echo "exit=$?"  # exit=2
echo '{"tool_input":{"command":"git commit -m x"}}'  | node .claude/hooks/guard-forbidden-commit.mjs ; echo "exit=$?"  # exit=0 (si no hay prohibidos staged)
```

**Hook 3** — validación directa del script:
```bash
echo '{"prompt":"quiero redisenar el hero"}' | node .claude/hooks/syntra-structure-radar.mjs   # imprime [SYNTRA-RADAR] visual
echo '{"prompt":"arregla este typo"}' | node .claude/hooks/syntra-structure-radar.mjs ; echo "exit=$?"  # sin output, exit=0
```

## Alcance / límites
- Solo cubre comandos ejecutados **por Claude Code** (no terminal manual ni CI).
- No reemplaza un pre-commit hook de Git ni revisión humana.
- Falso positivo posible (bajo): un `.` suelto dentro de un string que contenga
  "git add". El mensaje indica el override (usar rutas explícitas).
