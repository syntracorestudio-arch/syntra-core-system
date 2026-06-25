# StudioFlow — App de reservas y cobranza para estudios boutique

> **Nombre interno técnico:** `pilates-studio-app`
> **Nombre comercial provisional:** **StudioFlow**
> **Estado:** **Fase 0 — Documentación fundacional** (sin código de aplicación todavía)
> **Proveedor:** SYNTRA CORE (plataforma, soporte y mantenimiento)

---

## Qué es StudioFlow

StudioFlow es una **app white-label de reservas y cobranza para estudios boutique**
(pilates primero; extensible a yoga / funcional / fitness boutique). Cada estudio la usa
como **si fuera su propia app** (su nombre, su logo, su color); SYNTRA es el proveedor que
la opera, la mantiene y da soporte.

No es una agencia ni un desarrollo a medida: es **un producto** que SYNTRA vende a varios
estudios desde una sola base de código (SaaS multi-tenant).

## Qué problema resuelve

Los estudios boutique gestionan reservas y pagos con **planillas de Excel y mensajes de
WhatsApp**. Eso genera:

- sobrecupos y confusión sobre quién está anotado;
- alumnos preguntando por WhatsApp si hay lugar;
- el dueño persiguiendo pagos ("¿ya pagaste el pack?");
- falta de visibilidad real de ingresos, deuda y ocupación.

StudioFlow reemplaza eso con: **reservas con cupo automático + control de packs/créditos +
cobranza y deuda claras + un dashboard donde el dueño ve su negocio en tiempo real.**

## Producto white-label

- **Marca visible:** la del **estudio** (logo, color, nombre). El alumno siente que es la
  app de su estudio.
- **SYNTRA:** proveedor + soporte + superadmin de la plataforma. Presencia discreta
  ("powered by SYNTRA", configurable por plan).
- **Multi-tenant:** un solo sistema, muchos estudios, cada uno **aislado** por seguridad.
- **Los fondos son del estudio:** cuando se integre MercadoPago (Fase 3), **cada estudio
  cobra en su propia cuenta**. SYNTRA **no** cobra ni intermedia el dinero de los alumnos.

## Ubicación dentro de SYNTRA

```text
SYNTRA-CORE/
└── projects/
    ├── syntra-core-website/   (la web de SYNTRA — NO se toca desde este proyecto)
    └── pilates-studio-app/    (este proyecto — self-contained)
```

Vive dentro del monorepo SYNTRA como **proyecto autónomo** (tendrá su propio `package.json`,
config y dependencias cuando arranque Fase 1). Se prevé **extraerlo a un repo Git propio en
Fase 5**, cuando tenga clientes pagando y CI/deploy independiente.

## Estado actual: Fase 0

Esta carpeta contiene **solo documentación**. La fuente de verdad del producto vive acá
(no en archivos temporales de planificación):

```text
README.md                              ← este archivo
docs/prd.md                            ← qué se construye y para quién
docs/business-rules.md                 ← reglas de negocio precisas (reservas, créditos, deuda)
docs/database.md                       ← diseño lógico de datos (sin SQL todavía)
docs/roadmap.md                        ← fases 0 → 5
docs/commercial/pitch.md               ← propuesta comercial y objeciones
docs/commercial/demo-script.md         ← guion de demo de 10 min + estudio ficticio
docs/reference-locks/                  ← locks visuales (draft para review del owner)
```

## Qué NO existe todavía

- ❌ Código de aplicación (`src/`, componentes, server actions).
- ❌ `package.json`, dependencias, lockfiles.
- ❌ Base de datos, migraciones, SQL real, Supabase.
- ❌ Integración de pagos (manual ni MercadoPago).
- ❌ Variables de entorno / secretos.
- ❌ Diseño visual final (los reference-locks están en `draft-for-owner-review`).

## Cómo se trabaja por fases

| Fase | Foco | Estado |
| --- | --- | --- |
| **0** | PRD + reglas + DB design + demo comercial | **En curso** |
| 1 | MVP operativo: reservas, cupos, packs/créditos, cobranza manual, deuda, dashboard básico, waitlist | Pendiente |
| 1.1 | Waitlist con promoción automática + branding + PWA + landing pública | Pendiente |
| 2 | Dashboard avanzado + métricas financieras + rol recepción | Pendiente |
| 3 | MercadoPago (cuenta propia por estudio) | Pendiente |
| 4 | Automatizaciones (WhatsApp/email vía n8n) | Pendiente |
| 5 | SaaS multi-estudio completo (superadmin + billing) | Pendiente |

Detalle en [docs/roadmap.md](docs/roadmap.md).

**Reglas de trabajo (gobernanza SYNTRA):** el trabajo visual (Cat B/C) requiere
reference-lock aprobado + visual gate; nada de migraciones/deps/env swithout aprobación del
owner; commits atómicos; nunca push a main.
