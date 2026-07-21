# StockFlow — stock y ventas para negocios chicos

> **Estado: tanda 1A** (scaffold + tokens + shells). SaaS white-label multi-tenant de
> SYNTRA para kioscos y almacenes: POS con escáner, stock como ledger, fiado,
> vencimientos y avisos push al teléfono del dueño. Hermano de StudioFlow
> (`projects/pilates-studio-app`), del que clona stack y patrones probados.

## Correr el proyecto

```bash
npm install
cp .env.example .env.local   # completar con el proyecto Supabase de StockFlow
npm run dev
```

Sin `.env.local` la app **igual levanta en desarrollo** (para revisar la UI) y el
`proxy` deja pasar; en producción la falta de credenciales revienta al arrancar, que
es lo correcto. Las pantallas del dueño (`/admin`) y de caja (`/pos`) usan un fixture
local hasta la tanda 1H/1D.

## Qué es

El kiosquero maneja el stock de cabeza o en cuaderno: no sabe qué se vende, qué
falta, qué vence ni cuánto margen deja. StockFlow es la versión "StudioFlow" de ese
problema: **el dueño ve su negocio en una pantalla y el sistema trabaja solo** —
vende con escáner, descuenta stock, lleva el fiado y avisa por push antes de que se
pierda plata.

Vertical inicial: **kiosco/almacén**. El modelo nace preparado para dietética y pet
shop (atributos por producto, unidad de venta) sin migración dolorosa.

## Documentación (fuente de verdad)

| Doc | Contenido |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Producto, usuarios, alcance MVP, decisiones fundacionales |
| [docs/business-rules.md](docs/business-rules.md) | Reglas de negocio (stock, margen, fiado, vencimientos, permisos) |
| [docs/database.md](docs/database.md) | Diseño lógico del modelo de datos + RLS (sin SQL) |
| [docs/rpc-contracts.md](docs/rpc-contracts.md) | Contratos completos de las RPCs atómicas — se congelan ANTES de escribir SQL |
| [docs/roadmap.md](docs/roadmap.md) | Fases y tandas (1 PR por tanda, migraciones numeradas) |
| [docs/commercial/pitch.md](docs/commercial/pitch.md) | Posicionamiento, competencia, pricing |
| [docs/commercial/demo-script.md](docs/commercial/demo-script.md) | Guion de demo comercial + seed necesario |

## Stack y convenciones

- **Idéntico a StudioFlow**: Next (App Router) + React 19 + TypeScript estricto +
  Tailwind v4 (tokens solo en `globals.css`) + shadcn + Supabase (`@supabase/ssr`) +
  Zod. Proyecto **autónomo** dentro del monorepo (package.json propio, sin
  workspaces); Supabase project **propio y separado**.
- **Multi-tenant light**: un Postgres, aislamiento por `store_id` + RLS forzada.
- **Ledgers append-only** para stock y fiado (nunca contadores mutables como verdad).
- **Escrituras de negocio solo por RPC atómica** (SECURITY DEFINER); las tablas
  transaccionales no tienen policies de escritura.
- **`syntra-scale-security-baseline` es normativa desde el primer código**: cotas de
  fecha, índices en la misma migración, rate limiting, headers, load test antes del
  primer cliente. La implementación canónica de cada punto vive en StudioFlow.
- UI **dark premium** white-label (referencias visuales del owner, REFERENCE-FIRST);
  emojis + color por producto/categoría.

## Gobernanza

- Migraciones `supabase/migrations/NNN_*.sql` numeradas y aditivas; **las aplica el
  owner en el SQL Editor** — nunca se corren sin su aprobación.
- Trabajo visual: variantes vivas + OK del owner en su navegador antes de commit.
- Commits atómicos, nunca push a main; PRs con merge manual del owner.
