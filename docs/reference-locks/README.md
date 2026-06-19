# Reference Locks — SYNTRA CORE

Esta carpeta guarda los **reference-locks**: el artefacto visual aprobado que
bloquea la dirección de una sección **antes de tocar código**. Es la pieza que
faltaba en el workflow visual (el Hero entró en loop por implementar desde
adjetivos; Casos funcionó porque tenía referencias/asset concretos).

Un reference-lock convierte "quiero algo premium" en algo verificable:
una referencia visual real + qué se toma / qué no + dirección elegida +
decisión asset-first/code-first + criterios binarios de aprobación.

## Qué es esta carpeta
- `_template.md` — plantilla base de un lock.
- `<section>.md` — un lock por sección (ej. `hero.md`, `casos.md`).
- `assets/` — imágenes de referencia / mocks / previews citados por los locks.

## Cuándo se crea un lock
- **Categoría B / C con trabajo visual relevante** (Hero, Casos, Servicios,
  Proceso, Contacto, piezas-firma, backgrounds protagonistas, escenas premium):
  **sí, es obligatorio** antes de implementar.
- **Categoría A** (spacing, hover, typo, responsive polish, bugfix, perf):
  **no requiere lock**.
- Secciones puramente code-first sin protagonista visual (form, FAQ, cards
  informativas, editorial simple): lock liviano solo si son Cat B; si son Cat A,
  no.
- Ante la duda, tratar la tarea como que necesita lock.

La creación del lock la dispara la skill `syntra-reference-lock`, normalmente
invocada al cerrar `syntra-premium-section-design` (el concepto).

## Quién lo aprueba
**El owner.** Claude prepara el lock (`status: draft`) con al menos una
referencia visual concreta y los criterios binarios; solo el owner lo pasa a
`approved` (registrando `approved_by` y `date`).

## draft vs approved
- `draft` — propuesto por Claude. **No habilita código.**
- `approved` — aprobado por el owner. Habilita implementación contra ese lock.

Mientras el lock esté en `draft`, **no se toca código** de esa sección
(tareas Cat B/C).

## No reemplaza al Visual Quality Director
El reference-lock define **el objetivo** (qué hay que lograr). El **VQD valida
después el resultado contra el lock**: compara lo implementado con la referencia
y los criterios binarios, en navegador, antes del commit. El lock le da al VQD
un referente objetivo en vez de "¿se ve premium?".

Flujo completo:
1. `syntra-premium-section-design` → concepto.
2. `syntra-reference-lock` → este artefacto (draft) + decisión asset/code.
3. Owner aprueba el lock (Gate humano #1).
4. (asset-first) crear/aprobar el asset protagonista antes del código.
5. `frontend-engineer` implementa contra el lock (máx 2 iteraciones).
6. `syntra-visual-gate` → VQD valida resultado vs lock → owner aprueba commit
   (Gate humano #2).
7. `syntra-safe-commit-gate` → commit.

## Regla de qué NO cuenta como lock
"Premium", "moderno", "elegante", "con glow" o "tipo Spline" **no son** un
reference-lock. Tiene que haber una referencia visual concreta (screenshot,
moodboard, asset generado, wire aprobado, link de escena, o imagen aprobada por
el owner).
