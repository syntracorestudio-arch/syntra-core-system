# SYNTRA CORE — DAILY BOOTSTRAP (V2, 2026-07-07)

Arranque de sesión. Read-only: diagnóstico sí, cambios no (nada de commits,
stashes ni ediciones durante el bootstrap).

## Capas de contexto (qué ya está cargado solo)

1. **CLAUDE.md** se carga automáticamente cada turno → doctrina V2, roster,
   workflow variantes-vivas, formato de outputs. NO re-leerlo.
2. **Memoria persistente** (MEMORY.md) se carga sola → gusto del owner,
   reforma V2, decisiones durables. NO re-leerla salvo verificar un dato.
3. Este bootstrap agrega la capa 3: **el estado REAL de hoy** (git/PRs/tools).

## Qué verificar (rápido, en paralelo donde se pueda)

```text
1. Git: branch actual · status · log -3 · stashes.
2. PRs abiertos: "/c/Program Files/GitHub CLI/gh.exe" pr list --state open
   (separar: web SYNTRA vs StudioFlow/pilates).
3. Tracker: projects/syntra-core-website/TASKS.md → "Próxima acción".
4. Doctrina de diseño vigente: docs/creative-library/design-freedom-v2.md
   (leerla solo si la sesión va a tocar diseño).
5. Herramientas — confirmar disponibles:
   · Agentes V2 (10): design-director · product-experience-designer ·
     visual-quality-director · frontend/motion-3d/backend-engineer (Opus) ·
     qa-performance-guard · automation-architect · n8n-workflow-engineer ·
     automation-qa-reliability-guard.
   · Skills: ui-ux-pro-max (research del design-director) · syntra-living-motion ·
     syntra-premium-motion-system · syntra-copy-system · syntra-safe-commit-gate ·
     (reference-lock = doc post-aprobación; section-design = análisis opcional).
   · MCP: shadcn (+registries @magicui/@aceternity vía CLI) · playwright
     (loop visual) · pollinations (imágenes gratis).
   · gh CLI por ruta completa (no está en PATH).
   Si algo falta/desconectado, reportarlo en una línea.
```

## Reglas del día (recordatorio operativo)

- **Trabajo visual = variantes vivas**: prototipos CON motion → el owner juzga
  en SU navegador → su OK = gate de commit → lock DESPUÉS como documentación.
- Verificación mínima antes de mostrar: `tsc` · `lint` · consola limpia ·
  render revisado con visión a **1920** + 390.
- Diseñar RICO por defecto (design-freedom-v2); commits atómicos con staging
  explícito; nunca `.claude/settings.json`; merge siempre manual del owner.
- Reportar tooling usado en una línea; outputs breves (CLAUDE.md → Formato).

## Responder con (BREVE — máx ~15 líneas)

```text
# BOOTSTRAP · <fecha>
Git: <branch · limpio/sucio · último commit>
PRs abiertos: <n web / n pilates — cuáles esperan merge>
Próxima acción (TASKS.md): <línea>
Herramientas: OK / <qué falta>
Riesgos/pendientes: <solo si los hay>
¿Con qué arrancamos?
```
