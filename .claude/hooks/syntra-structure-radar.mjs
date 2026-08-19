import { readFileSync } from "node:fs";

// SYNTRA CORE — Hook (UserPromptSubmit): radar de estructura.
// Inyecta 1-3 líneas de contexto SOLO cuando el prompt del owner matchea un
// dominio con disparador automático (CLAUDE.md → "Disparadores AUTOMÁTICOS").
// Lección codegraph ("adapt the tool to the agent"): las instrucciones en un
// system prompt largo son low-salience; una línea inyectada JUNTO al prompt
// del usuario sí mueve el comportamiento. Por eso: targeted (solo si matchea),
// corto (máx 3 líneas) y NUNCA bloqueante (siempre exit 0).
//
// Ensanchado 2026-08-06: la versión anterior sólo miraba palabras de "proyecto"
// (hero, sección, rediseño…) y no matcheaba NINGUNO de los pedidos reales del
// owner — "mejorá el espaciado de las cards", "el sheet se ve mal en mobile",
// "agregá un botón" pasaban de largo. El trabajo visual cotidiano se nombra por
// COMPONENTE y por PROPIEDAD, no por sección.

let prompt = "";
try {
  const payload = JSON.parse(readFileSync(0, "utf8"));
  prompt = String(payload?.prompt || "");
} catch {}

if (!prompt) process.exit(0);

/* Los slash commands SÍ disparan: el owner escribe "/loop mejorá las cards" y
   antes eso se saltaba el radar entero. La única excepción es el bootstrap, que
   ya carga su propia instrucción y arranca la sesión en modo diagnóstico. */
if (/^\/(syntra-daily-bootstrap|clear|compact|context|model|help)\b/.test(prompt.trim())) {
  process.exit(0);
}

const norm = prompt
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

const RULES = [
  {
    // Sección/proyecto · componente · propiedad visual · archivo de UI.
    re: new RegExp(
      [
        "\\b(hero|seccion|disen|redisen|visual|landing|estilo|paleta|prototipo|layout|responsive|ui\\b)",
        "\\b(card|tile|chip|badge|modal|sheet|dialog|drawer|popover|tooltip|sidebar|navbar|header|footer|banner|tabla|table|grilla|grid|formulario|pantalla|vista|boton|button)",
        "\\b(espaciado|spacing|margen|padding|gap|alineac|alinead|tipograf|font|fuente|color|contraste|icono|icon|sombra|shadow|borde|radius|hover|foco|focus|animacion|motion|transicion|3d)",
        "\\b(mobile|movil|celular|desktop|pantalla chica|se ve mal|se ve feo|no se ve|queda feo|generico|desprolij)",
        "(src/(components|app)/|\\.tsx\\b|-client\\.tsx|globals\\.css)",
      ].join("|"),
    ),
    msg: "Tarea visual/UI → design-director + skills de diseño (ui-ux-pro-max, doctrina, reference-lock de la sección) ANTES de codear; implementa frontend-engineer; prototipos VIVOS y el OK del owner en SU navegador es el ÚNICO gate de commit (syntra-visual-gate).",
  },
  {
    re: /\b(supabase|webhook|migracion|rpc|query|queries|endpoint|server action|cron|rate limit|hmac|auth\b|api\b|indice|index\b|rls|grant|permiso|rol\b|roles|superadmin|privilegi|costo|ganancia|policy|policies)/,
    msg: "Backend/data → syntra-scale-security-baseline + backend-engineer. Si toca datos/auth/roles/permisos/migraciones/dinero: cierra con security-adversary + /code-review (regla 5b).",
  },
  {
    re: /\b(commit|commitea|pushe|push\b|pr\b|merge|mergea)/,
    msg: "Antes de commitear → syntra-safe-commit-gate: checklist copiable, staging explicito, nunca .claude/settings.json.",
  },
  {
    re: /\b(copy|texto|contenido|titular|headline|tono|redacc|microcopy|placeholder|mensaje de error)\b/,
    msg: "Copy → product-experience-designer (arquitectura) + syntra-copy-system (voz); el copy final lo decide el owner.",
  },
  {
    re: /\b(no me gusta|no me convence|de nuevo|otra vez|rechaz|sigue sin|no es lo que|segui sin)/,
    msg: "Rechazo visual repetido → STOP anti-loop: pedir SU referencia (imagen/link/spec); a la 3ra iteracion cambiar de MEDIO, no reintentar igual.",
  },
];

const hits = RULES.filter((r) => r.re.test(norm)).slice(0, 3);
if (hits.length) {
  console.log(hits.map((h) => "[SYNTRA-RADAR] " + h.msg).join("\n"));
}

process.exit(0);
