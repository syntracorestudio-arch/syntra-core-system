# SYNTRA CORE V2 — ARQUITECTURA CONSOLIDADA (reforma 2026-07-07)

Estado: **ARCHIVO DE REFERENCIA** (el estado "CONGELADO" de V1.1 queda reemplazado
por **evolución con evidencia**: la estructura se mejora cuando el uso real lo pide).

**El roster operativo son los 10 wrappers de `.claude/agents/`** — fusiones V2:
- `design-director` = creative-director + ui-ux-designer + website-experience-auditor
  (usa la skill `ui-ux-pro-max` como herramienta estándar).
- `product-experience-designer` absorbe a technical-product-owner.
- `visual-quality-director` absorbe a design-system-guardian.
- Eliminados como wrappers: project-manager (orquesta el agente principal).
- Ejecutores (`frontend/motion-3d/backend-engineer`) corren en Opus.

Las specs de esta carpeta se conservan como **archivo histórico y detalle profundo**
de cada rol; ante conflicto entre una spec V1.1 y un wrapper V2 (o la doctrina
`docs/creative-library/design-freedom-v2.md`), **manda el wrapper/doctrina V2**.
En particular: las reglas restrictivas de paleta (90/10, "cyan solo HECHO"), los
anti-patrones extensos de los frameworks y el ceremonial lock-antes-de-código
quedaron superseded por la doctrina de libertad de diseño + workflow de
**variantes vivas** (prototipos con motion juzgados por el owner en navegador).

Toda mejora futura sigue priorizando simplificación y fusión antes que expansión —
pero con evidencia, no con congelamiento.

---

## Fuentes principales

### Autoridad

- `agents/governance/role-authority-map.md`

### Ejecución web

- `agents/development/web-delivery-pipeline.md`

### Ejecución automation

- `agents/automation/syntra-execution-protocol.md`

### Fast Track

- `agents/governance/fast-track-protocol.md`

### QA

- `agents/governance/qa-governance-layer.md`

### Estándar premium

- `agents/frameworks/syntra-premium-standard.md`

### Auditoría de experiencia

- `agents/design/website-experience-auditor.md`

### Knowledge Map

- `agents/governance/syntra-knowledge-map.md`

---

## Regla de cierre

SYNTRA CORE no necesita más arquitectura teórica en esta etapa.

A partir de V1.1, cualquier modificación estructural debe estar justificada por uso real en proyectos.

Regla principal:

**usar primero, modificar después.**