# Capa de diseño SYNTRA — jerarquía, presupuestos y gate

**Estado:** vigente desde 2026-08-17 · **Base:** `76e233c`
**Qué es:** el documento que resuelve quién manda cuando dos fuentes de diseño se contradicen, cuánto motion y profundidad tolera cada producto, y cómo se verifica que algo no salió genérico.

> **Este documento es el único lugar donde vive el orden de autoridad.** Ningún otro archivo vuelve a declarar su propia precedencia (ver §1.3).

---

## 0. Por qué existe

El owner detectó output genérico —secciones planas, cards sin profundidad, todo igual— y evaluó sumar tres skills de diseño externas volviendo la capa obligatoria.

**El diagnóstico mostró que las skills no eran la variable.** Se instala una de las tres, y no es lo que arregla el problema. Lo que lo arregla está en §2 y §3 de este documento.

---

## 1. JERARQUÍA DE AUTORIDAD

Criterio: **proximidad a una decisión verificada del owner**; a igual proximidad, **especificidad de alcance**.

| # | Fuente | Por qué está ahí |
|---|---|---|
| 1 | **Decisión explícita del owner** (OK/rechazo sobre prototipo vivo) | Es la única aprobación que existe. Todo lo demás predice su gusto. |
| 2 | **Límites duros** (AA, ≥7:1 en dinero, CLS 0, reduced-motion, honestidad de datos, latencia del POS) | Contrato con el usuario final, no estética. |
| 3 | **Tokens del producto** (`globals.css`) | Ganan como **canal de implementación**, no como criterio estético. |
| 4 | **Reference-lock de la sección tocada** | Documenta un OK real sobre un artefacto concreto. **Manda en su sección; nunca legisla fuera.** |
| 5 | **Presupuesto de producto** (§2) | Gana sobre la doctrina general, que se escribió mirando solo la web. |
| 6 | **`design-freedom-v2`** | Doctrina de gusto de marca vigente. |
| 7 | **`living-web-doctrine`** | Subordinada a la 6 y **solo marketing**. En producto operativo no aplica en ningún punto. |
| 8 | **Skills SYNTRA de método** | Regulan proceso, no gusto. |
| 9 | **Research** (`ui-ux-pro-max`, skills externas) | Aportan valores por defecto **donde arriba no hay número**. Nunca ganan sobre nada. |

**Aclaración del nivel 3:** los tokens no ganan la discusión estética — ganan la implementación. Toda decisión de los niveles 1-2 se ejecuta *agregando o cambiando un token*, nunca esquivándolo con un hex suelto. Una regla que no se puede expresar en tokens no es sistema: es un one-off.

**Aclaración del nivel 9:** una skill externa **no se instala como autoridad, se cosecha**. Solo asciende transcribiendo sus números al presupuesto de producto (nivel 5).

### 1.2 Desempate

1. **Especificidad** — gana el alcance más chico: sección > producto > marca > general.
2. **Recencia con evidencia** — a igual especificidad gana lo más reciente que cite una aprobación o rechazo fechado del owner. **Recencia sin evidencia no gana.**
3. **Empate persistente = no se decide en código** — dos variantes vivas y decide el owner.
   **Prohibido promediar: el promedio de dos direcciones es exactamente lo genérico.**

### 1.3 Higiene que hace cumplible el orden

- **Ningún documento declara su propia precedencia.** El orden vive solo acá. Se retiran los encabezados tipo *"ante conflicto manda este documento"*.
- **Los disclaimers vencen a 30 días.** Un archivo cuyo cuerpo contradice su encabezado se corrige o se le borra el cuerpo contradictorio. *"Ignorar toda regla de este archivo que…"* es un parche con fecha, no un estado permanente.

---

## 2. LOS DOS PRESUPUESTOS

No hay una regla única para todo. StockFlow es una **herramienta operativa**; la web es un **sitio de marketing**. Un mandato de "hacelo delicioso" dañaría el POS.

Invariante común: **una sola familia de easing y una sola escala de duración**; cada presupuesto la corta en un punto distinto. `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` es la curva de entrada en ambos productos.

### 2.A — Presupuesto OPERATIVO (StockFlow, todo POS/admin futuro)

**Regla madre:** en la ruta crítica de venta (escanear → agregar → cobrar → imprimir) el motion es exclusivamente **acuse de recibo de una acción**. Nada entra, sale ni se desliza por gusto.

**Motion por frecuencia de uso:**

| Frecuencia | Presupuesto |
|---|---|
| >50 veces/día (tocar producto, escanear, cantidad) | ≤120ms, solo transform/opacity/box-shadow |
| 5-50 veces/día (abrir cliente, filtrar, cambiar fecha) | ≤180ms |
| <5 veces/día (config, cierre de caja, alta de plan) | ≤240ms |

Topes por elemento: hover/press 100-140ms · tooltip 120-160ms · dropdown 140-180ms · sheet/modal 180-240ms · toast 180ms entra / 140ms sale.
**Techo absoluto en rutas autenticadas: 240ms.**

**Reglas duras:**
- `--ease-out` en entradas **y** salidas. **Prohibido `ease-in`, `ease-in-out`, spring y bounce.**
- Nunca `scale(0)`: arrancar en 0.95-0.97 + opacity. Desplazamiento ≤8px.
- **Nunca animar el resultado de una acción iniciada por teclado. El lector de código de barras ES un teclado** — el producto escaneado aparece sin transición.
- **Cero stagger en listas de datos.** Máximo 3 elementos × 40ms, y solo en dashboards.
- Cero scroll-linked, parallax o canvas/WebGL con datos en pantalla. 3D solo en login.
- Loops infinitos solo en pantallas sin tarea (login, empty states).

**Profundidad — 4 superficies + 3 elevaciones, tokenizadas, y nada más:**

```css
--surface-0: #0a0d13;  /* lienzo */
--surface-1: #0e1219;  /* hundida — colecciones / CardList */
--surface-2: #111621;  /* card estándar */
--surface-3: #171d2a;  /* overlay: popover / modal / sheet */

--elev-0: inset 0 1px 0 rgb(255 255 255 / .04);                                   /* card */
--elev-1: inset 0 1px 0 rgb(255 255 255 / .06), 0 1px 2px rgb(0 0 0 / .4);        /* hero / hover */
--elev-2: 0 8px 24px -8px rgb(0 0 0 / .6), inset 0 1px 0 rgb(255 255 255 / .06);  /* overlay */
```

- Ningún hex de superficie fuera de esos 4; ninguna sombra fuera de esas 3.
- **Sombra proyectada SOLO en `--elev-2`** (overlays). En dark, una sombra proyectada sobre una card de contenido lee como suciedad, no como altura.
- **El glow no es elevación**: es semántica (plata, alerta). Nunca para "destacar" sin significado.
- `--primary` reservado a acción primaria, foco y selección. No decora.

**Densidad — donde vive la riqueza en un POS:**
- Fila táctil ≥44px en `/pos`; 36px en listas admin de escritorio.
- `.tabular` obligatorio en toda columna de dinero.
- Cada fila lleva **3 a 5 datos** (identidad + número clave + estado). Riqueza = más dato útil por línea, no más padding.
- Máximo 2 `CardHero` por pantalla. **Prohibido card dentro de card.**

**Los 4 arquetipos de cuerpo (y basta):** lista densa · stack de cards · grilla · full-bleed.
Dos rutas del mismo arquetipo **pueden verse iguales — eso es correcto.** La constancia del encabezado en una herramienta operativa es consistencia funcional (orientación, aprendibilidad), no pereza.

**Límites duros:** checkout p95 ≤15s (`docs/prd.md:66`); ninguna animación del camino crítico suma >120ms acumulados · CLS 0 con skeletons de altura exacta de la fila real · respuesta visual ≤100ms desde el input en alta frecuencia · AA en el peor caso, ≥7:1 en dinero · dark-only.

**Prohibido explícito:** parallax · scroll-linked · canvas/WebGL con datos en pantalla · gradiente decorativo en superficies de lista · glass/blur detrás de números · bounce/spring · entradas >240ms · loops con datos · animar layout · hover como único canal de información.

### 2.B — Presupuesto MARKETING (web SYNTRA)

**Regla madre:** la belleza es propósito suficiente. Los límites son técnicos.

- **Permitido:** reveals por progreso de scroll, parallax ≤12% del viewport, 3D R3F lazy, fondos vivos por sección, auroras/beams/partículas/glass.
- **Duraciones:** reveal de sección 500-900ms · stagger 60-120ms (máx 6 elementos) · hover de card 200-300ms · transición de página 300-400ms · loops ambientales con período ≥6s.
- **Easing:** `--ease-out` en entradas; `ease-in-out` en loops ambientales; spring en interacción directa (drag, carrusel).
- **Profundidad en 4 capas:** fondo vivo → campo medio (glow/aurora) → superficie (glass permitido) → contenido. Sombra proyectada y glow permitidos como recurso estético.
- **Técnico:** LCP no bloqueado (3D lazy) · CLS 0 · pausa fuera de viewport con IntersectionObserver **obligatoria** · reduced-motion → frame final digno · **máximo 1 canvas activo simultáneo** · ≤150 KB gz de JS de motion por página · Lighthouse ~90+ mobile.
- **Carácter:** cada sección con **carácter nombrado** en su lock (hoy 9/9) + **fondo distinto de sus vecinas** + **transición declarada con la sección anterior y la siguiente**. Esto último hoy solo lo hace `faq.md` ("puente térmico"); se eleva a norma para locks nuevos.
- **Prohibido:** scroll-jacking · templates/stock sin adaptar · color fuera de la familia de marca · datos inventados · hover como único canal · **más de 2 efectos compitiendo por el foco en un mismo viewport**.

---

## 3. EL GATE "NO GENÉRICO"

No es un vibe: son 8 condiciones que un revisor marca pass/fail. Los ítems 1-4 son automatizables (`npm run design:lint`); los 5-8 requieren ojo, con criterio medible.

| # | Condición | Verificación | POS | MKT |
|---|---|---|---|---|
| 1 | Cero color/sombra hardcodeado fuera del archivo de tokens | `rg "bg-\[#\|shadow-\[\|border-\[#" src/ --glob '!app/globals.css'` → 0 | ✅ | ✅ |
| 2 | La escala de elevación existe y se usa | `rg -- "--elev-" globals.css` ≥3 | ✅ | ✅ |
| 3 | Cero superficies fuera del sistema de cards | `rg "rounded-xl border border-border" --glob '!card-system.tsx'` → 0 | ✅ | shell del lock "Dos rails" |
| 4 | Shell único, no copiado a mano | `rg "mx-auto max-w-.*px-4 py-6"` → exactamente 1 | ✅ | ✅ |
| 5 | **Jerarquía en un frame** — captura pasada a escala de grises: se distinguen ≥3 niveles de luminancia de superficie, y el elemento de mayor contraste ES el dato por el que existe la página | Screenshot + desaturar. Si en gris todo es un plano: **FAIL** | ✅ | ✅ |
| 6 | **Carácter declarado** — POS: cada ruta declara su arquetipo y su protagonista. MKT: lock con carácter nombrado + fondo distinto de vecinas + transición declarada | POS: comentario de cabecera en `page.tsx`. MKT: lock + captura de 2 secciones contiguas | ✅ | ✅ |
| 7 | Presupuesto de motion respetado | `rg "duration-\d+"` contra la tabla del producto: en rutas autenticadas 0 resultados >240ms | ✅ | ✅ |
| 8 | **Prueba de sustitución de marca** — pisar `--primary: #64748b` y ocultar el logo: la pantalla sigue reconocible por su ESTRUCTURA. Si queda "cualquier dashboard de shadcn": **FAIL** | DevTools + captura comparada | ✅ | ✅ |

**Aplicación:** los 8 se corren **antes de mostrarle nada al owner**, no después del rechazo.
FAIL en 1-4 → se arregla sin consultar (deuda mecánica). FAIL en 5-8 → vuelve al `design-director` antes de seguir codeando.

---

## 4. CUÁNDO APLICA (alcance y costo)

**El mandato se activa solo si la tarea TOCA UI.** No aplica a migraciones, crons, backend ni docs.

La maquinaria ya existe:
- **`syntra-structure-radar.mjs`** (`UserPromptSubmit`) — matchea nombres de sección, de **componente**, de **propiedad** (spacing/color/sombra/motion), síntomas ("se ve genérico") y rutas (`.tsx`, `globals.css`). Inyecta el disparador junto al prompt. **Nunca bloquea.**
- **`syntra-ui-guard.mjs`** (`PreToolUse`) — si se edita `src/components/**` o `src/app/**/*.tsx` sin diseño consultado, avisa **una vez por sesión**.

**Único cambio necesario:** que el guard nombre **el presupuesto del producto** según la ruta (`projects/stockflow-app/**` → operativo · `projects/syntra-core-website/**` → marketing). Coste: cero tokens extra, es la misma línea que ya se inyecta.

**Sobre cargar skills de diseño en cada tarea:** no se hace. Los números de `emil-design-eng` ya viven transcritos en §2.A. La skill se invoca solo en tareas de motion.

### `ui-ux-pro-max` — cuándo sí y cuándo no

Es una **base de datos de research** (290 KB de CSV + buscador BM25), no un conjunto de reglas. Su valor es de *exploración*, y paleta y tipografía ya están decididas y bloqueadas en tokens.

| Momento | Rol |
|---|---|
| Sección **nueva** sin lock | ✅ Research de dirección — donde aporta |
| Retoque de sección con lock aprobado | ❌ No se invoca. Manda el lock. |
| Auditoría (a11y, jerarquía, spacing) | ✅ Su dataset `ux-guidelines` (99 reglas) |
| Elegir paleta o tipografía | ❌ **Nunca** — están en tokens |

---

## Anexo A — Vetting de las skills candidatas (2026-08-17)

Datos de la API de GitHub y de los árboles de archivos reales, no del README.

| | emilkowalski/skills | leonxlnx/taste-skill | pbakaus/impeccable |
|---|---|---|---|
| Licencia | MIT | MIT | Apache-2.0 |
| Tamaño | **102 KB** | 33 MB | **340 MB** |
| Ejecutables | **CERO** (17 `.md`) | `skill.sh` + 4 `.mjs` | `cli/`, `scripts/`, `extension/`, `plugin/` |
| Escribe en tu repo | no | no | **sí** (`PRODUCT.md`, `DESIGN.md`) |
| Veredicto | **cosechar** | **no** | **no** |

- **emilkowalski** — árbol recursivo completo: 17 markdown y ni un ejecutable. Único aporte de reglas con números (frecuencia, duraciones, curvas, física). **Su tabla de frecuencia dice que lo usado 100+ veces/día no se anima — eso *es* la doctrina del POS, escrita por un tercero.** Sus valores están transcritos en §2.A.
- **taste-skill** — `skill.sh` es un array bash nombre→ruta, sin red ni ejecución remota; los `.mjs` son tooling del README propio. Se descarta por sustancia, no por seguridad: **su propio SKILL.md dice *"Not dashboards, not data tables, not multi-step product UI"*** — se autoexcluye del territorio donde está el problema. Se cosechó una idea: su "Anti-Default Discipline" → ítem 8 del gate.
- **impeccable** — el rechazo **no es por malicia**. Ejecuta scripts (`allowed-tools: Bash(npx impeccable *)`), escribe `PRODUCT.md`/`DESIGN.md` dentro del proyecto y trae **su propio `CLAUDE.md` de 40 KB**: crearía una cuarta capa de doctrina compitiendo con esta. Su única idea buena —los *Modes* Operate vs Persuade— es §2 de este documento.

---

## Anexo B — Diagnóstico: por qué el output salía genérico

**La prueba decisiva:** mismos agentes, mismas skills, misma doctrina.

| | Web SYNTRA | StockFlow admin |
|---|---|---|
| Locks con carácter nombrado | **9** | **0** |
| Resultado | Diferenciada | Homogénea |

El producto con intención declarada salió diferenciado; el que no la tiene salió homogéneo. **Las skills no eran la variable.** Tres causas independientes, ninguna resoluble con una skill:

1. **No hay intención de diseño declarada.** La doctrina solo pide diferenciación de *fondo*, y solo para la web. `design-freedom-v2` no menciona diferenciación entre secciones en ningún punto. El único lock que define una sección por contraste con sus vecinas es `faq.md`.
2. **Falta la primitiva.** StockFlow no tiene **un solo token de sombra**: no existe escala de elevación. No se puede pedir profundidad a quien no tiene con qué hacerla.
3. **El sistema se bypassea.** `card-system.tsx` tiene 4 niveles de jerarquía; solo 5/12 páginas lo importan. Las otras 7 reimplementan la card a mano **perdiendo el bevel y la entrada**.

**Corrección a la hipótesis original:** *"todas las secciones son banda + cards"* es half-true. Solo 2/12 son grillas de cards (6/12 son listas densas). Y la banda repetida en 11/12 **no es un defecto** — en un POS es consistencia funcional. El defecto real es que **la banda es el único dispositivo de jerarquía y el cuerpo debajo no tiene ninguno**.

**Evidencia de que faltaba un número, no gusto:** `.sf-tap` —el feedback táctil más frecuente de todo el POS— dura **350ms**, y las entradas de `card-system` usan **`duration-500`**. Son duraciones de marketing dentro de una herramienta operativa. Nadie las eligió mal: no había un presupuesto que respetar. Ahora lo hay (§2.A).

---

## Anexo C — Pendientes derivados

| Pendiente | Estado |
|---|---|
| Tokens `--surface-*` / `--elev-*` en StockFlow | ✅ **HECHO** (2026-08-20). Los tres primeros ya existían con otros nombres; lo que faltaba era `--surface-1` —el nivel de las COLECCIONES— que vivía como `bg-[#0e1219]` repetido en 5 archivos. Se sumó `--border-hover`, el otro hex compartido. |
| `card-system.tsx`: `duration-500` → 200ms + tokens de elevación | ✅ **HECHO**. Y también `PageHeader` (lo importa toda ruta del admin, así que era la duración más percibida del producto), `reportes` y `reposicion`. **Cero `duration-500` en rutas autenticadas.** |
| `.sf-tap` 350ms → ≤140ms | ✅ **HECHO** — 120ms. Es acuse de recibo de tocar un producto en el POS: >50 usos/día, el tramo más apretado de §2.A. |
| Migrar las 7 rutas que reimplementan la card | **Parcial.** Las 4 que reimplementaban la SUPERFICIE de colección ahora usan el token (cambio sin efecto visual). Migrarlas al componente `CardList` cambia padding y estructura: es un ítem aparte, no se hizo en la tanda de tokens. |
| Sombras `inset` sueltas fuera de la escala | **Parcial.** Las 3 que coincidían EXACTO con `--elev-0` migraron. Quedan 3 de `rgba(255,255,255,0.06)` que tienen sólo el inset, mientras `--elev-1` además lleva sombra proyectada: reemplazarlas CAMBIARÍA el aspecto, y eso no se hace dentro de una tanda de tokenización. Requiere decisión de diseño. |
| Lock de sistema `stockflow-sistema.md` (4 arquetipos) | Tras los tokens |
| Retirar auto-declaraciones de precedencia (§1.3) | Pendiente |
| Resolver 3 skills con cuerpo contradictorio | **Prerequisito** — sumar fuentes sobre esa base produce la mezcla que se quiere evitar |
| `agents/governance/ui-ux-pro-max-usage.md` | Actualizar: cita semántica de color derogada y roles que V2 eliminó |
