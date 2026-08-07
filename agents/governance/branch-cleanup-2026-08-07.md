# Limpieza de ramas — 2026-08-07

Registro previo al borrado, aprobado por el owner. **Para recuperar una rama:**
`git branch <nombre> <sha>` y push. Los SHA de abajo siguen siendo alcanzables
mientras el objeto viva en el repo remoto.

Base: `origin/main` = 72c73000d34b05bab7bc2e5afa520d052eb1b762

## Ancestros directos de main (0 commits únicos, merge normal)

| Rama | SHA |
| --- | --- |
| `chore/claude-md-contexto-tokens` | `20da530` |
| `chore/limpiar-assets-huerfanos` | `262b154` |
| `chore/syntra-gobernanza-autotrigger` | `e81a110` |
| `docs/reference-locks-estado-verificado` | `bcd85f1` |
| `docs/stockflow-despliegue-plan` | `29adc4a` |
| `docs/stockflow-onboarding-catalogo` | `ba291c2` |
| `docs/stockflow-onboarding-cero-datos` | `fdf6a08` |
| `docs/stockflow-responsive-audit` | `02e59e7` |
| `feat/stockflow-asistente-catalogo` | `e3f97dd` |
| `feat/stockflow-asistente-fase2` | `8d27743` |
| `feat/stockflow-asistente-inapp` | `62e706b` |
| `feat/stockflow-asistente-proveedor` | `607c44a` |
| `feat/stockflow-categorizar-masa` | `67a9433` |
| `feat/stockflow-import-csv` | `442b87f` |
| `feat/stockflow-ingreso-escala` | `8a32dc7` |
| `feat/stockflow-remito-ia` | `a679c27` |
| `feat/stockflow-total-gondola` | `f9ff6b7` |
| `fix/stockflow-asistente-prueba-real` | `d4a3dbe` |
| `fix/stockflow-pos-quickadd-gate` | `df450fb` |
| `fix/stockflow-responsive-p0` | `ac26c64` |
| `fix/stockflow-responsive-p1` | `f90bb2f` |
| `fix/stockflow-responsive-p2` | `f90bb2f` |

## No ancestros, pero patch-equivalentes (squash/rebase — `git cherry` = 0 únicos)

| Rama | SHA |
| --- | --- |
| `feat/stockflow-alta-ingreso` | `bf7a72f` |
| `feat/stockflow-asistente-narrativa` | `dd9ed3d` |
| `feat/stockflow-camara-hardening` | `514bf97` |
| `feat/stockflow-captura-organica` | `d4627d3` |
| `feat/stockflow-puesta-en-marcha` | `cc8f796` |
| `feat/stockflow-reporte-acciones` | `5d43777` |

## NO se borran

| Rama | SHA | Por qué |
| --- | --- | --- |
| `perf/contacto-jank` | `f4f86c7` | 1 commit único: perf real de la web sin absorber |
| `feat/stockflow-split-dos-electronicas` | `ebbd9bf` | 5 commits únicos, parqueada por decisión del owner |
