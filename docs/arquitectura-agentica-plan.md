# Arquitectura agéntica SYNTRA — el verificador independiente

**Vigente desde 2026-08-17** · **Base:** `f624aa2`
**Qué resuelve:** el hueco por el que 13 fugas de datos convivieron con PRs aprobados.

---

## 0. La conclusión, primero

Se evaluó la arquitectura de agentes de opencode contra la nuestra. **El resultado es que ya tenemos la forma**: coordinador → implementador → verificador existe y está bien armada.

**Lo que faltaba no era arquitectura. Era una pregunta que nadie hacía, y un retorno que no existía.**

Se agrega **un** agente y **un** loop. No se porta nada de opencode.

---

## 1. Qué se cosechó de opencode (y qué no)

### Ideas transferibles

| Idea | Estado acá |
|---|---|
| Verificador read-only **por construcción** (el toolset impone la independencia, no el prompt) | Ya lo hacíamos |
| Modelo distinto por agente | Soportado (`model:` en frontmatter) |
| **Tope de iteraciones** | **No teníamos** → §4 |
| Permiso de delegación (quién invoca a quién) | De facto: ningún agente declara `Task` |

### Config de su runtime — NO se porta

`opencode.json` · `mode` · `temperature`/`top_p` · `steps` · `permission.bash` por agente · `hidden`/`disable`/`color` · el `@mention`.

### Mapeo real contra Claude Code

| opencode | Claude Code |
|---|---|
| `tools: {write:false}` (denylist) | `tools: Read, Grep, Glob` (allowlist) — **mismo efecto** |
| `model` por agente | Soportado en frontmatter |
| `permission.bash` por agente | **Los permisos son globales** (`settings.json`) |
| `temperature` / `steps` | Sin equivalente |
| `permission.task` | Sin runtime — pero **ningún wrapper tiene `Task`**, así que ningún agente puede invocar a otro |

> **Consecuencia de diseño:** como ningún agente puede invocar a otro, **el loop lo orquesta la sesión principal, sí o sí.** El verificador no puede devolverle el trabajo al implementador por su cuenta.

---

## 2. Por qué falló — y no fue complacencia

La hipótesis intuitiva es que el verificador aprueba porque comparte contexto con el implementador. **La evidencia dice otra cosa: nunca se le preguntó.**

| Hecho | Evidencia |
|---|---|
| Su alcance excluye el incidente | `CLAUDE.md:385` — *"valida antes de cerrar cualquier **trabajo web**"*; la fuga era backend/SQL |
| Su mandato no tiene seguridad | La palabra *"seguridad"* **no aparece** en las 283 líneas de `agents/development/qa-performance-guard.md` |
| El baseline cuelga del implementador | `backend-engineer.md:3` *"Runs under syntra-scale-security-baseline"* — se autoevalúa |
| El baseline tampoco la cubre | `syntra-scale-security-baseline` tiene **0 menciones** de RLS, GRANT, PostgREST, privilegio o aislamiento |
| El DoD no-visual es el más flojo | `syntra-visual-gate/SKILL.md:35` exime: *"may commit on technical QA alone"* = tsc + lint + build |

> **Un verificador con contexto fresco pero el mismo mandato tampoco la habría encontrado.** `tsc`, `lint` y `build` pasan perfecto sobre un `UPDATE` sin GRANT por columna: el código compila. **Contexto fresco es necesario, no suficiente. Falta la pregunta.**

### El incidente, para que no se diluya

`projects/stockflow-app/docs/permisos-audit.md`: **13 fugas, 9 críticas**, verificadas en vivo con el JWT de una cajera real — costo del catálogo, margen y ganancia por venta, precios de proveedor, deuda de todos los clientes, recaudación histórica.

Causa raíz: **las policies de Postgres son de FILA; el recorte por columna es GRANT.** Y el vector que lo vuelve real: *"la anon key está en el bundle y el empleado tiene JWT — `requireOwner()` en la página es una cortina sobre una API abierta."*

---

## 3. El cambio: un solo agente

`.claude/agents/security-adversary.md` — **el único rol cuyo trabajo es hacer fallar el sistema desde el actor de menor privilegio.**

Su mandato no es teórico: sale del método real de la auditoría (impersonar con JWT y **contar filas, no preguntar por privilegios**) y de los **dos errores que el auditor anotó**:

> *"Un detector que descarta candidatos por una condición que el propio arreglo vuelve falsa no detecta regresiones — sólo se felicita."*
>
> *"Las dos veces el error fue el mismo: confiar en que verde significa correcto, sin haber visto nunca el test en rojo."*

De ahí su obligación central: **antes de reportar "sin hallazgos", reintroducir una fuga conocida y confirmar que el barrido la ve.**

**`code-reviewer` NO se crea:** `/code-review` ya existe en el harness. Crearlo duplicaría un rol.

---

## 4. El loop FAIL → implementador → re-verificar

```
implementador → verificador(es) → ¿PASA?
   ├── sí  → DoD cumplido → commit/PR
   └── no  → hallazgos AL implementador (SendMessage, contexto intacto)
             → re-verificar con verificador NUEVO (fresco, nunca continuado)
             → iteración++
```

1. **El implementador se continúa; el verificador se re-lanza fresco.** Continuarlo lo contamina con su propio veredicto anterior.
2. **Tope: 2 iteraciones** — reusa el contador anti-loop que ya existe (`CLAUDE.md:46-47`), no inventa uno nuevo.
3. **A la 3ª: STOP y escalar al owner** con qué falla, qué se intentó dos veces y por qué no converge.
4. **Un CRÍTICO de `security-adversary` no se itera: frena.** Una escalada de privilegios no es un bug a pulir.

---

## 5. Definition of done

| Tipo de trabajo | DoD |
|---|---|
| Docs, copy, config | Revisión propia |
| UI / visual | `syntra-visual-gate` + OK del owner *(sin cambios)* |
| Técnico / bugfix sin datos | tsc + lint + build *(sin cambios)* |
| **Datos, auth, roles, permisos, migraciones, dinero** | **+ `security-adversary` en verde + `/code-review` sobre el diff** |

---

## 6. Costo y alcance — honesto

Medido sobre 12 subagentes reales de una sesión: media **~67k tokens** y **~3,6 min** (rango 22-105k, 2-11 min).

| Escenario | Delta |
|---|---|
| Docs / one-liner | **0** |
| Feature de UI | +~30k tokens, +1 min |
| **Datos / auth / dinero** | **+~100k tokens, +5-7 min** |

**Qué compra: menos retrabajo.** La escalada permitía suspender cualquier negocio de la plataforma; las 13 fugas exponían la plata del dueño a su propio empleado. Contra eso, 100k tokens es ruido.

**Corre en:** migraciones, RLS, GRANTs, policies · auth, roles, permisos, sesión · dinero (cobros, precios, caja, reportes) · datos de cliente y multi-tenant.

**No corre en:** docs, copy, one-liners, refactors sin cambio de comportamiento, trabajo visual puro (ya tiene su gate).

> **Un pipeline que corre en todo se vuelve trámite y se saltea.** Por eso se ata a dominios nombrados, no a "todo cambio importante".

---

## 7. Implementadores en paralelo — no

**Serializar.** No se adopta porque un diagrama lo muestre.

Evidencia de una semana en este repo de un solo dev:

- **6 worktrees vivos, 5 desactualizados** (hasta 289 commits atrás).
- Una sesión paralela recomendó commitear una regresión del hero creyéndola trabajo aprobado.
- Un PR se mergeó antes del último push y dejó un commit huérfano.
- Un triage de gobernanza dio **7 de 11 archivos como falsos positivos** por leer un checkout viejo.

Las tres colisiones tienen la misma causa: **estado compartido desactualizado**, no falta de paralelismo. Sumar implementadores concurrentes sobre archivos transversales lo multiplicaría.

**Lo que sí paraleliza bien:** verificadores read-only — no escriben, no colisionan. `security-adversary` y `/code-review` corren en paralelo entre sí.

---

## 8. Alcance de arranque

**StockFlow primero** (decisión del owner). Es donde apareció el incidente y donde está el bloque B pendiente. Se extiende al resto si prueba que sirve.

**Anotado sin resolver:** StudioFlow declara el aislamiento RLS como riesgo crítico en su propia `docs/database.md` y hoy nadie lo verifica. Y la **retro-auditoría adversarial de toda la app sigue sin hacerse** — las 4 auditorías existentes (`permisos`, `cobros`, `inventario-escala`, `responsive`) las hizo el mismo actor que construyó el código.

---

## 9. Deuda de gobernanza que esto destapa

1. `agents/ROLE-AUTHORITY-MAP.md §4.1` es **pre-V2**: lista 18 roles, 6 de ellos eliminados por la reforma, y se declara "fuente única". Además pone a QA (#15) **por debajo** de los engineers (#12/#13), contradiciendo a `qa-governance-layer.md:156`.
2. Rutas de escalada que nombran roles inexistentes (`qa-governance-layer.md:135-141`).
3. Los implementadores **no tienen `Bash`** pero `motion-3d-engineer.md:53-57` les exige correr `tsc`/`lint`/`build`.
4. `syntra-scale-security-baseline` sin RLS/GRANT/aislamiento, pese a que la app canónica que cita lo declara riesgo crítico.

---

## 10. Verificación

1. **Prueba de fuego:** correr `security-adversary` contra el commit **anterior** a la migración 051. **Si no encuentra las fugas conocidas, el mandato está mal escrito** — es la prueba, no una formalidad.
2. **El loop corta:** provocar 3 iteraciones fallidas y confirmar que escala al owner en vez de seguir.
3. **El alcance no se desborda:** un cambio de copy no debe disparar el pipeline.
4. **Costo medido:** tokens y tiempo de una tarea de datos antes/después, contra el rango estimado.
5. Reusar `projects/stockflow-app/supabase/tests/verify-permisos.sql` (12 bloques, ya probado rompiéndolo a propósito) como base del barrido.
