# Identidad y acceso — auditoría y propuesta (2026-08-08)

> **PROPUESTA. Sin código, sin migraciones.** Auditado sobre `3b882fb` (= `origin/main`,
> merge del PR #225). Cada afirmación cita `archivo:línea` de esa base.
>
> Motivo: la app está completa y sin desplegar; el primer cliente pago es el próximo
> hito. La identidad es de las decisiones más caras de cambiar después del primer
> cliente, así que se cierra antes del deploy o no se cierra nunca.

---

## DECISIONES DEL OWNER — CONGELADAS (2026-08-08)

1. **Modelo SPLIT aprobado, con email sintético como mecanismo.** Dueño = email real;
   empleado = `kiosco + usuario + clave`, mapeado server-side a un `auth.users`
   sintético. Fundamento: `profile_id` NOT NULL ⇒ el PIN **no puede** esquivar auth, y
   así RLS / `rpc_member` / cobro quedan intactos.
2. **Dueño sin email real: NO.** Si el cliente se resiste a dar su dirección personal,
   **se le crea un buzón del negocio durante el onboarding** (`kiosco.<nombre>@gmail.com`,
   2 minutos) — **nunca uno falso**. El dueño necesita email real para auto-recuperarse,
   para el reporte mensual del asistente y como canal de soporte. Va escrito en el
   protocolo de onboarding (§D).
3. **Dominio sintético: `@staff.stockflow.invalid`** (o `@<slug>.stockflow.invalid`).
   **NO se acopla a la compra del dominio comercial.** La dirección del empleado nunca
   sale del sistema (nunca recibe correo, nunca se verifica): es un identificador
   interno. `.invalid` es TLD reservado por **RFC 2606** ⇒ no puede colisionar jamás con
   un dominio real y hace explícito "esto no es un buzón". Migrarlo después sería un
   `UPDATE` controlado sobre filas que generamos nosotros.
   > **Verificado contra GoTrue local (2026-08-08):** `admin.createUser` con
   > `juan.kiosco-escala@staff.stockflow.invalid` → OK · `signInWithPassword` → OK ·
   > `admin.updateUserById` (el reset del dueño) → OK. El supuesto que sostiene todo el
   > modelo de empleado está probado, no asumido.
4. **Los "tres bugs de lanzamiento" suben a must-have**, con test de ciclo completo. No
   son menores: que un negocio suspendido siga entrando significa que **el ciclo de vida
   del negocio nunca se ejercitó de punta a punta**.
5. **La recuperación tiene que existir DENTRO del producto** — auto-servicio del dueño
   por su email real + reset del empleado por el dueño. *"Matías abre Supabase"* no es un
   camino de recuperación y no escala más allá de tres clientes.

**Sigue abierto (no bloquea el bloque A):** login fail-closed ante limitador caído ·
si el cliente ve la auditoría de SYNTRA · forma exacta de la credencial del empleado
(se avanza con la recomendada: `palabra-NNNN`, 64 palabras, CSPRNG) · SMTP de Supabase
Auth apuntando a Resend (dependencia de infraestructura para `/recuperar` en producción;
en local se valida contra Mailpit).

---

## 0. El titular

**Hoy, si el dueño de un kiosco olvida su contraseña, no hay ningún camino dentro del
producto para recuperarla.** No existe `/recuperar`, ni `resetPasswordForEmail`, ni
`auth.updateUser`, ni `admin.updateUserById`, ni `generateLink`, ni pantalla de
"cambiar mi contraseña" — grep de los cinco sobre `src/` devuelve **0 resultados**.
El único camino es que SYNTRA entre a Supabase a mano.

Eso, con la contraseña que el sistema genera hoy, compone el problema:
`palabra-NNNN` con `Math.random()` sobre una lista de 6 palabras
(`src/app/super/actions.ts:31-36`) — **~54.000 combinaciones**, se muestra una sola vez
(`src/app/super/super-client.tsx:452`), **no hay flag de cambio obligatorio** ni pantalla
para cambiarla ⇒ la contraseña "temporal" es permanente de hecho.

**La segunda decisión de fondo:** hoy dar de alta a una cajera **exige un email**
(`src/app/admin/equipo/equipo-client.tsx:226-238`). En un kiosco real eso es un
bloqueante del onboarding, no una molestia.

---

## A. Auditoría de lo que existe

### A.1 Login

| Hecho | Dónde |
| --- | --- |
| Campos: email + contraseña, sin "recordarme", sin 2FA, sin captcha | `src/app/login/login-form.tsx:32-58` |
| Validación: `email()` + `password.min(1)` | `src/app/login/actions.ts:10-13` |
| Rate limit **10 intentos / 300 s por IP** (no por cuenta) | `src/app/login/actions.ts:33-34` |
| El limitador **falla ABIERTO** si la RPC falla o tira | `src/lib/rate-limit.ts:25,27-29` |
| "Olvidé mi contraseña" | **NO EXISTE** — sin `<Link>` en `login-form.tsx:14-83` |
| El proxy puede mandar `?error=`, pero login **no lee `searchParams`** ⇒ ese aviso nunca se ve | `src/lib/supabase/proxy.ts:58-63` vs `src/app/login/page.tsx` |
| `roleHome()` es código muerto (nadie la llama) | `src/app/login/actions.ts:71-82` |

Comparación útil: **StudioFlow SÍ tiene recuperación completa** —
`projects/pilates-studio-app/src/app/recuperar/actions.ts:20-24` (`resetPasswordForEmail`)
y `.../src/app/cuenta/actions.ts:52` (`auth.updateUser`). Hay precedente propio para
copiar; no hay que inventar nada.

### A.2 Sesión y guardas

- `getSession` resuelve el member por `members.profile_id = auth.uid()` filtrando
  `status='active'`, `.limit(1).maybeSingle()` (`src/lib/session.ts:55-64`).
- **`.limit(1)` sin `ORDER BY`** ⇒ con dos membresías activas el negocio elegido es
  **no determinístico** (`src/lib/session.ts:63`). Hoy inalcanzable desde la UI, pero es
  una bomba con temporizador.
- **Ninguna guarda mira `stores.status`.** El campo se lee (`src/lib/session.ts:59`) y se
  expone en el tipo (`:33`), pero ni `requireSession` (`:91-95`) ni `requireOwner`
  (`:98-102`) lo evalúan ⇒ **un negocio suspendido desde `/super`
  (`src/app/super/actions.ts:118-127`) sigue entrando y operando**. Es el único
  apalancamiento de cobranza que existe, y no funciona.
- Si la base falla, `getSession` devuelve `null` igual que "no hay sesión"
  (`src/lib/session.ts:66`) ⇒ una caída se le presenta al usuario como "no estás
  logueado". El proxy sí es fail-closed (`src/lib/supabase/proxy.ts:45-64`).
- Rutas protegidas por proxy: `["/pos","/admin","/super"]` (`src/lib/supabase/proxy.ts:6`).
  `/api/**` **no** está cubierto por el proxy.

### A.3 Modelo de identidad y RLS — el hecho que decide todo

```
auth.users.id ──1:1──> profiles.id ──FK──> members.profile_id ──> members.store_id
   (001:41, NOT NULL)        (001:53, NOT NULL)
```

- Los cuatro helpers de RLS —`auth_member_stores`, `auth_has_role`,
  `auth_my_member_ids`, `auth_can`— resuelven **todos** contra `auth.uid()`
  (`supabase/migrations/002_rls_policies.sql:18-57`).
- `rpc_member(store_id)` hace lo mismo y es la puerta de ~40 RPCs, **incluida
  `register_sale`** (`supabase/migrations/003_sale_rpcs.sql:19-35`, `:28`).
- No hay claims JWT custom, ni `app_metadata`, ni GUC de tenant, ni header de store.

> **Conclusión dura, y es la que ordena toda la propuesta:** un empleado **sin usuario
> de auth es imposible hoy**, y si se hiciera `profile_id` nullable ese member quedaría
> fuera de absolutamente todo — no leería ni ejecutaría nada. **Cualquier modelo de PIN
> tiene que terminar en un `auth.users`**, no puede esquivarlo.

Nota histórica que conviene no repetir: `create_store` quedó ejecutable por cualquier
`authenticated` desde la 010 hasta la 016 — cualquier cajero podía fabricarse tenants
(`supabase/migrations/016_revocar_execute_publico.sql:1-21`).

### A.4 Atribución de ventas

- `sales.member_id uuid references public.members(id) **on delete set null**`
  (`001_initial_schema.sql:170`); índice `(member_id, sold_at desc)` (`:190`).
- **La baja es soft y la atribución se conserva**: `cambiar_estado_miembro` solo hace
  `update members set status` (`013_caja_y_equipo.sql:239-241`). No existe ningún DELETE
  de members en la app.
- **El riesgo real es el hard delete del usuario de auth**: `auth.users` → `profiles`
  cascade (`001:41`) → `members` cascade (`001:53`) → `sales.member_id` **a NULL**
  (`001:170`). **La historia de ventas sobrevive pero pierde el vendedor, en silencio y
  sin vuelta atrás.**
- No existe ningún reporte de ventas por vendedor; `member_id` se lee en `cierre_caja`
  (`027_pago_dividido.sql:583-589`) y la UI ya tolera el null
  (`src/app/admin/caja/caja-client.tsx:231`).

### A.5 Alta de negocio (`/super`)

- Gate: `profiles.is_superadmin` (`001:44`), **se otorga a mano por SQL**, sin UI
  (`src/lib/superadmin.ts:9-14`).
- Pide: nombre, slug, nombre del dueño, color, **email del dueño**, rubro, switch de
  asistente IA (`src/app/super/super-client.tsx:301-410`). **No pide teléfono ni CUIT.**
- Orden: **primero el usuario de auth** (`src/app/super/actions.ts:56-61`), después
  `create_store` (`:71-77`).
- **Rollback parcial**: si `create_store` devuelve error, borra el usuario
  (`:79-81`) — pero **el resultado del borrado no se chequea** y **no hay `try/catch`**
  alrededor del RPC ⇒ si la llamada *lanza* (red, timeout) queda **un usuario de auth
  huérfano sin que se entere nadie**.
- Siembra **8 categorías y 0 productos** (`010_onboarding.sql:74-82`).
- **Sin rate limiting** en `/super` ni en `/admin/equipo` (ninguno importa
  `@/lib/rate-limit`).
- **Sin `created_by` en `stores` ni en `members`** (`001:26-37`, `:50-65`) y **sin tabla
  de auditoría** ⇒ no queda registro de qué superadmin creó, suspendió o tocó qué.

### A.6 Alta y ciclo de vida del empleado

| Capacidad | Estado |
| --- | --- |
| Alta con nombre + **email** + 5 flags | `src/app/admin/equipo/equipo-client.tsx:212-238`, `:36-42` |
| Cambiar permisos | **SÍ** — `013_caja_y_equipo.sql:172-211` |
| Baja instantánea, solo el dueño | **SÍ** — soft delete, `013:219-242`; no puede darse de baja a sí mismo (`:235-236`) |
| Corte de acceso efectivo con el JWT vivo | **SÍ** — `rpc_member` exige `status='active'` (`003:29`) |
| **Resetear la clave de un empleado** | **NO EXISTE** |
| Cambiar el rol (promover/degradar) | **NO EXISTE**, deliberado (`013:169-170`) |
| Sumar a un profile existente a un 2º negocio | **NO EXISTE** camino en la UI (`equipo/actions.ts:49,57-59`) |

Lo que ya está bien y no hay que tocar: **la baja funciona, es instantánea, la hace el
dueño solo y preserva la atribución.** Es el punto más fuerte del modelo actual.

### A.7 Onboarding de catálogo — el header del doc está desactualizado

`docs/onboarding-catalogo-plan.md:3` se declara "PROPUESTA sin código". **Ya no es
cierto**: F1a (`037_captura_organica.sql`), modo puesta en marcha
(`038_puesta_en_marcha.sql`), total en góndola (`039_total_gondola.sql`), ingreso a
escala (`040`/`041`) e import CSV (`src/lib/csv-import.ts`) **están implementados**.
Falta la pantalla "Carga inicial" (0 hits de `carga_inicial`) y el import SEPA masivo
(hoy 36 filas, sin npm script). **Actualizar ese header es parte de este arco.**

---

## B. Opciones de modelo de identidad

| | Fricción alta | Fricción diaria | Recuperación | Seguridad | Esfuerzo |
| --- | --- | --- | --- | --- | --- |
| **1. Email+clave para todos** (hoy) | **Bloqueante**: la cajera no tiene email | Baja | **Inexistente** | Clave de 54k combinaciones, permanente | 0 (ya está) |
| **2. Split: dueño email real + empleado usuario/clave** | Baja | Baja | Dueño: auto. Empleado: el dueño | Buena si la clave no es de 4 dígitos | **Media-baja** |
| **3. Login por negocio (slug + usuario)** | Baja | Baja (recordar el slug) | Igual que 2 | Igual que 2 | Es *parte* de la 2 |
| **4a. Teléfono/WhatsApp OTP** | Media (verificación) | **Alta**: un SMS por login | Buena | Buena | **Alta** + costo por SMS |
| **4b. Magic link** | Baja | **Inaceptable**: exige buzón en el mostrador | Buena | Buena | Media |
| **4c. Buzón `kiosco@` que creamos** | Media (lo creamos nosotros) | Baja | Buena **si el dueño lo puede abrir** | Buena | Baja |

**Recomendación: la 2, implementada como 3** — el dueño con email real; el empleado con
**kiosco + usuario + clave**, que el servidor mapea a un email sintético
`usuario.slug@staff.<dominio>` y pasa por el `signInWithPassword` de siempre.

**Por qué el sintético y no un modelo de PIN "de verdad":** por §A.3. Todo empleado
**debe** ser `auth.users`. El sintético es el cambio de menor superficie posible:
**cero migraciones de RLS, cero cambios en `rpc_member`, cero cambios en `register_sale`
y en el camino de cobro.** `auth.uid()` es indiferente al string del email.

**Lo que hay que resolver del sintético** (todo chico, todo verificado):

1. **El dominio es IRREVERSIBLE** (queda escrito en cada `auth.users.email`). No usar
   `.local`: es TLD reservado de mDNS (RFC 6762) y hay validadores que lo rechazan. Un
   subdominio propio **sin MX**.
2. Normalizar el usuario (minúsculas, sin acentos, `[a-z0-9]`, 3-20). La unicidad global
   de `auth.users.email` la resuelve el `.slug` por construcción.
3. El error de usuario repetido debe decir *"Ya hay alguien con ese usuario en tu
   kiosco"*, no el actual *"Ese email ya tiene una cuenta en StockFlow"*
   (`equipo/actions.ts:57-59` hoy filtra por el mensaje de GoTrue).
4. El slug **no es secreto** (hay catálogo público desde la 011): el secreto es la clave.
   El error de login debe ser **el mismo** para kiosco inexistente, usuario inexistente y
   clave incorrecta.
5. Recordar el último kiosco en `localStorage` ⇒ en un terminal ya usado el empleado
   escribe 2 campos, no 3.

**Sobre el PIN de 4 dígitos: no.** 10.000 combinaciones contra un endpoint público, con
un limitador que **falla abierto** (`src/lib/rate-limit.ts:25`), es regalado.

| Forma | Espacio | Veredicto |
| --- | --- | --- |
| PIN 4 dígitos | 10⁴ | **No**, ni con rate limit |
| `palabra-NNNN` actual (5-6 palabras) | ~5·10⁴ | **No** como permanente |
| PIN 6 dígitos | 10⁶ | Aceptable **solo** con lockout por cuenta |
| **`palabra-NNNN` con 64 palabras + `crypto`** | ~5,8·10⁵ | **Recomendado**: dictable, memorable, sobrevive al turno |

**El "PIN como desbloqueo local sobre sesión abierta" no reemplaza la credencial**: esa
sesión tiene que ser de *alguien*. Si el terminal guarda la sesión del dueño, todas las
ventas se atribuyen al dueño y los flags `can_sell_on_credit` / `can_see_costs` dejan de
significar algo. Sirve como **capa 2** encima de la sesión del propio empleado
(bloquear la pantalla al ir al baño) — **scope creep para el primer cliente.**

---

## C. Ciclo de vida y operación

- **Baja instantánea: YA FUNCIONA.** El dueño solo, domingo a la noche, efecto inmediato
  aun con el JWT vivo. Falta **el mensaje**: hoy el empleado ve el login genérico y
  parece "puse mal la clave" (`src/app/page.tsx:11,27`) ⇒ llamada al dueño. Debe decir
  *"Ya no tenés acceso a este kiosco. Hablá con el dueño."*, distinto de clave incorrecta.
- **Reset de clave por el dueño: falta.** Acción owner-only → `admin.updateUserById`,
  genera credencial, se muestra una vez. **Debe además cerrar las sesiones abiertas de
  ese empleado** (`admin.signOut(userId, 'global')`): si no, el que se llevó la clave
  sigue adentro.
- **Atribución al remover: ya está bien** por el soft delete. El peligro es el hard
  delete (§A.4) ⇒ **regla dura escrita: nunca borrar un usuario de auth con ventas.**
  El único borrado legítimo es el rollback del alta, antes de que exista una venta.
- **Break-glass de SYNTRA — el reemplazo de "entro a Supabase" no es una herramienta,
  es una tabla que el cliente puede leer:**
  - `platform_audit(actor, action, target_store, target_profile, reason, ip, created_at)`,
    **append-only** (sin policy de UPDATE ni DELETE para nadie; solo inserta service_role).
  - `reason` NOT NULL, mínimo 10 caracteres, tipeada a mano. Sin motivo, la UI no habilita
    el botón.
  - **Todas** las mutaciones de `/super` pasan por ahí, no solo las de emergencia.
  - **Lo que lo convierte en soporte y no en puerta trasera:** el **dueño ve esas filas**
    en su propia pantalla ("Actividad de SYNTRA en tu negocio").
  - Reset de la clave del dueño: verificación fuera de banda contra el WhatsApp del alta.
  - Prohibida la impersonación sin marca. Si alguna vez existe, read-only + banner
    permanente + fila de auditoría.

---

## D. Alta de negocio optimizada

**Credenciales sin mandar contraseñas por WhatsApp: link de invitación, no clave.**
`crearNegocio` deja de devolver `password` y devuelve un **link de un solo uso**
(`admin.generateLink({ type:'invite' })`, que da `action_link` **sin necesidad de SMTP**)
que abre "poné tu contraseña". Lo que viaja por WhatsApp es un bearer de 24 h y un solo
uso, no una credencial permanente. **Bonus: verifica el email por construcción** — si el
dueño abre el link, el buzón existe y él lo puede leer.

Mientras no esté activado, `/super` lo muestra como **"Invitado (sin activar)"** con la
fecha: SYNTRA ve de un vistazo qué altas quedaron colgadas.

**Campos mínimos para abrir un negocio:** nombre · slug (autogenerado) · nombre del dueño
· **email real** · **WhatsApp** (nuevo, es el canal de verificación fuera de banda) ·
rubro · color. Todo lo demás por defecto.

**Secuencia completa, "vendí" → "está vendiendo":**

| # | Paso | Quién | Se rompe si… |
| --- | --- | --- | --- |
| 1 | Datos comerciales (incluye email real + WhatsApp) | SYNTRA + dueño | No tiene email → 1b: ayudarlo a crearlo |
| 2 | Alta en `/super` → link de invitación | SYNTRA | Slug tomado · `already_owner` |
| 3 | El dueño abre el link y pone su clave | **dueño** | **El más frágil**: no le llega, no lo abre, vence |
| 4 | Primer ingreso: 8 categorías, **0 productos** | dueño | Ve la app vacía y se desanima |
| 5 | Elegir arranque: modo puesta en marcha o CSV | dueño | Falta la pantalla que hace explícita la bifurcación |
| 6 | Cargar los 30-50 que más rotan | dueño | Sin SEPA masivo, cada EAN se tipea la 1ª vez |
| 7 | Alta de empleados (usuario + clave dictada + permisos) | dueño | **Hoy le pide email a la cajera ⇒ bloqueante** |
| 8 | Medios de cobro (MP / Point) | dueño + SYNTRA | Point sin validar con device real |
| 9-10 | Primera venta · primer cierre de caja | empleado / dueño | — |

Roturas por probabilidad: **3 (activación) > 7 (email del empleado) > 6 (catálogo) > 8**.
Los pasos 3 y 7 son exactamente lo que resuelve este documento; el 6 tiene plan propio.

---

## E. Benchmark

- **Loyverse** — cada usuario (dueño o empleado) necesita un **PIN único de 4 dígitos**
  para el POS; el email es *opcional* y solo hace falta para el Back Office. El PIN se
  crea al dar de alta y **solo el dueño lo ve o lo cambia**.
  [PIN code access](https://help.loyverse.com/help/pin-code-access) ·
  [login con email](https://help.loyverse.com/help/how-give-employees-access-login)
- **Square** — tres niveles: passcode de dueño, **passcode de equipo compartido** (con la
  advertencia explícita de que **no permite atribuir ventas ni tiempo por persona**) y
  passcode personal de 4 dígitos. Ese trade-off es exactamente el de `sales.member_id`.
  [Passcodes en el POS](https://squareup.com/help/us/en/article/8357-require-passcodes-at-point-of-sale) ·
  [team members](https://squareup.com/help/us/en/article/8356-add-and-manage-team-members)
- **Fudo** (AR) — usuarios ilimitados, 3 roles editables, **PIN de autorización** por
  usuario… **solo en Plan Pro**.
  [Usuarios](https://soporte.fu.do/es/articles/11730990-usuarios) ·
  [Permisos](https://soporte.fu.do/es/articles/11730992-funcion-de-permisos-de-usuario)
- **Supabase** — el patrón soportado para identidad multi-tenant es el **Custom Access
  Token Hook** que inyecta claims en el JWT.
  [Custom claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)

> **No verificable / marcado:** no encontré documentación de un patrón Supabase para
> "empleado que NO es `auth.user`". Ausencia de evidencia, no evidencia de imposibilidad
> — pero refuerza que esa variante habría que diseñarla nosotros, con el riesgo cayendo
> sobre RLS. Es la razón técnica para elegir el email sintético.

**Lectura del benchmark:** el estándar de la industria es **email para el dueño y
credencial corta para el mostrador**, que es exactamente el modelo split. Square es
además el que confirma el costo de la alternativa barata: passcode compartido = se pierde
la atribución por persona.

---

## F. Recomendación por fases

### F1 — ANTES del primer cliente (must-have)

**Bloque 1 · Bugs de lanzamiento** (chicos, sin decisión de por medio)
1. `getSession` debe cortar con `stores.status='suspended'` — hoy un negocio suspendido
   entra igual, y es el único apalancamiento de cobranza.
2. Mensaje distinto para "ya no tenés acceso" vs "clave incorrecta".
3. Contraseñas con `crypto.randomInt`, no `Math.random()`, y lista de 64 palabras.
4. `ORDER BY` determinístico en la selección de member.
5. `try/catch` real alrededor de `create_store` + chequear el resultado del rollback.

**Bloque 2 · El modelo split** (lo que desbloquea el paso 7 del onboarding)
6. Login de 3 campos + email sintético + alta de empleado **sin email**.
7. **Reset de clave de empleado por el dueño**, con cierre de sesiones.
8. Rate limit **por cuenta** además de por IP + lockout.

**Bloque 3 · Recuperación y trazabilidad**
9. Link de invitación en el alta + `must_change_password` en `app_metadata`.
10. `/recuperar` + `/cuenta` para el dueño (copiar de StudioFlow).
11. `platform_audit` + panel del cliente.
12. `created_by` en `stores` y `members`; rate limiting en `/super` y `/admin/equipo`.

### F2 — Después
PIN de desbloqueo local · 2FA · selector multi-negocio · roles más finos · impersonación
auditada · rotación programada de claves.

### Método
Contratos congelados en `docs/rpc-contracts.md` **antes** del SQL. Migraciones
**aditivas**. **Próximo número libre en main: `049`** (048 es la última).

### Irreversible — hay que decidirlo antes del deploy
1. **El dominio del email sintético** (queda en cada `auth.users.email`).
2. **Alcance de unicidad del usuario** (por negocio vs. global).
3. **Staff = identidad por puesto, no por persona** (un humano en dos kioscos = dos
   identidades).
4. **"El dueño tiene email real y verificado"** — retrofitearlo después es una campaña de
   soporte, no una migración.
5. **Prohibir el hard delete de usuarios de auth** (borra la atribución de ventas en
   silencio).

Barato de cambiar después: la forma exacta de la credencial · los umbrales de rate limit ·
`must_change_password` en `app_metadata` vs. columna.

---

## G. Preguntas para el owner

1. **¿Se acepta un dueño sin email real?** Recomiendo **no**, y ofrecer en cambio "te
   ayudamos a crearlo en 2 minutos" como paso del onboarding. Sin email no hay
   auto-recuperación **ni** reporte mensual (`src/lib/asistente/mailer.ts:22` recibe el
   email del dueño), y cada olvido de clave es una llamada.
2. **¿Cuál es el dominio del email sintético?** Es irreversible y **depende de la compra
   del dominio, que ya bloquea el launch de la web**.
3. **¿Login fail-closed?** Si el limitador se cae, ¿el login falla cerrado 30 s?
   Contradice el default fail-open de `syntra-scale-security-baseline` — por eso te lo
   pregunto en vez de decidirlo.
4. **¿El cliente ve la auditoría de SYNTRA?** Es lo que convierte el break-glass en
   soporte, pero expone tus intervenciones.
5. **¿SMTP de Supabase Auth apuntando a Resend?** Sin eso no hay `/recuperar`.
6. **¿La forma de la credencial del empleado**: `palabra-NNNN` (recomendada) o 6 dígitos?
