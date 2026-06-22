# SYNTRA CORE — DAILY BOOTSTRAP

Arrancamos sesión de trabajo.

No tocar archivos todavía.
No modificar código.
No editar documentación.
No commitear.
No pushear.
No ejecutar cambios destructivos.
No aplicar stashes.
No usar `git add .`.

Sí podés leer archivos y ejecutar comandos de diagnóstico.

## Objetivo

Quiero que te ubiques en el sistema SYNTRA antes de trabajar.

Antes de proponer o ejecutar cualquier tarea, cargá contexto, revisá el estado real del repo y reportá riesgos.

## Leer contexto obligatorio

La fuente principal de gobernanza SYNTRA en este repo es
`agents/ROLE-AUTHORITY-MAP.md`. No existe `agents/SYNTRA-OPERATING-SYSTEM.md`
y no debe crearse ni buscarse.

Revisar:

```text
CLAUDE.md
agents/ROLE-AUTHORITY-MAP.md
agents/development/web-delivery-pipeline.md
projects/syntra-core-website/TASKS.md
docs/creative-library/ si existe
docs/visual-reset/ si existe
.claude/skills/ si existe
.claude/agents/ si existe
.claude/commands/ si existe
```

## Confirmar herramientas disponibles

Confirmar si están disponibles/invocables:

```text
visual-quality-director
syntra-visual-gate
syntra-premium-section-design
syntra-premium-motion-system
syntra-safe-commit-gate
syntra-creative-direction
syntra-daily-bootstrap
```

Si alguna no aparece, reportarlo.

## Estado esperado reciente

Usar esto solo como referencia inicial.
La fuente real siempre es Git y los archivos del repo.

Estado conocido:

```text
Branch esperada:
visual-reset/hero-redesign

Último checkpoint aprobado:
fc82612 — feat(web): add image-led use cases section

Casos:
cerrado, aprobado, commiteado y pusheado en origin/visual-reset/floating-product-scenes.

Hero:
en rediseño sobre branch visual-reset/hero-redesign.
Prototipo local posible, pendiente de revisión visual del owner antes de commit.

H1 aprobado del Hero:
Sistemas digitales que hacen crecer tu negocio

Dirección aprobada del Hero:
Hero premium de dos columnas:
izquierda = copy claro + CTA + bullets
derecha = objeto-firma Digital Arc / Kinetic Ribbon
background = dark premium con glow, spotlight, mesh, grain y motion sutil.

No usar Spline en esta iteración salvo aprobación explícita.
No tocar Casos salvo instrucción explícita.
```

Stashes conocidos:

```text
WIP visual reset remaining before hero redesign
Contacto 013C
```

No aplicar ningún stash sin aprobación explícita.

## Revisar estado del repo

Ejecutar:

```bash
git branch --show-current
git status --short
git status
git stash list
git log --oneline -5
```

## Revisar estado del proyecto web

Indicar:

```text
- branch actual
- si main está intacto
- working tree limpio o no
- archivos modificados / nuevos
- stashes importantes
- si existe stash de Contacto 013C u otro WIP relevante
- última tarea cerrada
- próxima tarea según TASKS.md
- riesgos abiertos
- migraciones pendientes
- cambios visuales sin commit
- branch visual activa si existe
```

## Si hay cambios visuales sin commit

No asumir que están aprobados.

Reportar:

```text
- archivos tocados
- sección afectada
- si tienen QA
- si tienen screenshots
- si falta aprobación visual del owner
- si conviene ajustar, commitear o descartar
```

## Reglas de aprobación

No asumir que se puede seguir trabajando hasta que reportes el estado.

No interpretar:

```text
continuar
dale
ok
perfecto
seguí
```

como autorización para commitear.

No commitear sin frase explícita del owner:

```text
Aprobado para commit.
```

No pushear sin autorización explícita.

No tocar código ni documentación hasta recibir instrucción posterior al reporte.

## Responder con

```text
# SYNTRA DAILY BOOTSTRAP

## Sistema cargado

## Fuente de gobernanza
agents/ROLE-AUTHORITY-MAP.md

## Skills / agentes disponibles

## Estado Git

## Estado de tareas

## Riesgos abiertos

## Cambios o stashes importantes

## Estado visual actual

## Próxima acción recomendada

## Pregunta al owner antes de tocar archivos
```
