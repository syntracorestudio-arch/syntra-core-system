# SOP — Onboarding de un estudio nuevo (cliente real)

> **Estado:** 2026-07-17 · Procedimiento operativo de SYNTRA para dar de alta un
> estudio pagador de punta a punta. Tiempo estimado: **60-90 min** de trabajo SYNTRA
> + 1 h de capacitación con el dueño.
> Prerrequisito una única vez: infraestructura de producción montada según
> `docs/deploy.md` (Supabase prod + Vercel prod + dominio + VAPID + webhook push).
> **Nunca** dar de alta clientes reales en `syntraflow-dev` (es la demo).

---

## 0. Información a pedirle al cliente (antes de tocar nada)

- [ ] Nombre del estudio como quiere que lo vean los alumnos.
- [ ] Logo (PNG/SVG fondo transparente, ideal ≥ 360 px de ancho) — opcional.
- [ ] Color de marca (hex o referencia "como mi Instagram").
- [ ] Nombre completo + email del dueño (será su login de admin).
- [ ] Grilla de clases: tipos (Reformer/Mat/…), días, horarios, cupos, duración,
      instructores (nombre + email si van a usar la app).
- [ ] Packs y precios: cuántas clases, vigencia en días, precio; membresías/abonos.
- [ ] Políticas: ventana de cancelación (default 24 h), ¿devuelve crédito si cancelan
      tarde? (default no), modo de lista de espera (default: automática hasta el
      inicio), ¿los instructores ven su pago estimado? (default no).
- [ ] ¿Cobra online? → necesita cuenta de MercadoPago propia (puede activarse después).
- [ ] ¿Recepcionista? (nombre + email) — si no hay, todo corre automático igual.

## 1. Alta del estudio (superadmin, 10 min)

1. Entrar a `/super` con la cuenta superadmin de SYNTRA.
2. **Nuevo estudio**: nombre, slug (se deriva solo), zona horaria, color de acento,
   y el **dueño** (nombre + email + clave temporal de 8+).
   → Esto crea estudio + settings con defaults + usuario admin listo.
3. Verificar que el estudio aparece activo en la lista de `/super`.

## 2. Configuración con el dueño o por él (15 min)

Login como el dueño (o guiarlo por pantalla compartida) → **Ajustes**:

- [ ] Subir **logo** y confirmar el **color** (la vista previa muestra panel y menú;
      el cambio aplica a toda la app en vivo).
- [ ] Políticas: ventana de cancelación · refund tardío · **modo de lista de espera**
      (para estudios sin recepción dejar "automática hasta el inicio") · pago
      sugerido visible para instructores sí/no.
- [ ] **Equipo**: alta de instructores y recepcionista (nombre + email + clave
      temporal). Avisarles que en Mi cuenta pueden cambiar la clave y cargar su
      cumpleaños.
- [ ] **Planes** (packs/membresías/sueltas) con precios reales.
- [ ] **Clases**: crear las recurrentes (día/hora/cupo/instructor). Verificar en el
      calendario que las ocurrencias se materializaron.

## 3. Cobro online — MercadoPago (10 min, opcional)

1. Ajustes → **Cobro online** → "Conectar MercadoPago" con la cuenta DEL ESTUDIO
   (OAuth; el dueño pone sus credenciales, SYNTRA nunca las ve).
2. Verificar estado "Conectado".
3. Prueba real: comprar el pack más barato con una cuenta de alumno de prueba y
   verificar que el pago aparece en el panel y los créditos se acreditan solos
   (webhook). Reembolsar desde MercadoPago si hace falta.
4. Recordar: **el dinero va a la cuenta del estudio**; SYNTRA no interviene.

## 4. Alumnos (15 min)

1. Ajustes → **Códigos de invitación**: generar el código del estudio.
2. Pasarle al dueño el **mensaje listo para WhatsApp/Instagram**:
   > "¡Ya tenemos app! 🎉 Entrá a `<URL>/join`, poné el código `XXXX-XXXX` y creá tu
   > cuenta. Desde ahí reservás tus clases, ves tu saldo y te avisamos si se libera
   > un lugar."
3. Los alumnos con pack vigente: registrarles el pago/pack desde **Alumnos → ficha →
   Registrar pago** (o dejará que lo haga el estudio la primera semana).
4. Sugerir al dueño cargar 3-5 alumnos de confianza primero (piloto de una semana).

## 5. Push + PWA en los teléfonos (10 min, el detalle que fideliza)

- Guiar al dueño (y por él a los alumnos) a **instalar la app**: abrir la URL en el
  celu → "Agregar a pantalla de inicio" / "Instalar app".
- Tocar **"Activá los avisos"** cuando la tarjeta aparezca.
- **Lección Samsung/Xiaomi (issue conocido de Android):** si las burbujas llegan
  pero SIN sonido/vibración → Ajustes → Notificaciones → Ajustes avanzados →
  "Administrar categorías por app" → app del estudio → categoría en **"Alertar"**.
  Si la categoría no aparece: desinstalar la PWA, borrar datos del sitio en Chrome,
  reinstalar y aceptar avisos de nuevo (el canal se re-crea sonando).
- Probar en vivo con el dueño: mandarse una notificación (p.ej. registrar un pago
  suyo) y verificar la burbuja.

## 6. Capacitación (1 h, por rol)

- **Dueño (30')**: dashboard e interpretación de rentabilidad; registrar pagos;
  egresos + tarifas del equipo; reportes; suspender/editar clases; códigos.
- **Recepción (15')**: pantalla Hoy — check-in, cobro rápido, cola de espera, subir
  manual, cumpleaños del día.
- **Instructores (15')**: agenda, marcar asistencia (y "marcar todos"), notas
  privadas, aviso de imprevisto, Mi mes.
- Dejarles el contacto de soporte SYNTRA.

## 7. Checklist de salida (antes de dar por entregado)

- [ ] Login de los 3-4 roles funciona y cada uno cae en SU pantalla.
- [ ] Una reserva de prueba de punta a punta (reservar → cancelar → crédito vuelve).
- [ ] Waitlist: clase llena de prueba → cancelación → promoción automática + burbuja.
- [ ] Pago manual registrado → saldo del alumno e ingresos actualizados.
- [ ] (Si Pro) pago online de prueba acreditado solo.
- [ ] Push probado en el teléfono del dueño (con sonido).
- [ ] Branding: logo + color en la app del alumno.
- [ ] Cumpleaños: cargado el del dueño (sorpresa el día que le toque 🎂).
- [ ] Datos de la demo NO mezclados (cliente en prod, demo en dev).

## 8. Post-onboarding (primera semana)

- Día 2: llamada de 10 min — ¿los alumnos entraron con el código? ¿dudas?
- Día 7: revisar juntos el dashboard (primeros ingresos cargados, ocupación).
- Registrar en el CRM/notas de SYNTRA: fecha de alta, plan, feedback, pedidos.
- Si pidió automatizaciones de mensajería (WhatsApp/email): cotizar como servicio
  aparte (decisión owner 2026-07-16 — no es parte del producto base).
