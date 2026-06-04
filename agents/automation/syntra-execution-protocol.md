# SYNTRA EXECUTION PROTOCOL — CORE LIFECYCLE SYSTEM (AUTOMATION)

---

# 1. PROPÓSITO DEL DOCUMENTO

Este documento define el ciclo de vida completo de una automatización dentro de SYNTRA CORE, desde la entrada del cliente hasta su despliegue y verificación en producción.

Establece:

- estados del sistema (pipeline states)
- transiciones entre agentes
- reglas de avance y bloqueo
- puntos de validación obligatorios
- integración con el Fast Track Protocol

Es el equivalente, para el dominio de **automatización**, del Web Delivery Pipeline (dominio web).

---

# 2. SISTEMA DE GOBERNANZA (OBLIGATORIO)

Este protocolo opera bajo:

👉 **ROLE-AUTHORITY-MAP — SYNTRA CORE** (única fuente de autoridad)

Documentos relacionados:

- `agents/governance/qa-governance-layer.md` — autoridad y dominios de QA
- `agents/governance/fast-track-protocol.md` — clasificación de cambios por impacto
- `agents/development/web-delivery-pipeline.md` — pipeline equivalente para web

❌ Cualquier referencia a sistemas previos queda completamente invalidada.

El orden de autoridad ante conflicto es el de ROLE-AUTHORITY-MAP §4.1; este protocolo define el flujo de ejecución, no la jerarquía.

---

# 3. PRINCIPIO FUNDAMENTAL

Toda automatización en SYNTRA CORE es un:

> 🔄 sistema con ciclo de vida controlado por estados

No es una tarea. No es un proyecto aislado.

Es un flujo estructurado con transición de estados determinística.

---

# 4. PIPELINE STATES (ESTADOS DEL SISTEMA)

Orden alineado al ROLE-AUTHORITY-MAP: entrada operativa → significado/valor → arquitectura → implementación → calidad → producción.

---

## 🟡 STATE 0 — INTAKE RECEIVED

### Descripción
El cliente ingresa un requerimiento sin estructurar.

### Agente responsable
Automation Intake Analyst

### Estado del sistema
- información inicial
- ambigüedad posible
- sin estructuración lógica

### Output esperado
- requerimiento recibido y registrado

### Transición a:
👉 STATE 1

---

## 🟠 STATE 1 — STRUCTURED REQUIREMENT

### Descripción
El requerimiento se descompone en proceso lógico (entrada operativa).

### Agente responsable
Automation Intake Analyst

### Estado del sistema
- triggers identificados
- eventos y acciones definidos
- sistemas involucrados detectados

### Output esperado
- requerimiento estructurado, listo para definición de producto

### Transición a:
👉 STATE 2

---

## 🟡 STATE 2 — BUSINESS VALUE VALIDATION

### Descripción
Se evalúa el impacto de negocio, la viabilidad y el retorno esperado de la automatización.

### Agente responsable
Automation Business Analyst

### Estado del sistema
- ROI estimado
- prioridad comercial
- valor esperado
- riesgos de negocio

### Output esperado
- iniciativa validada (o bloqueada) a nivel de negocio

### Autoridad
Puede bloquear iniciativas sin ROI claro (ROLE-AUTHORITY-MAP).

### Transición a:
👉 STATE 3

---

## 🟣 STATE 3 — PRODUCT LOGIC DEFINITION

### Descripción
Se define el significado, las reglas funcionales y la consistencia conceptual del sistema antes de la arquitectura.

### Agente responsable
Technical Product Owner (TPO)

### Estado del sistema
- entidades definidas
- reglas funcionales claras
- comportamiento esperado del sistema
- ambigüedad semántica eliminada

### Output esperado
- definición funcional sin ambigüedad

### Autoridad
El TPO puede bloquear el avance a arquitectura si existe ambigüedad conceptual (ROLE-AUTHORITY-MAP).

### Transición a:
👉 STATE 4

---

## 🔵 STATE 4 — ARCHITECTURE DESIGN

### Descripción
Se diseña la arquitectura del sistema de automatización.

### Agente responsable
Automation Architect

### Estado del sistema
- flujo end-to-end definido
- nodos conceptuales
- integraciones identificadas

### Output esperado
- arquitectura completa del workflow

### Transición a:
👉 STATE 5

---

## 🟣 STATE 5 — IMPLEMENTATION READY

### Descripción
La arquitectura está lista para implementación técnica.

### Agente responsable
n8n Workflow Engineer

### Estado del sistema
- flujo sin ambigüedad
- nodos definidos
- lógica clara

### Output esperado
- workflow implementable en n8n

### Transición a:
👉 STATE 6

---

## 🔴 STATE 6 — IMPLEMENTATION IN PROGRESS

### Descripción
El workflow está siendo construido en n8n.

### Agente responsable
n8n Workflow Engineer

### Estado del sistema
- nodos configurados
- integraciones activas
- flujo en construcción

### Output esperado
- workflow funcional

### Transición a:
👉 STATE 7

---

## 🟢 STATE 7 — QA VALIDATION

### Descripción
Se valida el workflow antes de producción.

### Agente responsable
Automation QA & Reliability Guard

### Estado del sistema
- simulación de ejecución
- validación de edge cases
- testing de integraciones

### Output esperado
- APPROVED / REJECTED

### Transición a:
👉 STATE 8 — o rollback a STATE 5 / 6

---

## ⚫ STATE 8 — PRODUCTION DEPLOYED

### Descripción
El workflow fue desplegado en producción.

### Agente responsable
n8n Workflow Engineer

### Estado del sistema
- sistema activo
- ejecución en entorno real

### Output esperado
- sistema operativo

### Transición a:
👉 STATE 9

---

## 🟢 STATE 9 — PRODUCTION VERIFIED

### Descripción
El workflow fue validado en producción real.

### Agente responsable
Automation QA & Reliability Guard

### Estado del sistema
- ejecución real validada
- sin errores críticos
- comportamiento estable

### Estado final:
✅ COMPLETED

---

# 5. REGLAS DE TRANSICIÓN

## 5.1 Regla de avance obligatorio

No se puede avanzar de estado si:

- el agente actual no aprobó el output
- existe ambigüedad sin resolver
- falta validación del estado anterior

## 5.2 Regla de rollback

Se puede retroceder si:

- QA detecta fallos (→ STATE 5 / 6)
- la arquitectura es inconsistente (→ STATE 4)
- la definición de producto es ambigua (→ STATE 3)
- el intake estaba incompleto (→ STATE 0 / 1)

## 5.3 Regla de bloqueo absoluto

El sistema se bloquea si:

- no existe claridad del estado actual
- falta agente responsable definido
- hay inconsistencias en el flujo

---

# 6. RESPONSABILIDAD POR ESTADO

| Estado | Nombre | Agente Responsable |
|--------|--------|--------------------|
| 0 | Intake Received | Automation Intake Analyst |
| 1 | Structured Requirement | Automation Intake Analyst |
| 2 | Business Value Validation | Automation Business Analyst |
| 3 | Product Logic Definition | Technical Product Owner |
| 4 | Architecture Design | Automation Architect |
| 5 | Implementation Ready | n8n Workflow Engineer |
| 6 | Implementation In Progress | n8n Workflow Engineer |
| 7 | QA Validation | Automation QA & Reliability Guard |
| 8 | Production Deployed | n8n Workflow Engineer |
| 9 | Production Verified | Automation QA & Reliability Guard |

---

# 7. FAST TRACK INTEGRATION

Los cambios sobre automatizaciones existentes clasificados como **Categoría A** dentro del Fast Track Protocol pueden utilizar un flujo simplificado, sin recorrer los 10 estados.

Referencia: `agents/governance/fast-track-protocol.md`

### Aplica (Categoría A) — ej. en automatización
- ajuste menor de un nodo ya existente
- corrección de un mapeo/credencial
- cambio de copy en una notificación
- optimización sin cambio de lógica ni de arquitectura

### Flujo simplificado (Categoría A)
Project Manager → n8n Workflow Engineer → Automation QA & Reliability Guard

### Límites (NO Fast Track)
Si el cambio toca **lógica de producto** (→ STATE 2, TPO), **valor de negocio** (→ STATE 3, Business Analyst) o **arquitectura** (→ STATE 4, Architect), se escala a Categoría B/C y se ejecuta el pipeline completo.

> El Fast Track NO reemplaza este protocolo. Solo define excepciones de bajo impacto. No elimina la validación de QA: Categoría A sigue requiriendo aprobación de Automation QA antes de producción.

---

# 8. PRINCIPIO DE CONTROL

Cada automatización debe tener:

- estado definido
- agente responsable claro
- transición válida
- trazabilidad completa del flujo

---

# 9. PRINCIPIO FINAL

Sin estado no hay sistema.

Sin transición válida no hay ejecución.

Sin QA no hay producción.
