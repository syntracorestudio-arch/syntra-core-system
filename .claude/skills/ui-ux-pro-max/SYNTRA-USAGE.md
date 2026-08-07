# UI UX Pro Max — uso en SYNTRA CORE

> ⚠️ **Actualización V2 (2026-07-07):** `ui-ux-pro-max` es la HERRAMIENTA ESTÁNDAR de
> research del `design-director` (ya no "consultiva subordinada"). Sigue sin ser
> autoridad de marca: la coherencia la juzgan design-director/VQD y el owner.


Esta skill es la **herramienta de research estándar** del `design-director`: se carga
sola ante trabajo visual, no se pide permiso para usarla. No es autoridad de marca.
Política completa:

→ **`agents/governance/ui-ux-pro-max-usage.md`** (fuente de verdad)
→ Contexto/modo: **`agents/governance/SYNTRA-CONTEXT-ROUTER.md`** §5

Reglas mínimas:
- Sirve para **research, auditoría de accesibilidad, jerarquía/spacing, inspiración y
  validación de patrones** — nunca para imponer paleta, tipografía o layout.
- Los **reference-locks aprobados** y los tokens de `globals.css` mandan.
- Toda recomendación pasa por el **`design-director`** (y por el `visual-quality-director`
  cuando hace falta diagnóstico con visión). Ninguno de los dos aprueba un commit.
- Prohibido derivar en SaaS genérico, crypto, gamer, dashboard o glass excesivo.
- Todo cambio visual pasa por `syntra-visual-gate` ANTES de mostrarlo (tsc/lint,
  consola limpia, render revisado con visión a 1920 y 390). El **único** gate de commit
  es el OK del owner sobre el prototipo VIVO; el reference-lock se escribe DESPUÉS.

CLI (usar el Python real; el alias de Microsoft Store no funciona):
```
"C:\Users\Mati\AppData\Local\Programs\Python\Python312\python.exe" \
  .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|ux|landing|chart|product>
```
