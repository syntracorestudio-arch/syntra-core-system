# StudioFlow — Concept Boards (textuales)

> Propuesta visual por pantalla para que el owner **apruebe la dirección** de los 3
> reference-locks. **Textual, sin imágenes ni assets.** Acompaña y profundiza las secciones
> `## Visual Reference Direction` de cada lock; hereda la **baseline compartida** del
> [README](README.md) (Soft UI Evolution · lienzo neutro cálido + acento del estudio +
> semánticos · Plus Jakarta Sans · Lucide · motion 150–300ms).
>
> **Estado:** los 3 locks siguen en `candidate-for-owner-review`. Este documento es el
> material a revisar **antes** de pasarlos a `approved`. No se diseña el visual final acá.

---

## Baseline visual (resumen, manda el README)

| Eje | Decisión |
| --- | --- |
| **Estilo** | Soft UI Evolution: superficies claras, sombras suaves, profundidad ligera, bordes sutiles. Tarjetas antes que tablas. |
| **Color** | **White-label**: la app no fija color de marca. Lienzo **neutro cálido** (off-white/arena), texto gris cálido oscuro, **acento configurable por estudio** (default cálido: terracota/salvia), **semánticos** consistentes (verde=al día/cupo · ámbar=por vencer/pocos · rojo suave=deuda/lleno · neutro=inactivo). Color **+** texto/ícono siempre. |
| **Tipografía** | Plus Jakarta Sans (títulos/UI) + Nunito Sans o misma familia (cuerpo). Body ≥16px mobile. |
| **Íconos** | Lucide, trazo medio, tamaño consistente. Nunca emojis. |
| **Motion** | 150–300ms, color/opacity/transform, reduced-motion safe, sin layout shift. Skeletons en carga. |
| **Tono** | Premium, cálido, simple, wellness boutique. Claro para dueños no técnicos. |

**Estilo de cards (transversal):** fondo claro sobre el lienzo, **radio generoso** (≈12–16px),
**sombra suave** (no borde duro ni glass), padding amplio, un dato/acción dominante por card,
jerarquía por tamaño y peso (no por saturación de color). El acento del estudio aparece en
CTAs y énfasis puntuales, nunca inundando.

---

## 1. Dashboard financiero (admin)

**Intención visual:** que el dueño abra la app y en 5 segundos sienta *"así va mi negocio"*,
con calma y control. Tablero de negocio tranquilo, no centro de control financiero.

**Layout recomendado**
- *Mobile (scroll vertical):*
  1. **Card-héroe "Ingresos del mes"** (número grande + total del año como dato menor).
  2. Fila de 2 cards: **Al día** / **Con deuda** (con badge semántico).
  3. **Acciones rápidas** (Registrar pago · Nueva clase).
  4. **Ocupación de la semana** (mini-barras, no gráfico pesado).
  5. **Por vencer** (membresías/packs próximos).
  6. **Clases de hoy** (lista compacta).
- *Desktop:* grilla 12-col → fila superior 3–4 KPIs (ingresos destacado), banda de alertas
  (deuda / por vencer), bloque "hoy + ocupación" a 2 columnas. Listas más largas y
  tendencia del mes a la derecha.

**Estructura de información (jerarquía):** Ingresos del mes → deuda/al día → ocupación →
packs/membresías vendidas → por vencer → clases de hoy. Acciones rápidas siempre accesibles.

**Componentes principales:** KPI card (valor + label + delta opcional) · stat con badge de
estado · mini-barra de ocupación semanal · lista "alumnos con deuda" (inicial/avatar +
nombre + monto + CTA "ver ficha") · lista "clases de hoy" (hora + nombre + anotados/cupo) ·
botones de acción rápida.

**Estilo de cards:** las KPI cards son el héroe — número grande en Plus Jakarta Sans, label
en gris cálido; "Ingresos del mes" puede usar un realce sutil con el acento del estudio (no
relleno completo). Alertas (deuda/por vencer) con el semántico correspondiente en el borde o
el badge, no en todo el fondo.

**Tono de color:** lienzo neutro cálido dominante; semánticos solo en estados; acento del
estudio en "Ingresos del mes" y CTAs. Nada de fondos oscuros ni degradados tipo fintech.

**Tipografía sugerida:** Plus Jakarta Sans para los números/KPIs (peso 600–700), cuerpo y
labels en la misma familia (400–500).

**Comportamiento mobile:** Ingresos del mes + deuda sin scroll; cards tocables (≥44px); una
columna; acciones rápidas accesibles arriba o como barra fija inferior.

**Comportamiento desktop:** vista de análisis (grilla), más contexto, filtro de período
(mes actual por defecto).

**Estados clave:**
- *Vacío (estudio nuevo):* onboarding cálido ("Cargá tus clases y registrá un pago para ver
  tu negocio acá") + CTA — nunca KPIs en cero fríos.
- *Sin deuda:* mensaje positivo ("Todos al día").
- *Carga:* skeletons de cards. *Error de métricas:* mensaje + reintentar (nunca números a
  medias).

**Qué debería sentir el usuario:** claridad y tranquilidad. "Entiendo mi mes sin pensar."

**Errores visuales a evitar:** panel de trading/fintech; saturación de widgets y gráficos;
gris azulado frío; tablas densas; depender solo del color para el estado; KPIs en cero feos.

**Criterios para aprobar el lock:**
- [ ] Ingresos del mes es el dato dominante, sin scroll (mobile incluido).
- [ ] Estado (al día/deuda/por vencer) se lee por color **+** texto/ícono.
- [ ] Se siente cálido y tranquilo (no fintech/cripto/denso).
- [ ] Acento = color del estudio; base neutra cálida; semánticos consistentes.
- [ ] Estados vacío/carga/error resueltos.
- [ ] Acciones rápidas siempre accesibles.

---

## 2. Calendario del alumno (mobile-first)

**Intención visual:** que reservar la próxima clase sea liviano y agradable, como una agenda
boutique, no un calendario corporativo. Es la pantalla más usada y la cara del producto.

**Layout recomendado**
- *Mobile (prioridad):*
  1. **Header compacto** con saldo/membresía ("Te quedan 5 clases" / "Abono activo").
  2. **Selector de día** (tabs o scroll horizontal; hoy por defecto).
  3. **Lista vertical de tarjetas de clase** del día seleccionado.
- *Desktop:* misma lógica en ancho mayor; opcional vista semana (7 columnas) manteniendo la
  legibilidad del cupo.

**Estructura de información (jerarquía):** hora + nombre de clase → estado de cupo →
instructor (secundario) → CTA (Reservar / Lista de espera). Saldo en el header.

**Componentes principales:** chip/tab de día · **tarjeta de clase** (hora destacada · nombre ·
instructor · badge de cupo · CTA) · **badge de cupo** (verde "con lugar" / ámbar "pocos" /
neutro "lleno") · botón Reservar · botón "Unirme a lista de espera" · indicador de saldo ·
hoja/modal de confirmación ligera ("Usa 1 clase").

**Estilo de cards:** tarjeta de clase espaciosa, hora a la izquierda en peso fuerte, nombre
claro, instructor en gris suave, badge de cupo a la derecha; CTA full-width o destacado en
mobile. Estado "lleno" atenúa la card y cambia el CTA a "Lista de espera".

**Tono de color:** lienzo neutro cálido; el **cupo** usa semánticos; el **acento del estudio**
solo en el CTA primario (Reservar). Sensación cálida, no "fitness tech".

**Tipografía sugerida:** Plus Jakarta Sans; hora y nombre en 600, metadatos en 400–500.

**Comportamiento mobile:** reservar en ≤2 toques; cupo legible sin texto fino; targets
≥44px; nada de scroll horizontal de tablas; saldo siempre visible.

**Comportamiento desktop:** vista semanal opcional; tarjetas con el mismo lenguaje; sin
perder la claridad del cupo.

**Estados clave:**
- *Día sin clases:* mensaje cálido + ir a otro día.
- *Estudio sin clases publicadas:* "Tu estudio todavía no publicó clases".
- *Sin saldo/deuda al reservar:* bloqueo explicado + siguiente paso (no permitir reservar en
  silencio).
- *Clase llena al confirmar (carrera):* "Se llenó recién" + ofrecer waitlist.
- *Carga:* skeletons de tarjetas.

**Qué debería sentir el usuario:** ligereza y confianza. "Reservo y listo; el cupo que veo es
real."

**Errores visuales a evitar:** grilla de calendario densa tipo Outlook; tabla de horarios
apretada; estética gym/gamer; neón IA; glass excesivo; cupo ambiguo; tarjeta sobrecargada.

**Criterios para aprobar el lock:**
- [ ] Reservar una clase con lugar = ≤2 toques desde la agenda.
- [ ] Cupo (con lugar/pocos/lleno) se entiende por color **+** texto.
- [ ] Camino a lista de espera obvio cuando está llena.
- [ ] Saldo/membresía visible sin salir del flujo.
- [ ] Motivo de bloqueo (deuda/sin saldo) + siguiente paso claros.
- [ ] Se siente liviano y boutique en mobile (360–390 px).

---

## 3. Ficha de alumno (admin — CRM liviano)

**Intención visual:** que el admin vea *"cómo está esta persona"* y pueda **cobrar/asignar
pack al instante**, con sensación de CRM liviano y humano, no de planilla/ERP.

**Layout recomendado**
- *Mobile (uso en mostrador):*
  1. **Header**: nombre + **badge de estado financiero**.
  2. **Bloque saldo + membresía** (cards diferenciadas, con vencimiento).
  3. **Acciones rápidas**: Registrar pago · Asignar pack.
  4. **Secciones colapsables**: Pagos · Packs/Membresías · Reservas · Notas.
- *Desktop:* 2 columnas — izquierda resumen (identidad, estado, saldo, acciones), derecha
  secciones con historial extenso y filtros.

**Estructura de información (jerarquía):** estado financiero → saldo de créditos / membresía
(con vencimiento) → acción (registrar pago / asignar pack) → pagos recientes → reservas
(próximas + no-shows) → notas administrativas → contacto.

**Componentes principales:** badge de estado (verde al día / ámbar por vencer / rojo suave
deuda) · **card de saldo de créditos** y **card de membresía** (diferenciadas) · modal
"Registrar pago" (concepto + monto + método, con resumen y confirmación) · modal "Asignar
pack/membresía" · listas livianas de pagos y reservas · bloque de notas.

**Estilo de cards:** dos cards claramente distintas para **crédito (pack)** vs **membresía**
(no confundirlas — reglas distintas): la de créditos muestra "N de M clases" + vencimiento;
la de membresía muestra estado + validez. La acción "Registrar pago" siempre visible
(botón con acento del estudio). Historial en listas compactas, no tablas densas.

**Tono de color:** neutro cálido; el badge de estado usa semántico; acento del estudio en la
acción primaria. La **deuda se muestra informativa**, no punitiva (rojo suave, orientado a
"cobrar/avisar").

**Tipografía sugerida:** Plus Jakarta Sans; nombre y montos en 600, metadatos en 400–500.

**Comportamiento mobile:** estado + saldo + "Registrar pago" sin scroll; modales simples con
resumen antes de confirmar; tras registrar, saldo/estado se actualizan a la vista.

**Comportamiento desktop:** vista de gestión completa (2 columnas), historial extenso,
búsqueda/filtros de pagos y reservas.

**Estados clave:**
- *Alumno nuevo (sin pagos/packs):* CTA primario "Registrar primer pago / asignar pack" — sin
  tablas vacías.
- *Sin reservas:* "Aún no reservó clases". *Sin membresía:* "Sin pack activo" + CTA.
- *Error al registrar pago:* transacción todo-o-nada (no aplicar a medias) + reintentar.
- *Carga:* skeletons.

**Qué debería sentir el usuario:** "Veo cómo está el alumno y le cobro en 10 segundos."
Resolutivo, humano, ordenado.

**Errores visuales a evitar:** CRM/ERP corporativo denso; tablas extensas; panel fintech
frío; confundir crédito con membresía; acción de cobrar perdida entre datos; deuda punitiva;
glass excesivo; neón IA.

**Criterios para aprobar el lock:**
- [ ] El estado financiero se entiende al abrir la ficha (color **+** texto).
- [ ] Saldo de créditos y membresía (con vencimiento) claros y **diferenciados**.
- [ ] Registrar pago / asignar pack sin salir de la ficha, con confirmación.
- [ ] Tras registrar, saldo/estado se actualizan visiblemente.
- [ ] Historial de pagos y reservas legible; estados de reserva claros.
- [ ] Se siente CRM liviano y humano, no ERP/tabla pesada.

---

## Cómo aprobar (owner)

1. Revisar los 3 boards y las secciones `## Visual Reference Direction` de cada lock.
2. Ajustar lo que no convenza (acento por defecto, prioridades de KPIs, etc.).
3. Cuando estés conforme, indicarlo y se adjunta **una referencia visual** por pantalla en
   `assets/` (moodboard/wire/screenshot) y se pasa cada lock a `status: approved`.
4. Recién con los locks `approved` y dependencias autorizadas, arranca Fase 1 (implementación).

> **Pendiente explícito:** este documento es textual; **no** reemplaza una referencia visual
> concreta. La generación de imágenes/moodboards no se hizo (requiere tu OK y definir si se
> generan dentro del repo o se enlazan).
