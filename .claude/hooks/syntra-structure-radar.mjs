import { readFileSync } from "node:fs";

// SYNTRA CORE — Hook 3 (UserPromptSubmit): radar de estructura.
// Inyecta 1-3 líneas de contexto SOLO cuando el prompt del owner matchea un
// dominio con disparador automático (CLAUDE.md → "Disparadores AUTOMÁTICOS").
// Lección codegraph ("adapt the tool to the agent"): las instrucciones en un
// system prompt largo son low-salience; una línea inyectada JUNTO al prompt
// del usuario sí mueve el comportamiento. Por eso: targeted (solo si matchea),
// corto (máx 3 líneas) y NUNCA bloqueante (siempre exit 0).

let prompt = "";
try {
  const payload = JSON.parse(readFileSync(0, "utf8"));
  prompt = String(payload?.prompt || "");
} catch {}

// No inyectar en comandos slash (ya cargan su propia instrucción).
if (!prompt || prompt.startsWith("/")) process.exit(0);

const norm = prompt
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

const RULES = [
  {
    re: /\b(hero|seccion|disen|redisen|visual|landing|estilo|paleta|motion|animacion|3d|prototipo|layout|responsive|ui\b)/,
    msg: "Tarea visual → design-director ANTES de codear; prototipos VIVOS (variantes vivas); el OK del owner en SU navegador es el gate de commit (syntra-visual-gate).",
  },
  {
    re: /\b(supabase|webhook|migracion|rpc|query|queries|endpoint|server action|cron|rate limit|hmac|auth\b|api\b)/,
    msg: "Backend/data → syntra-scale-security-baseline (cotas de fecha, indices, async, rate limiting) + backend-engineer.",
  },
  {
    re: /\b(commit|push|pr\b|merge)/,
    msg: "Antes de commitear → syntra-safe-commit-gate: checklist copiable, staging explicito, nunca .claude/settings.json.",
  },
  {
    re: /\b(copy|texto|contenido|titular|headline|tono)\b/,
    msg: "Copy → product-experience-designer (arquitectura) + syntra-copy-system (voz); el copy final lo decide el owner.",
  },
  {
    re: /\b(no me gusta|no me convence|de nuevo|otra vez|rechaz|sigue sin)/,
    msg: "Rechazo visual repetido → STOP anti-loop: pedir SU referencia (imagen/link/spec); a la 3ra iteracion cambiar de MEDIO, no reintentar igual.",
  },
];

const hits = RULES.filter((r) => r.re.test(norm)).slice(0, 3);
if (hits.length) {
  console.log(hits.map((h) => "[SYNTRA-RADAR] " + h.msg).join("\n"));
}

process.exit(0);
