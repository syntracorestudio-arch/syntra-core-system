# StockFlow — base de datos

> **Estado: tanda 1B — SQL escrito, NO aplicado todavía.** El SQL está revisado pero
> no se ejecutó nunca contra un Postgres real. Hasta que el owner lo corra y pasen
> las validaciones, no está verificado.

## Orden de aplicación

El owner las corre **manualmente en el SQL Editor** del dashboard de Supabase, en
este orden. Nunca se aplican sin su aprobación explícita.

| # | Archivo | Qué hace |
| --- | --- | --- |
| 1 | `migrations/001_initial_schema.sql` | Tablas, índices, triggers, vistas, `check_rate_limit` |
| 2 | `migrations/002_rls_policies.sql` | Helpers anti-recursión + RLS forzada + policies |
| 3 | `seed.sql` | 2 negocios demo (uno existe solo para probar aislamiento) |

Las migraciones son **aditivas y numeradas**. Una vez aplicada, una migración no se
edita: los cambios van en una nueva. Si una re-define una función, lo dice en su
cabecera.

## Antes de correr nada

1. Crear el proyecto de Supabase de **StockFlow** (propio y separado del de
   StudioFlow — no comparten base ni credenciales).
2. Copiar `.env.example` a `.env.local` y completar URL, anon key y service role.
3. Recién ahí, aplicar `001` → `002` → `seed`.

## Después de aplicar: las validaciones que importan

Están al pie de `seed.sql` con el SQL listo para copiar.

> **Ojo con el SQL Editor: corre como `postgres`, que bypassa RLS.** Las pruebas de
> aislamiento y de append-only **no prueban nada** si las corrés tal cual — hay que
> suplantar a un usuario autenticado dentro de una transacción:
>
> ```sql
> begin;
> set local role authenticated;
> set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
> -- … las consultas …
> rollback;
> ```

1. **Cache de stock** — `products.stock` debe reflejar la suma del ledger (24/30/48/3/9).
   Lo mantiene un trigger; si no coincide, el trigger no está corriendo.
2. **Saldos derivados** — `client_balances`: Marta −12.400, Ruben −5.000.
3. **Stock bajo** — `low_stock_products` debe devolver **solo** Marlboro.
4. **Aislamiento cross-tenant** *(el que de verdad importa, suplantando usuario)* —
   `select count(*) from products` debe dar **5, nunca 6**. Si aparece el "Producto
   de Doña Rosa", la RLS está rota y **no se sigue con la tanda 1C**.
5. **Las vistas no filtran solas** — `client_balances` y `low_stock_products`
   consultadas como usuario suplantado deben devolver solo las filas del Trébol. Es
   la prueba de que quedó el `security_invoker`; sin él exponen todos los negocios.
6. **Append-only** — `update`/`delete` sobre `stock_ledger` o `client_ledger` deben
   **fallar**.
7. **Cache protegido** — `update products set stock = 999` debe **fallar**, pero
   `update products set price = …` debe funcionar.

## Decisiones de diseño que conviene no revertir sin leer los docs

- **Las tablas transaccionales no tienen policies de escritura.** `sales`,
  `sale_items`, `stock_ledger` y `client_ledger` son solo-lectura para
  `authenticated`: toda escritura pasa por las RPCs `SECURITY DEFINER` de la tanda
  1C. Es lo que impide que alguien inserte un asiento suelto y descuadre el stock.
- **`products.stock` es un cache, no la verdad.** La verdad es `stock_ledger`. Nunca
  escribirlo a mano.
- **`allow_negative_stock` viene en `true`.** La caja no se frena por un número del
  sistema; el dueño recibe un aviso para ajustar (`docs/business-rules.md` §1).
- **`check_rate_limit` es fail-open.** Si falla, deja pasar: un rate limiter caído no
  puede tirar abajo la caja de un kiosco.

Detalle completo del modelo: [`../docs/database.md`](../docs/database.md) ·
contratos de las RPCs: [`../docs/rpc-contracts.md`](../docs/rpc-contracts.md).
