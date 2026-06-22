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
      "[SYNTRA] Bloqueado por safe-commit-gate.",
      "",
      "No usar:",
      "  git add .",
      "  git add -A",
      "  git add --all",
      "",
      "Usá staging explícito por archivo:",
      "  git add <ruta-del-archivo>",
    ].join("\n"),
  );
  process.exit(2);
}

process.exit(0);
