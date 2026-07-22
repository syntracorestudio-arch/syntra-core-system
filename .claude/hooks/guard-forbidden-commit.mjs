import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// SYNTRA CORE — Hook 2 (PreToolUse/Bash): guard de commit.
// 1) Bloquea `git commit -a / -am / --all` (commitea tracked modificados sin
//    staging explícito → riesgo de arrastrar .claude/settings.json u otros).
// 2) Bloquea `git commit` si hay archivos PROHIBIDOS staged.
// 3) Advierte (no bloquea) si hay archivos de dependencias staged.
// Complementa el Hook 1 (guard-git-add). Es un Claude Code hook, no un Git hook.

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {}

let command = "";
try {
  command = JSON.parse(raw)?.tool_input?.command || "";
} catch {}

// Solo actúa sobre git commit.
if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

// 1) Bloquear -a / -am / --all (bundle corto con 'a' o el flag --all).
const usesCommitAll =
  /(?:^|\s)--all(?:\s|=|$)/.test(command) ||
  /(?:^|\s)-[a-z]*a[a-z]*(?:\s|=|$)/.test(command);
if (usesCommitAll) {
  console.error(
    [
      "[SYNTRA] Bloqueado por safe-commit-gate: `git commit -a / -am / --all` (comportamiento esperado, NO es un error del entorno).",
      "Commitea archivos tracked modificados sin staging explícito",
      "(riesgo: arrastrar .claude/settings.json u otros).",
      "",
      "Camino correcto (reintentá así, mismo mensaje de commit):",
      "  git add <ruta> <ruta>      # SOLO los archivos de ESTE tema",
      "  git commit -m \"...\"       # sin -a (--amend sí está permitido)",
    ].join("\n"),
  );
  process.exit(2);
}

// 2/3) Inspeccionar lo que está staged.
let staged = [];
try {
  staged = execSync("git diff --cached --name-only", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {}

const norm = (f) => f.replace(/\\/g, "/");

const FORBIDDEN = [
  /^\.claude\/settings\.json$/,
  /^\.visual-review\//,
  /^tools\//,
  /\.glb$/,
  /\.blend$/,
  /^docs\/reference-locks\/assets\/hero-stratos-3d/,
];

const WARN = [/(^|\/)package\.json$/, /(^|\/)package-lock\.json$/];

const bad = staged.filter((f) => FORBIDDEN.some((re) => re.test(norm(f))));
if (bad.length) {
  console.error(
    [
      "[SYNTRA] Commit bloqueado — archivos prohibidos staged (comportamiento esperado, NO es un error del entorno):",
      ...bad.map((f) => "  - " + f),
      "",
      "Camino correcto: quitalos del staging y reintentá EL MISMO commit:",
      ...bad.map((f) => "  git restore --staged " + f),
      "",
      "Nota: .claude/settings.json NUNCA se commitea — dejalo modificado sin stagear; el resto del commit sigue siendo válido.",
    ].join("\n"),
  );
  process.exit(2);
}

const warn = staged.filter((f) => WARN.some((re) => re.test(norm(f))));
if (warn.length) {
  console.error(
    [
      "[SYNTRA] AVISO: el commit incluye archivos de dependencias",
      "(requieren aprobación explícita; pueden traer deps no deseadas):",
      ...warn.map((f) => "  - " + f),
      "Si es intencional, continuá; si no: git restore --staged <archivo>.",
    ].join("\n"),
  );
  // Warning no bloqueante.
}

process.exit(0);
