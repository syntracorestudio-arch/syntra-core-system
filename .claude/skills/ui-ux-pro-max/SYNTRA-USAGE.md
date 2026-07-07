# UI UX Pro Max — uso en SYNTRA CORE

> ⚠️ **Actualización V2 (2026-07-07):** `ui-ux-pro-max` es la HERRAMIENTA ESTÁNDAR de
> research del `design-director` (ya no "consultiva subordinada"). Sigue sin ser
> autoridad de marca: la coherencia la juzgan design-director/VQD y el owner.


Esta skill es de **apoyo**, no de autoridad. Antes de usarla, regir por la política:

→ **`agents/governance/ui-ux-pro-max-usage.md`** (fuente de verdad)
→ Contexto/modo: **`agents/governance/SYNTRA-CONTEXT-ROUTER.md`** §5

Reglas mínimas:
- Sirve para **research, auditoría de accesibilidad, jerarquía/spacing, inspiración y
  validación de patrones** — nunca para imponer paleta, tipografía o layout.
- Los **reference-locks aprobados** y los tokens de `globals.css` mandan.
- Toda recomendación pasa por **Creative Director + Design System Guardian** (DSG veta).
- Prohibido derivar en SaaS genérico, crypto, gamer, dashboard o glass excesivo.
- Todo cambio visual Cat B/C sigue el **visual gate** (reference-lock + OK del owner).

CLI (usar el Python real; el alias de Microsoft Store no funciona):
```
"C:\Users\Mati\AppData\Local\Programs\Python\Python312\python.exe" \
  .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|ux|landing|chart|product>
```
