---
section: "landing-publica"
status: approved
approved_by: owner
approved_date: 2026-06-27
date: 2026-06-27
decision: code-first
---

# Reference Lock — Landing pública por estudio `/e/[slug]`

Página **pública** (sin login) que es "la cara" del estudio en internet (ej.
`/e/estudio-reforma`; ruta prefijada `/e/` para no ensombrecer rutas raíz reservadas como
`/admin`, `/login`). Informado por `creative-director` (dirección) + `product-experience-designer`
(journey), read-only. Hereda el lenguaje de la app (tokens cálidos, primitivos, pase de
elevation). **NO** aplica la doctrina web-viva/3D de la web de SYNTRA: es app utilitaria
premium cálida, liviana, SEO-friendly, mobile-first.

## El sentir objetivo
"Entrar al estudio antes de entrar al estudio": una **recepción cálida, ordenada y honesta**.
No vende "una app" — vende que **este estudio tiene su acto junto**. Anclas: páginas de
estudios boutique wellness reales (tierra/crema, foto de luz natural), modelo mental de "ficha
de un lugar" (tipo página de restaurante con reserva), NO Mindbody frío ni template de gimnasio.

## Decisión central (fricción del código)
Reservar exige cuenta; crear cuenta (`/join`) exige un **código que solo da el estudio**. Un
alumno potencial desde Instagram **no lo tiene**. Por eso:
- **CTA primario = "Quiero sumarme" → WhatsApp** (mensaje pre-rellenado). Convierte la fricción
  real en un handoff humano (natural para un estudio boutique).
- **CTA secundario = "Ya soy alumno · Ingresar" → `/login`** (discreto).
- **"Reservar" por clase = condicional a sesión:** con sesión → `/app`; sin sesión → `/login`.
  **Nunca** lleva directo a `/join` (callejón sin salida). `/join` debe ofrecer "pedí tu código
  por WhatsApp" como salida.
- No usar toggle "¿sos nuevo/alumno?": enrutar por contenido/intención, no por pregunta.

## Estructura (mobile-first, corta y honesta — 5 bloques + footer)
1. **Hero — "la cara del estudio"**: nombre grande (wordmark), 1 línea honesta ("Pilates
   reformer en Palermo · grupos reducidos"), acento + foto-o-fallback cálido, CTA primario
   "Quiero sumarme" (WhatsApp) + acceso discreto "Ya soy alumno". A una pantalla en mobile.
2. **Agenda de la semana (el corazón / motor de conversión)**: próximas clases por día,
   **read-only**, reutilizando el lenguaje de `class-card.tsx` (hora grande, nombre, instructor,
   badge de cupo). Selector de día como el strip de `/app`. "Reservar" por clase (condicional).
3. **Qué vas a encontrar**: 3 anclas de confianza (texto del estudio, ej. "Clases reducidas ·
   Reformer y mat · Turnos que se respetan"), Cards + iconos lucide finos. NO "features" SaaS.
4. **Packs / precios (opcional)**: 2-3 Cards cálidas si el estudio cargó `passes` activos;
   precio `$` AR. Si no hay → se omite el bloque entero (sin "$0" ni "próximamente").
5. **Ubicación + contacto**: dirección, mapa **estático/lazy** (imagen + link a Maps, sin JS
   pesado), horarios de atención, WhatsApp grande.
6. **Footer**: nombre, "Quiero sumarme" otra vez, "Provisto por SYNTRA" discreto.

CTA "Quiero sumarme": hero + sticky discreto en mobile (botón redondeado, no barra invasiva) +
bloque de contacto + footer. WhatsApp siempre secundario en peso, nunca compitiendo.

## Hero sin logo
El **nombre ES el logotipo**: wordmark en Plus Jakarta Sans bold `tracking-tight`, grande +
**monograma** (inicial en círculo `bg-primary/10` con la inicial en `--primary`). Acento con
disciplina: keyline fino, monograma, CTA, y lavado sutil `from-primary/10 via-card` (el mismo
degradé del KPI héroe del dashboard). Foto del estudio con overlay arena (AA). **Sin foto →
fallback NO vacío**: panel `bg-surface-sunken` con monograma grande del acento. Jamás stock de
gimnasio ni hueco gris.

## Agenda pública — qué se muestra / qué NO
- **Mostrar (público):** día + hora + duración, nombre de clase + instructor, **estado de cupo
  CUALITATIVO** ("Disponible" / "Últimos lugares" / "Lleno", mismos colores semánticos).
- **NO exponer (privacidad):** números crudos `booked/capacity`, nombres de anotados/waitlist,
  saldos, datos de contacto de alumnos, ids internos.
- Estado vacío del día: patrón cálido de `/app`.

## White-label (disciplina + guardrails)
- Acento (`branding.accent`) manda SOLO en: CTA primario, monograma, keyline, lavado del hero,
  día activo del strip, punto de cupo disponible, links primarios. **Tintes (/10,/15) y
  elementos chicos, nunca superficies grandes.**
- Neutro compartido (no cambia entre estudios): fondo arena, foreground, cards, bordes, sombras,
  semánticos de cupo.
- **Cero hex hardcodeado** fuera de `--primary` y semánticos. Nombre/subtítulo/dirección/packs/
  foto/WhatsApp vienen de datos del estudio.
- **RIESGO a resolver — contraste AA del acento:** un estudio puede elegir un acento claro/feo.
  El CTA `bg-primary text-primary-foreground` debe garantizar AA → o se valida el contraste al
  guardar el branding, o `--primary-foreground` se calcula por luminancia del acento. **Definir
  antes de implementar.**

## Estados
- **Sin clases cargadas:** bloque cálido "Agenda en preparación — escribinos" + WhatsApp (no
  agenda vacía deprimente). Identidad + info + contacto sostienen la página.
- **Sin contacto:** CTA cae a la mejor alternativa (email/teléfono/Instagram). **Requisito
  mínimo de publicación: al menos un canal de contacto** (a confirmar con TPO).
- **Sin packs:** se omite la sección.
- **Slug inexistente → 404 cálido** (no técnico): "No encontramos este estudio. Puede que el
  enlace esté mal escrito." + tono humano.
- **Estudio pausado** (`status='suspended'`): "Este estudio no está tomando reservas por ahora".

## Dependencias técnicas (a resolver en implementación)
- **Acceso público a datos sin RLS de alumno:** la agenda + info del estudio por slug necesitan
  un **RPC `SECURITY DEFINER`** (ej. `public_studio_landing(p_slug)`) que devuelva SOLO campos
  no sensibles + cupo cualitativo (derivado, sin `booked_count` crudo). Migración → gate.
- **Campos de landing** (whatsapp, dirección, subtítulo, instagram, foto): guardarlos en
  `studios.branding` jsonb (sin migración de columnas) + editarlos en una sección "Landing" de
  Configuración. Slice de datos previo a la página.
- **CLS:** reservar altura de agenda/mapa, lazy del mapa (tráfico Instagram, redes lentas).

## Qué NO debe parecer
Gimnasio (negro/flúor, "TRANSFORMÁ", contadores falsos) · template SaaS frío (gradiente morado,
mockup flotante, logos "confían en nosotros", testimonios stock) · pricing table agresiva ·
foto stock de gimnasio · glass/neón/3D/parallax/scroll-jacking · data inventada (testimonios,
"+500 alumnos", estrellas) · números de cupo o nombres de alumnos · hero lindo seguido de nada.

## Criterios de aprobación (binarios)
- [ ] Reconocés el estudio en &lt;1s (nombre + acento) sin logo.
- [ ] La agenda real con cupo cualitativo se ve sin login y es el activo de confianza nº1.
- [ ] CTA primario = "Quiero sumarme" (WhatsApp); "Ya soy alumno" discreto; "Reservar" por clase
      condicional a sesión (nunca `/join` directo).
- [ ] Se siente hermana de la app (mismos tokens/Cards/class-card), cálida y premium, NO gimnasio
      ni SaaS frío.
- [ ] White-label: cero color hardcodeado; se re-tiñe con el acento; CTA mantiene AA con un acento
      alternativo.
- [ ] Sin exponer números de cupo ni nombres de alumnos.
- [ ] Estados resueltos (sin clases, sin contacto, sin packs, 404 cálido). CLS 0.
- [ ] Mobile-first; CTA accesible sin scroll en hero.

## Owner approval
Estado: **approved · owner · 2026-06-27.** Decisiones confirmadas: (a) CTA primario = WhatsApp
"Quiero sumarme"; (b) campos de landing en `branding` jsonb + sección en Configuración; (c) RPC
público (SECURITY DEFINER) para la agenda; (d) guarda de contraste = `--primary-foreground`
calculado por luminancia del acento (blanco/oscuro automático).
