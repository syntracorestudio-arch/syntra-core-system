# StudioFlow — PRD (Product Requirements Document)

> **Estado:** Fase 0 · Fuente de verdad del producto. Reemplaza al archivo temporal de
> planificación. Cambios de scope se documentan acá.

---

## 1. Resumen del producto

StudioFlow es una app **white-label de reservas y cobranza para estudios boutique de
pilates** (extensible a yoga / funcional). Permite que los alumnos reserven clases con cupo
automático y que el dueño controle clases, packs, pagos, deuda e ingresos desde un panel
claro. Se vende como **SaaS multi-tenant**: SYNTRA provee y mantiene la plataforma; cada
estudio la usa con su propia marca.

**Decisiones fundacionales (owner, 2026-06-25):**
- Nombre interno: `pilates-studio-app` · comercial provisional: **StudioFlow**.
- White-label para estudios boutique; marca visible = del estudio; SYNTRA = proveedor/
  soporte/superadmin.
- Multi-tenant **light** (un Postgres, aislamiento por `studio_id` + RLS).
- Alta de alumno **por invitación/código del estudio**.
- Cobranza **manual** en MVP; **MercadoPago en Fase 3, cuenta propia por estudio** (SYNTRA
  no intermedia fondos).
- Landing pública y PWA en **Fase 1.1**.

### Decisiones cerradas (Fase 0B, 2026-06-25)
- **Recurrencias:** MVP materializa **8 semanas** por adelantado; extensible a **12** sin
  cambiar arquitectura; **rolling window** como lógica futura.
- **Multi-estudio del alumno:** la BD soporta N:N; la **UX del MVP asume 1 estudio
  principal** por alumno.
- **Instructores:** en MVP es **campo informativo/opcional** de la clase; login de
  instructor en Fase 1.1/2.
- **Recepción:** **no entra en MVP**; rol preparado para Fase 2.
- **Notificaciones:** MVP **solo confirmación in-app**; email/WhatsApp/n8n en Fase 4.
- **Facturación / invoices:** fuera del MVP; `payments` alcanza para control interno;
  `invoices` solo si un estudio lo exige.
- **Precios de packs/membresías:** **cada estudio los define libremente** (precio, nombre,
  duración, créditos).
- **MercadoPago:** Fase 3; **cada estudio cobra en su propia cuenta**; SYNTRA no intermedia
  fondos.

## 2. Usuarios

| Usuario | Descripción | En MVP |
| --- | --- | --- |
| **Alumno (client)** | Cliente del estudio que reserva clases (UX MVP: 1 estudio principal) | Sí |
| **Dueño / Admin** | Gestiona clases, alumnos, cupos, pagos, deuda, métricas | Sí |
| **Recepción** | Operación diaria sin acceso a config sensible | No en MVP; rol preparado, activo Fase 2 |
| **Instructor** | En MVP: solo dato informativo de la clase. Login/asistentes/check-in después | Campo en MVP; login Fase 1.1/2 |
| **Superadmin (SYNTRA)** | Alta/baja de estudios, soporte, billing | Fase 5 |

## 3. Propuesta de valor

- **Para el alumno:** reservar y cancelar desde el celular, ver su saldo de clases y sus
  próximas reservas, sin depender de WhatsApp.
- **Para el dueño:** cero sobrecupos, control de quién pagó / quién debe, e ingresos del
  mes en tiempo real, con la marca de su estudio.
- **Para SYNTRA:** producto vendible y escalable a muchos estudios, con ingresos
  recurrentes (suscripción + setup + add-ons), sin custodiar fondos de terceros.

## 4. Alcance MVP (confirmado)

**Cliente:** registro/login · alta por invitación/código · calendario semanal · cupo en
vivo · reservar (consume crédito o cubierto por membresía) · cancelar (ventana
configurable, default 24 h) con devolución de crédito si está en ventana · lista de espera
básica (anotarse + orden) · próximas reservas · historial básico · ver saldo/membresía/
estado de deuda · confirmación in-app.

**Admin:** dashboard básico (operativo + financiero) · crear clase **única** y
**recurrente** · editar/cancelar clase · cupo máximo · ver/gestionar alumnos anotados ·
administrar alumnos · **registrar pago manual** (concepto: suelta/pack/membresía/abono) ·
**asignar pack o membresía** con vencimiento · ver saldo por alumno · alumnos al día · con
deuda · membresías vencidas · ingresos mensuales y totales · packs y clases sueltas
vendidas · ocupación por clase · ver lista de espera (promoción manual).

## 5. Fuera de alcance MVP

- MercadoPago / pago online (Fase 3).
- Promoción automática de lista de espera (Fase 1.1).
- Landing pública y PWA instalable (Fase 1.1).
- Branding completo por estudio (MVP: nombre + color básicos).
- Recordatorios automáticos WhatsApp/email (Fase 4).
- Panel superadmin SYNTRA y billing del SaaS (Fase 5).
- Reportes avanzados, check-in/QR, penalizaciones automáticas (Fase 2+).
- Facturación legal / comprobantes fiscales (a evaluar; no en MVP).

## 6. Roles y permisos (resumen)

- **client:** ve y gestiona **solo lo suyo** dentro de **su** estudio.
- **admin:** CRUD completo dentro de **su** estudio (clases, alumnos, pagos, config).
- **reception** (post-MVP): operación sin config sensible ni métricas financieras globales.
- **instructor** (post-MVP): ve sus clases y asistentes, marca asistencia.
- **superadmin** (Fase 5): gestión de la plataforma.

El rol vive por estudio: una persona puede ser admin en un estudio y nada en otro. Detalle
de aislamiento y RLS en [database.md](database.md).

## 7. Flujos principales

### Reserva (alumno)
```text
Login (invitación/código) → Calendario semanal → toca clase → ve cupo + su saldo
  → "Reservar" → validación server: cupo + ventana + (crédito|membresía) + no-duplicado
  → consume 1 crédito → confirmación → "Mis clases"
Sin cupo  → "Unirme a lista de espera" (orden respetado)
Sin saldo → aviso + CTA (en MVP: pagar en el estudio; el admin registra el pago)
```

### Cancelación (alumno)
```text
Mis clases → clase → "Cancelar"
  → server valida ventana (default 24 h, configurable)
  → dentro de ventana: devuelve crédito + libera cupo
  → tarde / no-show: no devuelve crédito (configurable por estudio) + libera cupo
```

### Operación + cobranza (admin)
```text
Dashboard → "Nueva clase" (única/recurrente) → cupo/instructor → genera ocurrencias
Detalle de clase → anotados + lista de espera → promover manual / quitar / cerrar cupo
Alumno paga en mostrador → "Registrar pago" (concepto + monto) → asigna pack/membresía
  → saldo del alumno + ingresos del mes se actualizan
Métricas → ingresos mes/total · al día/deuda · membresías vencidas · packs/sueltas vendidas
```

Reglas completas en [business-rules.md](business-rules.md).

## 8. Pantallas necesarias (MVP)

**Cliente (mobile-first):** Login/Registro · Calendario semanal (home) · Detalle de clase
(reservar / waitlist) · Mis reservas · Historial · Mi saldo / membresía / estado financiero
· Perfil.

**Admin (mobile-first + desktop rico):** Dashboard (operativo + financiero) · Clases (lista
+ crear única/recurrente) · Detalle de clase (anotados + waitlist) · Alumnos (listado +
estado financiero) · Ficha de alumno (saldo, packs, pagos, deuda) · Pagos (registrar manual
+ historial) · Métricas/ingresos · Configuración del estudio (cupos default, ventana de
cancelación, política de reserva, refund, branding básico, zona horaria).

**Fase 1.1+:** Landing pública `/[slug]` · onboarding de branding. **Fase 5:** Superadmin.

Las pantallas críticas de percepción premium tienen reference-lock:
[dashboard-financiero](reference-locks/dashboard-financiero.md),
[calendario-alumno](reference-locks/calendario-alumno.md),
[ficha-alumno](reference-locks/ficha-alumno.md).

## 9. Criterios de éxito (MVP)

- Un estudio real puede operar una semana completa de clases sin planilla paralela.
- **Cero sobrecupos** comprobados bajo reservas concurrentes.
- **Cero fugas entre estudios** (tests de aislamiento RLS en verde).
- El saldo de créditos de cada alumno siempre cuadra con su historial (ledger consistente).
- El dueño ve ingresos del mes, alumnos con deuda y membresías vencidas sin cálculo manual.
- Alta de alumno por invitación funcionando con fricción mínima.
- Build/tsc/lint verdes; responsive 360→1920; sin errores de consola; Lighthouse +90 mobile.
