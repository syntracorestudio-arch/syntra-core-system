# UI UX Pro Max — Regla de uso en SYNTRA CORE

> ⚠️ **Actualización V2 (2026-07-07):** `ui-ux-pro-max` es la HERRAMIENTA ESTÁNDAR de
> research del `design-director` (ya no "consultiva subordinada"). Sigue sin ser
> autoridad de marca: la coherencia la juzgan design-director/VQD y el owner.


Skill instalada: `.claude/skills/ui-ux-pro-max` (design intelligence — estilos,
paletas, font pairings, UX guidelines, chart types). Esta política define **cómo y
cuándo** puede usarse dentro de SYNTRA. Es de cumplimiento obligatorio.

## Principios

- **No reemplaza la identidad SYNTRA.** Es una herramienta de **inspiración,
  búsqueda, auditoría y criterios** UI/UX — nunca la fuente de verdad visual.
- **Los reference-locks aprobados tienen prioridad.** Ante cualquier conflicto entre
  una recomendación de la skill y un `docs/reference-locks/*` (`status: approved`) o
  los tokens de `src/app/globals.css`, **gana SYNTRA**.
- **No puede imponer paleta, tipografía ni layout** que contradiga la identidad
  SYNTRA (azul = acción, cyan = sistema/inteligencia, violeta = IA, ámbar = humano;
  base slate; tipografías Sora/Inter/Space Grotesk).
- **Prohibido derivar en** SaaS genérico, crypto, gamer, dashboard genérico o glass
  excesivo. (La skill incluye estilos como glassmorphism/neumorphism/brutalism: NO
  se adoptan salvo que un reference-lock aprobado lo pida explícitamente.)

## Flujo obligatorio

1. **Uso permitido:** auditorías de accesibilidad (contraste, focus, ARIA, touch
   targets), chequeo de spacing/jerarquía/responsive, y sugerencias de paleta /
   tipografía / estructura **como input**, nunca como decisión final.
2. **Filtro de diseño:** toda recomendación de la skill pasa por
   `creative-director` + `design-system-guardian` antes de considerarse. El
   `design-system-guardian` puede vetar cualquier sugerencia que genere drift.
3. **Gate visual intacto:** cualquier implementación visual **Cat B/C** derivada de
   la skill requiere **reference-lock aprobado + visual gate + OK del owner** (reglas
   11/14 de CLAUDE.md). La skill **no** habilita commitear UI sin gate.
4. **Sin auto-paleta / auto-design-system sobre el repo:** no usar `--persist` ni el
   generador de design system para sobreescribir tokens. Los tokens se editan a mano
   en `globals.css`. Si se persiste un design system, va a un scratch fuera de `src/`,
   no se versiona como fuente de verdad.

## Operación

- CLI de búsqueda (no toca la web):
  `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|ux|landing|chart|product>`
- Requiere Python 3.x. En esta máquina el binario real es
  `C:\Users\Mati\AppData\Local\Programs\Python\Python312\python.exe` (el alias de
  Microsoft Store en PATH no sirve).
- La skill es local al repo y MIT; sin telemetría ni llamadas de red en runtime.

## Resumen de una línea

UI UX Pro Max **asiste**; SYNTRA **decide**. Reference-locks + Design System Guardian
+ visual gate mandan siempre.
