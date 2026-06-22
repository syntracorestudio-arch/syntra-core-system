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

## Activación local (wiring)
El script ya está versionado, pero el hook **no se activa** hasta cablearlo en
`.claude/settings.json` (local, no commitear). Pegá la clave `hooks`:

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

## Alcance / límites
- Solo cubre comandos ejecutados **por Claude Code** (no terminal manual ni CI).
- No reemplaza un pre-commit hook de Git ni revisión humana.
- Falso positivo posible (bajo): un `.` suelto dentro de un string que contenga
  "git add". El mensaje indica el override (usar rutas explícitas).
