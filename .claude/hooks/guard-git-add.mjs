import { readFileSync } from "node:fs";

// SYNTRA CORE — Hook 1 (PreToolUse/Bash): bloquea `git add .` / `-A` / `--all`.
// Protege el flujo cuando Claude Code ejecuta Bash. Permite staging explícito
// por archivo. No reemplaza un pre-commit hook de Git ni protege comandos
// ejecutados manualmente fuera de Claude Code.

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {}

let command = "";
try {
  const payload = JSON.parse(raw);
  command = payload?.tool_input?.command || "";
} catch {}

const isGitAdd = /\bgit\s+add\b/.test(command);
const usesGlobalPathspec = /(?:^|\s)(?:-A|--all|-all|\.)(?=\s|$)/.test(command);

if (isGitAdd && usesGlobalPathspec) {
  console.error(
    [
      "[SYNTRA] Bloqueado por safe-commit-gate (comportamiento esperado, NO es un error del entorno — no lo rodees con otra herramienta).",
      "",
      "No usar: git add . / -A / --all",
      "",
      "Camino correcto (reintentá así):",
      "  1. git status --short            # listá qué cambió",
      "  2. git add <ruta> <ruta>         # SOLO los archivos de ESTE tema (atómico)",
      "  3. seguí con el commit normal",
      "",
      "Falso positivo (un '.' suelto dentro de un string)? Reescribí el comando con rutas explícitas.",
    ].join("\n"),
  );
  process.exit(2);
}

process.exit(0);
