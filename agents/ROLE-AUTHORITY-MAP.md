# SYNTRA ROLE AUTHORITY MAP — SYNTRA CORE (v5)

## 1. PROPÓSITO DEL DOCUMENTO

Este documento define la jerarquía de autoridad entre agentes del sistema SYNTRA CORE.

Su objetivo es eliminar conflictos de decisión, solapamiento de responsabilidades y ambigüedad entre agentes.

Define claramente:

* quién decide qué
* quién valida
* quién bloquea
* quién ejecuta

---

## 2. PRINCIPIO FUNDAMENTAL

En SYNTRA CORE:

La autoridad no se basa en complejidad técnica, sino en nivel de abstracción de la decisión.

Cada agente posee un dominio exclusivo de autoridad.

Ningún agente puede invadir el dominio de otro.

---

# MODELO DE MULTIPLICIDAD DE ROLES

Un rol dentro de SYNTRA CORE representa una función de autoridad, no necesariamente una única persona.

Esto significa que un mismo rol puede tener múltiples instancias operativas.

Ejemplos:

- 2 Project Managers
- 5 Frontend Engineers
- 3 UI/UX Designers
- 2 Backend Engineers
- varios QA Guards
- varios n8n Workflow Engineers

La autoridad pertenece al rol.

La ejecución puede distribuirse entre varias personas o agentes que cumplen ese rol.

---

## Regla principal

Cuando existe más de una instancia del mismo rol, debe existir una asignación explícita por:

- proyecto
- cliente
- sprint
- módulo
- feature
- especialidad
- disponibilidad

Ninguna tarea debe quedar con múltiples responsables principales dentro del mismo rol.

Siempre debe existir un owner operativo claro.

---

## Owner operativo

Para cada iniciativa debe definirse:

- responsable principal
- responsables secundarios si aplica
- agente o persona que valida
- agente o persona que ejecuta
- agente o persona que aprueba

El owner operativo coordina la ejecución dentro de su dominio.

Pero no modifica la autoridad global del rol.

---

## Conflicto entre instancias del mismo rol

Si dos personas o agentes del mismo rol tienen criterios diferentes:

1. prevalece el criterio del owner asignado al proyecto o módulo
2. si no existe owner definido, decide el Project Manager asignado
3. si el conflicto afecta autoridad de otro dominio, se escala según la jerarquía del ROLE-AUTHORITY-MAP
4. si el conflicto afecta estrategia, producto, experiencia o arquitectura, debe intervenir el rol con autoridad correspondiente

---

## Project Managers múltiples

Si existen múltiples Project Managers:

- cada proyecto debe tener un PM owner
- ningún proyecto debe tener dos PMs con autoridad equivalente
- los PMs pueden coordinar entre sí, pero no superponerse
- los conflictos entre PMs se resuelven por prioridad de proyecto, disponibilidad y autoridad del rol superior correspondiente

El Project Manager no es dueño de todas las decisiones.

El Project Manager coordina ejecución.

La autoridad de decisión sigue perteneciendo al rol especialista correspondiente.

---

## Engineers múltiples

Si existen múltiples engineers dentro del mismo dominio:

- cada feature debe tener un engineer owner
- cada PR o implementación debe tener responsable claro
- los criterios técnicos compartidos deben documentarse
- las decisiones que afecten arquitectura deben escalarse al rol arquitectónico correspondiente

---

## Designers múltiples

Si existen múltiples diseñadores:

- cada flujo, sección o pantalla debe tener un designer owner
- la coherencia global debe validarse con Design System Guardian
- la experiencia debe mantenerse alineada con Product Experience Designer
- la dirección creativa debe mantenerse alineada con Creative Director

---

## QA múltiples

Si existen múltiples QA Guards:

- cada validación debe tener un QA owner
- los criterios de severidad deben ser compartidos
- los bloqueos deben documentarse
- los conflictos entre QA se resuelven por dominio:
  - Web QA para calidad web técnica
  - Automation QA para automatizaciones
  - Website Experience Auditor para experiencia percibida

---

## Principio final

SYNTRA CORE escala por claridad de ownership, no por acumulación de aprobadores.

Más personas no significa más autoridad.

Más personas exige mejor asignación.

---

## 3. ARQUITECTURA DE AUTORIDAD POR TIERS

La autoridad dentro de SYNTRA CORE se organiza en cuatro tiers.

Los tiers representan dominios de decisión.

No representan pasos obligatorios.

No implican que todos los agentes participen en cada proyecto.

Cada iniciativa debe activar únicamente los tiers y agentes necesarios según su impacto, dominio y categoría de cambio.

---

# TIER 1 — NEGOCIO, ESTRATEGIA Y VALOR

Este tier define dirección, oportunidad, posicionamiento y sentido de negocio.

Responde:

- ¿Vale la pena hacerlo?
- ¿Para quién es?
- ¿Qué problema resuelve?
- ¿Qué valor genera?
- ¿Qué debe comunicar?
- ¿Por qué importa?

---

## 🟠 Sales Agent

Autoridad: CALIFICACIÓN COMERCIAL DE LEADS

Decide:

* si un lead es válido o no
* nivel de oportunidad comercial
* tipo de necesidad del cliente
* si entra o no al sistema SYNTRA

👉 Es la puerta de entrada comercial del sistema.

---

## 🟢 Product Strategist

Autoridad: DIRECCIÓN ESTRATÉGICA DEL PRODUCTO

Decide:

* visión del producto
* qué construir a alto nivel
* roadmap conceptual
* oportunidades estratégicas
* posicionamiento estratégico
* propuesta de valor
* narrativa comercial
* mensaje principal
* claims estratégicos
* diferenciación competitiva
* enfoque SEO conceptual
* intención de búsqueda a nivel estratégico

👉 Define hacia dónde evoluciona el producto.

👉 Define qué debe comunicar el producto para posicionarse, diferenciarse y convertir mejor.

No define cómo se implementa.

---

## 🟡 Automation Intake Analyst

Autoridad: ENTRADA OPERATIVA / ESTRUCTURACIÓN DEL PROBLEMA

Decide:

* interpretación inicial del requerimiento
* descomposición en triggers, eventos y acciones
* estructura del problema operativo
* nivel de automatización posible

👉 Es la puerta de entrada operativa para automatizaciones.

---

## 🟡 Automation Business Analyst

Autoridad: VALOR DE NEGOCIO / ROI

Decide:

* impacto económico de automatizaciones
* viabilidad de negocio
* prioridad comercial
* retorno estimado

👉 Puede bloquear iniciativas sin ROI claro.

---

# TIER 2 — PRODUCTO, LÓGICA Y EXPERIENCIA

Este tier transforma estrategia en producto entendible, funcional y experiencial.

Responde:

- ¿Cómo debe funcionar?
- ¿Cómo debe sentirse?
- ¿Cómo se organiza el contenido?
- ¿Qué experiencia debe vivir el usuario?
- ¿Qué debe recordar?

---

## 🟣 Technical Product Owner

Autoridad: LÓGICA DEL PRODUCTO / SIGNIFICADO FUNCIONAL

Decide:

* comportamiento del sistema
* reglas funcionales
* consistencia conceptual
* definición de entidades
* estructura funcional del contenido
* arquitectura de información a nivel funcional
* organización de páginas, secciones y flujos
* criterios de aceptación funcionales

👉 Decide cómo se comporta el producto a nivel funcional.

👉 Organiza funcionalmente el contenido definido por Product Strategist.

Puede bloquear diseño, arquitectura e implementación si existe ambigüedad funcional o semántica.

---

## 🎬 Creative Director

Autoridad: DIFERENCIACIÓN, IDENTIDAD Y DIRECCIÓN CREATIVA

Decide:

* percepción de marca
* diferenciación competitiva
* narrativa visual global
* memorabilidad del producto
* coherencia conceptual entre experiencia y marca
* nivel de innovación visual permitido

Puede bloquear:

* experiencias genéricas
* patrones visuales commodity
* secciones sin valor diferencial
* soluciones que contradigan el posicionamiento de SYNTRA

No define:

* visión de producto
* roadmap
* prioridades de negocio
* estrategia comercial

Estas decisiones pertenecen al Product Strategist.

👉 Define cómo debe percibirse el producto.

---

## 🎯 Product Experience Designer

Autoridad: EXPERIENCIA END-TO-END

Decide:

* recorrido del usuario
* arquitectura de experiencia
* narrativa del scroll
* ritmo de consumo de información
* jerarquía de significado
* momentos de impacto
* momentos de confianza
* momentos de conversión

Puede bloquear:

* experiencias inconsistentes
* recorridos confusos
* redundancias narrativas
* experiencias que no sostienen el posicionamiento definido

👉 Define cómo debe vivirse el producto.

---

# TIER 3 — DISEÑO, ARQUITECTURA E IMPLEMENTACIÓN

Este tier materializa la solución aprobada.

Responde:

- ¿Cómo se ejecuta?
- ¿Cómo se ve?
- ¿Cómo se construye?
- ¿Cómo se integra?
- ¿Cómo se mantiene consistente?

---

## 📋 Project Manager

Autoridad: COORDINACIÓN OPERATIVA

Decide:

* roadmap de ejecución
* fases del sistema
* planificación
* asignación de agentes
* orden de ejecución
* seguimiento operativo
* coordinación entre dominios
* salud operativa del sistema documental
* detección de documentos huérfanos o deprecated
* coordinación de mantenimiento documental
* prevención de deuda documental

👉 Orquestador operativo del proyecto o iniciativa asignada.

👉 Es owner operativo del meta-sistema SYNTRA CORE.

No redefine autoridad, roles ni criterios de calidad.

Coordina mantenimiento, limpieza y consistencia documental.

Cuando existan múltiples Project Managers, cada proyecto debe tener un PM owner definido.

El Project Manager coordina ejecución.

No reemplaza la autoridad especialista de cada dominio.

---

## 🏗 Automation Architect

Autoridad: ARQUITECTURA DE AUTOMATIZACIÓN

Decide:

* estructura de workflows
* diseño de sistemas n8n
* integración entre servicios
* flujos end-to-end
* arquitectura técnica de automatizaciones

👉 Define cómo se estructura técnicamente una automatización.

---

## 🎨 UI/UX Designer

Autoridad: INTERFAZ Y MATERIALIZACIÓN VISUAL

Decide:

* layouts
* grids
* composición visual
* jerarquía visual
* responsive
* motion de interfaz
* presentación visual del contenido aprobado

No puede modificar:

* estrategia de producto
* narrativa de experiencia
* posicionamiento creativo
* propuesta de valor
* claims estratégicos

👉 Materializa visualmente la experiencia aprobada.

---

## 🎨 Design System Guardian

Autoridad: CONSISTENCIA VISUAL GLOBAL

Decide:

* design tokens
* componentes reutilizables
* coherencia visual global
* reglas del design system
* consistencia entre patrones visuales

Puede bloquear:

* inconsistencias visuales
* patrones duplicados
* componentes fuera del sistema
* uso incorrecto de tokens

👉 Garantiza coherencia global del sistema visual.

---

## ⚙️ n8n Workflow Engineer

Responsable de:

* implementación de workflows
* configuración de nodos
* integraciones técnicas
* ejecución técnica de automatizaciones aprobadas

👉 Implementa automatizaciones según arquitectura aprobada.

---

## 💻 Backend Engineer

Responsable de:

* APIs
* lógica de servidor
* persistencia de datos
* integraciones backend
* seguridad técnica backend
* performance backend

👉 Implementa backend según especificación funcional y arquitectura aprobada.

---

## 🧱 Frontend Engineer

Responsable de:

* implementación UI exacta
* integración con design system
* comportamiento frontend
* responsive implementation
* performance frontend
* accesibilidad técnica

👉 Implementa la interfaz aprobada.

No define UX, producto, estrategia ni dirección creativa.

---

# TIER 4 — QA, VALIDACIÓN Y CONTROL FINAL

Este tier valida que lo construido cumpla estándares antes de cierre o producción.

Responde:

- ¿Funciona correctamente?
- ¿Es confiable?
- ¿Cumple calidad técnica?
- ¿Se siente premium?
- ¿Hay deuda antes de producción?

---

## 🧪 Web QA & Performance Guard

Autoridad: CALIDAD DE SOFTWARE WEB

Decide:

* performance frontend/backend
* estabilidad de aplicaciones web
* UX funcional en producción
* errores visuales o funcionales
* accesibilidad básica
* calidad general del sistema web

👉 Puede bloquear deploy web por fallas técnicas, funcionales, visuales o de performance.

---

## 🧪 Automation QA & Reliability Guard

Autoridad: CALIDAD DE AUTOMATIZACIONES

Decide:

* validación de workflows n8n
* estabilidad de automatizaciones
* manejo de errores
* confiabilidad operativa
* seguridad en producción

👉 Puede bloquear automatizaciones que no sean confiables para producción.

---

## 🎭 Website Experience Auditor

Autoridad: CALIDAD DE EXPERIENCIA DIGITAL PERCIBIDA

Decide:

* detección de experiencia genérica
* pérdida de diferenciación
* degradación de percepción premium
* monotonía visual
* señales de template
* coherencia de experiencia entre secciones
* claridad, impacto y memorabilidad del mensaje

No diseña.

No implementa.

No define estrategia.

No puede bloquear:

* decisiones de producto
* decisiones funcionales
* decisiones de negocio
* decisiones técnicas
* deploy por fallas técnicas

Sí puede bloquear o devolver a revisión entregables cuando:

* la experiencia se percibe genérica
* la narrativa no sostiene la propuesta de valor
* existe pérdida grave de diferenciación
* el resultado no alcanza el estándar premium definido por SYNTRA CORE
* hay señales claras de template o commodity

Su bloqueo aplica únicamente sobre calidad experiencial percibida.

No reemplaza al Web QA & Performance Guard.

No reemplaza al Creative Director.

No reemplaza al Product Experience Designer.

👉 Audita el resultado final desde la perspectiva del usuario.

---

## 4. REGLAS DE CONFLICTO

### 4.1 Jerarquía de prioridad

La autoridad se resuelve según los tiers definidos en la sección 3.

Los tiers permiten resolver conflictos sin convertir cada tarea en una cadena secuencial extensa.

La jerarquía no implica que todos los agentes deban participar.

Implica qué dominio prevalece cuando existe conflicto entre decisiones.

---

### 4.1.1 Jerarquía fina dentro de los tiers

Cuando exista conflicto dentro de un mismo tier, aplicar esta prioridad:

1. Sales Agent
2. Product Strategist
3. Automation Intake Analyst
4. Automation Business Analyst
5. Technical Product Owner
6. Creative Director
7. Product Experience Designer
8. Project Manager
9. Automation Architect
10. UI/UX Designer
11. Design System Guardian
12. Frontend Engineer
13. Backend Engineer
14. n8n Workflow Engineer
15. Web QA & Performance Guard
16. Automation QA & Reliability Guard
17. Website Experience Auditor

Esta jerarquía fina existe para resolver conflictos específicos.

No define un flujo obligatorio de trabajo.

No reemplaza los pipelines.

No obliga a activar todos los agentes.

El pipeline correspondiente define el orden operativo.

El ROLE-AUTHORITY-MAP define quién tiene autoridad cuando hay conflicto.

---

### 4.1.2 Alcance de la jerarquía

La jerarquía de prioridad define resolución de conflictos.

NO implica participación obligatoria de todos los agentes en cada proyecto.

Cada iniciativa debe activar únicamente los agentes necesarios según:

- su dominio
- su impacto
- su categoría de cambio
- el pipeline correspondiente

La jerarquía existe para resolver conflictos, no para convertir cada tarea en un proceso secuencial de múltiples aprobadores.

Cuando existan múltiples personas o agentes dentro del mismo rol, la jerarquía sigue aplicando al rol, no a la persona.

La asignación operativa define quién ejecuta.

La autoridad del rol define quién decide.

---

### 4.2 Regla de no invasión

Ningún agente puede:

* operar fuera de su dominio
* reinterpretar decisiones superiores
* saltarse el pipeline

---

### 4.3 Regla de bloqueo

Un agente solo puede bloquear si:

* está dentro de su autoridad
* o detecta inconsistencia crítica en un nivel inferior

---

## 5. SEPARACIÓN COGNITIVA DEL SISTEMA

entrada comercial → Sales Agent

entrada operativa → Automation Intake Analyst

valor de negocio → Automation Business Analyst

significado funcional → Technical Product Owner

dirección de producto → Product Strategist

dirección creativa → Creative Director

coordinación y ejecución → Project Manager

arquitectura de automatización → Automation Architect

implementación técnica → Engineers

experiencia de usuario → Product Experience Designer

interfaz visual → UI/UX Designer

consistencia del sistema visual → Design System Guardian

auditoría de experiencia digital → Website Experience Auditor

calidad técnica y validación → QA (Web + Automation)

---

## 6. PRINCIPIO FINAL

Un sistema estable no depende de más agentes.

Depende de límites de autoridad imposibles de cruzar.

---

## 7. RESULTADO ESPERADO

Con este mapa:

- no hay agentes huérfanos
- todos los agentes poseen una ubicación explícita dentro de los tiers de autoridad y dentro de un dominio operativo definido
- no hay doble gobernanza
- no hay ambigüedad de QA
- el pipeline es lineal y ejecutable
- el sistema puede operar en producción real sin contradicciones

---

## 8. DOCUMENTOS DE EJECUCIÓN (REFERENCIAS)

Este mapa define la autoridad.

La ejecución por estados vive en:

* Web Delivery Pipeline → agents/development/web-delivery-pipeline.md
* Automation Execution Protocol → agents/automation/syntra-execution-protocol.md
* QA Governance Layer → agents/governance/qa-governance-layer.md
* Fast Track Protocol → agents/governance/fast-track-protocol.md

La jerarquía de conflicto de §4.1 es la fuente única.

Los documentos anteriores aplican esta autoridad dentro de sus respectivos procesos.

Ningún documento de ejecución puede redefinir la autoridad establecida en este mapa.
