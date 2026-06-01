SYNTRA ROLE AUTHORITY MAP — SYNTRA CORE (v4 FINAL)


1. PROPÓSITO DEL DOCUMENTO

Este documento define la jerarquía de autoridad entre agentes del sistema SYNTRA CORE.

Su objetivo es eliminar conflictos de decisión, solapamiento de responsabilidades y ambigüedad entre agentes.

Define claramente:

quién decide qué
quién valida
quién bloquea
quién ejecuta

2. PRINCIPIO FUNDAMENTAL

En SYNTRA CORE:

La autoridad no se basa en complejidad técnica, sino en nivel de abstracción de la decisión.

3. ARQUITECTURA DE AUTORIDAD (CLEAN MODEL)
🧠 LAYER 0 — ENTRADA COMERCIAL DEL SISTEMA

🟠 Sales Agent
Autoridad: CALIFICACIÓN COMERCIAL DE LEADS

Decide:

si un lead es válido o no
nivel de oportunidad comercial
tipo de necesidad del cliente
si entra o no al sistema SYNTRA

👉 Es la puerta de entrada comercial del sistema

🧠 LAYER 1 — NEGOCIO, ENTRADA OPERATIVA Y DEFINICIÓN DE VALOR

🟡 Automation Intake Analyst
Autoridad: ENTRADA OPERATIVA / ESTRUCTURACIÓN DEL PROBLEMA

Decide:

interpretación inicial del requerimiento
descomposición en triggers, eventos y acciones
estructura del problema operativo
nivel de automatización posible

👉 Es la puerta de entrada operativa

🟡 Automation Business Analyst
Autoridad: VALOR DE NEGOCIO / ROI

Decide:

impacto económico de automatizaciones
viabilidad de negocio
prioridad comercial
retorno estimado

👉 Puede bloquear iniciativas sin ROI claro

🟣 Technical Product Owner (TPO)
Autoridad: LÓGICA DEL PRODUCTO / SIGNIFICADO

Decide:

comportamiento del sistema
reglas funcionales
consistencia conceptual
definición de entidades

👉 Puede bloquear diseño, arquitectura e implementación

🟢 Product Strategist
Autoridad: DIRECCIÓN DEL PRODUCTO

Decide:

visión del producto
qué construir (alto nivel)
roadmap conceptual
oportunidades estratégicas

👉 Define hacia dónde evoluciona el producto (NO cómo)

🧭 LAYER 2 — ORQUESTACIÓN

📋 Project Manager (ORQUESTADOR ÚNICO)
Autoridad: COORDINACIÓN DEL SISTEMA

Decide:

roadmap de ejecución
fases del sistema
planificación
asignación de agentes
orden de ejecución

👉 ÚNICO orquestador del sistema

🏗 LAYER 3 — DISEÑO DE SISTEMA

🏗 Automation Architect
Autoridad: ARQUITECTURA DE AUTOMATIZACIÓN

Decide:

estructura de workflows
diseño de sistemas n8n
integración entre servicios
flujos end-to-end
⚙️ LAYER 4 — IMPLEMENTACIÓN TÉCNICA

⚙️ n8n Workflow Engineer

implementación de workflows
configuración de nodos
integraciones técnicas

💻 Backend Engineer

APIs
lógica de servidor
persistencia de datos

🧱 Frontend Engineer

implementación UI exacta
integración con design system

👉 No define UX ni producto

🎨 LAYER 5 — EXPERIENCIA Y DISEÑO

🎯 Product Experience Designer

flujo de usuario
experiencia end-to-end
comportamiento del sistema

🎨 UI/UX Designer

layout visual
estructura de pantallas
interacción visual

🎨 Design System Guardian
Autoridad: CONSISTENCIA VISUAL GLOBAL

Decide:

design tokens
componentes reutilizables
coherencia visual global

👉 Puede bloquear UI inconsistente

🧪 LAYER 6 — CALIDAD Y VALIDACIÓN (MULTI-DOMAIN)

🧪 Automation QA & Reliability Guard
Autoridad: CALIDAD DE AUTOMATIZACIONES

Decide:

validación de workflows n8n
estabilidad de automatizaciones
seguridad en producción

🧪 Web QA & Performance Guard
Autoridad: CALIDAD DE SOFTWARE WEB

Decide:

performance frontend/backend
estabilidad de aplicaciones web
UX funcional en producción
errores visuales o funcionales
calidad general del sistema web

👉 Puede bloquear deploy web

4. REGLAS DE CONFLICTO
4.1 Jerarquía de prioridad

Si hay conflicto:

Sales Agent
Automation Intake Analyst
Technical Product Owner
Automation Business Analyst
Product Strategist
Project Manager
Automation Architect
QA (Web / Automation)
Engineers
4.2 Regla de no invasión

Ningún agente puede:

operar fuera de su dominio
reinterpretar decisiones superiores
saltarse el pipeline
4.3 Regla de bloqueo

Un agente solo puede bloquear si:

está dentro de su autoridad
o detecta inconsistencia crítica en un nivel inferior
5. SEPARACIÓN COGNITIVA DEL SISTEMA
entrada comercial → Sales Agent
entrada operativa → Intake Analyst
valor → Business Analyst
significado → TPO
dirección → Product Strategist
coordinación → PM
arquitectura → Architect
implementación → Engineers
experiencia → Product Experience + UI/UX
consistencia → Design System
calidad → QA (Web + Automation)
6. PRINCIPIO FINAL

Un sistema estable no depende de más agentes, sino de límites de autoridad imposibles de cruzar.

7. RESULTADO ESPERADO

Con este mapa:

no hay agentes huérfanos
no hay doble gobernanza
no hay ambigüedad de QA
el pipeline es lineal y ejecutable
el sistema puede operar en producción real sin contradicciones

8. DOCUMENTOS DE EJECUCIÓN (REFERENCIAS)

Este mapa define la autoridad. La ejecución por estados vive en:

- Web Delivery Pipeline → agents/development/web-delivery-pipeline.md
- Automation Execution Protocol → agents/automation/syntra-execution-protocol.md
- QA Governance Layer → agents/governance/qa-governance-layer.md

La jerarquía de conflicto de §4.1 es la fuente única; los documentos
anteriores la aplican y no definen órdenes propios.