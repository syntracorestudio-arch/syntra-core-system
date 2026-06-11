# docs/ — Índice y clasificación

> Clasificación CORE-002 (Fase 1). **Nada se mueve ni se borra aquí** — solo se
> etiqueta para decidir movimientos en Fase 2.

## Leyenda

- **[OS]** — documentación del sistema operativo / marca SYNTRA CORE. Pertenece a la raíz.
- **[WEBSITE-SPEC]** — spec de implementación del website. Debería vivir en
  `projects/syntra-core-website/docs/`.
- **[CANDIDATE-MOVE]** — propuesto a mover en Fase 2 (vigente, pero mal ubicado).
- **[ARCHIVE-CANDIDATE]** — versión superada por una posterior; revisar si archivar.

## Clasificación

| Archivo | Clase | Notas |
|---|---|---|
| `services.md` | [OS] | Servicios / filosofía comercial. |
| `stack.md` | [OS] | Stack oficial (solapa con CLAUDE.md). |
| `standards.md` | [OS] | Estándares técnicos. |
| `systems.md` | [OS] | Arquitectura de sistemas. |
| `workflows.md` | [OS] | Workflows & automatizaciones (nivel marca). |
| `ui-direction.md` | [OS] | Dirección visual general. |
| `site-map.md` | [WEBSITE-SPEC] [CANDIDATE-MOVE] | Site map del website propio. Verificar antes de mover si también cumple rol OS/comercial. |
| `hero-v1-spec.md` | [WEBSITE-SPEC] [CANDIDATE-MOVE] | Spec de implementación del Hero. |
| `para-quien-v1-spec.md` | [WEBSITE-SPEC] [CANDIDATE-MOVE] | Spec sección "Para quién". |
| `syntra-color-depth-spec.md` | [WEBSITE-SPEC] [CANDIDATE-MOVE] | Sistema de color/depth del sitio. |
| `synapse-graph-event-loop-v3.md` | [WEBSITE-SPEC] [CANDIDATE-MOVE] | Versión vigente (v3) del Synapse Graph. |
| `hero-synapse-graph-icons-fix.md` | [WEBSITE-SPEC] [ARCHIVE-CANDIDATE] | Fix v2, superado por v3. |
| `hero-synapse-graph-fix-spec.md` | [WEBSITE-SPEC] [ARCHIVE-CANDIDATE] | Fix v1, superado por v3. |

## Pendiente Fase 2

- Mover los `[CANDIDATE-MOVE]` a `projects/syntra-core-website/docs/` (verificar
  referencias por path antes).
- Revisar los `[ARCHIVE-CANDIDATE]` contra el estado real del Hero (Home V1 FROZEN)
  antes de archivar.
