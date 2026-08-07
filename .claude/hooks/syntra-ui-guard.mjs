import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// SYNTRA CORE — Hook (PreToolUse): guard de UI.
//
// El problema que resuelve: el radar mira el PROMPT, pero un prompt inocente
// ("arreglá esto") puede terminar en una edición de UI sin que se haya
// consultado diseño. Este hook mira la ACCIÓN en vez de la intención: cuando se
// va a escribir sobre un archivo de UI y en toda la sesión no se cargó ninguna
// skill/agente de diseño, inyecta el recordatorio.
//
// ADVISORY POR DISEÑO — SIEMPRE exit 0, NUNCA bloquea una edición. Bloquear es
// atribución exclusiva de los guards de git (`guard-git-add`,
// `guard-forbidden-commit`): ahí lo que se protege es el repositorio, acá sólo
// se protege el criterio. Un guard de diseño que bloquea se vuelve un peaje que
// se aprende a esquivar; uno que avisa se lee.
//
// Cómo sabe si hubo diseño: escribe un marcador por sesión en el temp del SO
// cuando ve pasar un Skill/Task de diseño. Sin estado no habría forma de
// distinguir "editó sin consultar" de "editó después de consultar".

const UI_PATH = /(^|[\\/])src[\\/](components[\\/]|app[\\/].*(page|layout|template|error|loading|.*-client)\.tsx$)/i;
const UI_ANY = /(^|[\\/])src[\\/](components|app)[\\/].*\.(tsx|css)$/i;

// Lo que cuenta como "consulté diseño" en esta sesión.
const DISENO = /(design-director|visual-quality-director|product-experience-designer|ui-ux-pro-max|syntra-visual-gate|syntra-premium-section-design|syntra-reference-lock|syntra-living-motion|syntra-premium-motion-system|frontend-engineer|motion-3d-engineer)/i;

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8")) || {};
} catch {
  process.exit(0);
}

const tool = String(payload.tool_name || "");
const input = payload.tool_input || {};
const sesion = String(payload.session_id || "sin-sesion").replace(/[^\w-]/g, "");

const dir = join(tmpdir(), "syntra-ui-guard");
const marcador = join(dir, `${sesion}.flag`);

const marcar = () => {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(marcador, "1");
  } catch {}
};

// 1. ¿Se está consultando diseño? Se anota y listo.
if (tool === "Skill" || tool === "Task" || tool === "Agent") {
  const texto = JSON.stringify(input);
  if (DISENO.test(texto)) marcar();
  process.exit(0);
}

// 2. ¿Se está escribiendo sobre UI sin haber consultado?
if (tool !== "Edit" && tool !== "Write" && tool !== "MultiEdit" && tool !== "NotebookEdit") {
  process.exit(0);
}

const ruta = String(input.file_path || input.path || "");
if (!ruta || !(UI_PATH.test(ruta) || UI_ANY.test(ruta))) process.exit(0);

let yaConsulto = false;
try {
  yaConsulto = existsSync(marcador);
} catch {}
if (yaConsulto) process.exit(0);

/* Se marca ACÁ también: el aviso se da una vez por sesión. Repetirlo en cada
   Edit de una tanda de veinte lo convertiría en ruido que se filtra solo. */
marcar();

const aviso = [
  "[SYNTRA-UI-GUARD] Primera edición de UI de la sesión sin diseño consultado.",
  "Antes de seguir: design-director + las skills de diseño (ui-ux-pro-max, doctrina visual,",
  "reference-lock de la sección que tocás). No es un permiso — es leer antes de escribir.",
  "El ÚNICO gate de commit sigue siendo el OK del owner sobre el prototipo VIVO en su navegador.",
].join(" ");

// Formato documentado para inyectar contexto desde PreToolUse. Se imprime
// también en texto plano por si la versión del harness no lee el JSON: en el
// peor caso el owner ve una línea de más, nunca una edición bloqueada.
console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: aviso },
  }),
);

process.exit(0);
