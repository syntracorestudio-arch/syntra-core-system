SYNTRA WEB DELIVERY PIPELINE — CORE SYSTEM

1. PROPÓSITO

## RELACIÓN CON SYNTRA WEB PLAYBOOK

Este documento es la fuente oficial de ejecución para proyectos web.

Define:

- estados
- transiciones
- aprobaciones
- bloqueos
- rollback

El SYNTRA WEB PLAYBOOK complementa este pipeline mediante guías prácticas y criterios operativos.

Ante cualquier conflicto:

este pipeline prevalece.

Este pipeline define el ciclo completo de vida de cualquier producto web dentro de SYNTRA CORE, desde la idea hasta producción y validación.

Opera como equivalente directo del:

👉 SYNTRA EXECUTION PROTOCOL (Automation)

Pero aplicado a:

web apps
SaaS interfaces
dashboards
frontend/back systems
2. PRINCIPIO FUNDAMENTAL

Un producto web no es una entrega de UI, es un sistema con estados verificables.

3. PIPELINE STATES (WEB LIFECYCLE)
🟡 STATE 0 — WEB REQUEST RECEIVED
Descripción

Se recibe un requerimiento de producto web.

Agente activo

Sales Agent → Intake Analyst handoff
(Intake Analyst operando en dominio web; ver nota en STATE 1)

Estado
Idea sin estructurar
Objetivo de negocio ambiguo
Output esperado
requerimiento inicial interpretado
Transición a:

👉 STATE 1

🟠 STATE 1 — STRUCTURED WEB REQUIREMENT
Agente activo

Intake Analyst (operando en dominio web)

Nota de dominio: es el mismo agente Intake Analyst del Execution
Protocol, actuando aquí sobre requerimientos web. No es un sistema
nuevo; estructura el requerimiento con independencia del dominio.

Función

Convertir requerimiento en estructura operativa.

Se define:
usuarios
triggers
acciones
flujo general del sistema
Output:
especificación funcional inicial
Transición a:

👉 STATE 1.5

🟢 STATE 1.5 — PRODUCT STRATEGY ALIGNMENT
Agente activo

Product Strategist

Función

Alinear el requerimiento estructurado con la lógica de negocio y la
visión de producto antes de definir la lógica funcional.

Se define:
objetivo de negocio
prioridad y alcance de producto
oportunidades y riesgos
Output:
requerimiento validado a nivel de negocio
Transición a:

👉 STATE 2

🟣 STATE 2 — PRODUCT LOGIC DEFINITION
Agente activo

Technical Product Owner

Función

Definir lógica del producto web.

Se define:
entidades
reglas funcionales
comportamiento del sistema
consistencia lógica
Output:
spec funcional sin ambigüedad
Transición a:

🎬 STATE 2.5 — CREATIVE DIRECTION

Agente activo

Creative Director

Función

Definir la dirección creativa del producto antes del diseño de experiencia.

Se define:

- diferenciación
- identidad conceptual
- narrativa visual
- principios de innovación
- percepción deseada del producto

Output:

creative direction approved

Transición a:

👉 STATE 3

👉 STATE 3

🎨 STATE 3 — UX EXPERIENCE DESIGN
Agente activo

Product Experience Designer

Función

Definir experiencia del usuario end-to-end.

Se define:
user flows
journey completo
comportamiento del sistema desde UX
Output:
UX flow estructurado
Transición a:

👉 STATE 4

🎨 STATE 4 — UI DESIGN SYSTEM
Agente activo

UI/UX Designer + Design System Guardian

Función

Convertir UX en interfaz visual concreta.

Se define:
layout
componentes
jerarquía visual
consistencia del design system
Output:
UI spec lista para implementación
Transición a:

👉 STATE 5

⚙️ STATE 5 — FRONTEND IMPLEMENTATION
Agente activo

Frontend Engineer

Función

Implementar UI exactamente según spec.

Reglas:
NO inventar componentes
NO alterar UX
usar design system existente
Output:
frontend funcional
Transición a:

👉 STATE 6

💻 STATE 6 — BACKEND INTEGRATION
Agente activo

Backend Engineer

Función

Conectar lógica, APIs y datos.

Se define:
endpoints
lógica de servidor
persistencia
integración frontend-backend
Output:
sistema funcional integrado
Transición a:

👉 STATE 7

🧪 STATE 7 — WEB QA & PERFORMANCE VALIDATION
Agente activo

Web QA & Performance Guard

Función

Validación completa del sistema web.

Se valida:
performance
UX real
errores funcionales
consistencia visual
estabilidad general
Output:
APPROVED / REJECTED
Transición a:

👉 STATE 7.5 (si la tarea es visual) o STATE 8 o rollback

🖼 STATE 7.5 — VISUAL QUALITY GATE (solo tareas visuales/perceptuales)
Agente activo

Visual Quality Director + aprobación del owner

Función

Validar que el resultado se vea premium y aprobable EN NAVEGADOR antes de
commitear. Aplica a tareas de composición, layout visual, percepción premium,
jerarquía, Hero, Servicios, Casos, Proceso, Contacto, motion visible, responsive
visual y uso del espacio.

Regla dura

Build verde NO significa diseño aprobado. Las tareas visuales NO se commitean por
tsc/lint/build/Lighthouse: se aprueban mirando el resultado.

Flujo:
prototipo local → QA técnico → review en navegador/screenshot (360x640, 390x844,
768x1024, 1024x768, 1440x900, 1920x1080) → **Composition Self-Review** → Visual
Review → aprobación visual del owner → commit. En desktop grande (1920) el diseño
no debe estirarse: conservar densidad, jerarquía y control del espacio negativo.

Composition Balance Gate (obligatorio, antes de pedir aprobación del owner):
no alcanza con "usa asset / no es dashboard azul / reduced-motion ok / QA verde";
el gate también evalúa proporción, jerarquía y balance. Veta si el texto principal
queda comprimido, el heading rompe sin intención, el protagonista es demasiado
chico, un secundario lo domina, las columnas están mal proporcionadas, 1920 queda
desaprovechado o el stack mobile es excesivo. Detalle: `agents/governance/visual-quality-gate.md` §6.5.

Output:
APROBADO / NO APROBADO / APROBADO CON AJUSTES

El Visual Quality Director puede BLOQUEAR el commit aunque el Web QA & Performance
Guard haya aprobado. Mientras no haya aprobación visual del owner, los cambios
quedan en working tree sin commitear.

Protocolo completo: agents/governance/visual-quality-gate.md

Transición a:

👉 STATE 8 (si aprueba) o ajuste/revert (si no aprueba)

🚀 STATE 8 — PRODUCTION DEPLOYED
Agente activo

Frontend + Backend Engineer

Función

Deploy a producción

Estado:
sistema activo
accesible por usuarios
Output:
release en producción
Transición a:

👉 STATE 9

🟢 STATE 9 — PRODUCTION VERIFIED
Agente activo

Web QA & Performance Guard

Función

Validación en entorno real

Se valida:
comportamiento en producción
estabilidad real
performance en usuarios reales
Estado final:

✅ COMPLETED

🎭 STATE 9.5 — EXPERIENCE AUDIT

Agente activo

Website Experience Auditor

Función

Auditar el resultado final desde la perspectiva de experiencia.

Se valida:

- diferenciación
- percepción premium
- memorabilidad
- coherencia narrativa
- ausencia de señales de template

Output:

APPROVED / REQUIRES IMPROVEMENT

Transición a:

👉 COMPLETED

🔁 4. REGLAS DE TRANSICIÓN
4.1 Regla de avance obligatorio

No se puede avanzar si:

el agente actual no aprueba
hay ambigüedad funcional
faltan inputs del estado anterior
4.2 Regla de rollback

Se puede volver a:

UX si UI falla
TPO si lógica es incorrecta
Intake si requerimiento era incompleto
4.3 Regla de bloqueo

El sistema se bloquea si:

no existe claridad funcional
hay inconsistencia entre UX y TPO
falta spec en cualquier layer
🧠 5. QA INTEGRATION RULE (CRÍTICO)
Web QA interviene en:
STATE 7 (validación)
STATE 9 (producción real)
Automation QA NO interviene en web
Visual Quality Director interviene en STATE 7.5 (solo tareas visuales): veto de
commit visual previo aprobación del owner. No reemplaza al Web QA.
🧩 6. ALINEACIÓN CON EXECUTION PROTOCOL (IMPORTANTE)

Este pipeline es equivalente estructural a:

Automation	Web
Intake	Intake
Structured	Structured
Architecture	TPO + UX
Implementation	Frontend + Backend
QA	Web QA
Deploy	Deploy
Production Verified	Production Verified

## 6. FAST TRACK INTEGRATION

Los cambios clasificados como
Categoría A dentro del Fast Track Protocol
pueden utilizar un pipeline simplificado.

Referencia:

agents/governance/fast-track-protocol.md

El Fast Track NO reemplaza este pipeline.

Solo define excepciones para cambios de bajo impacto.

🧭 7. PRINCIPIO FINAL

El sistema web no se diseña, se ejecuta en estados controlados.