# SYNTRA EXECUTION PROTOCOL — CORE LIFECYCLE SYSTEM

---

# 1. PROPÓSITO DEL DOCUMENTO

Este documento define el ciclo de vida completo de una automatización dentro de SYNTRA CORE, desde la entrada del cliente hasta su despliegue en producción.

Establece:

- estados del sistema (pipeline states)
- transiciones entre agentes
- reglas de avance y bloqueo
- puntos de validación obligatorios

---

# 2. SISTEMA DE GOBERNANZA (OBLIGATORIO)

Este protocolo opera bajo:

👉 ROLE-AUTHORITY-MAP — SYNTRA CORE

Este es el ÚNICO sistema de autoridad válido.

❌ Cualquier referencia a sistemas previos queda completamente invalidada.

---

# 3. PRINCIPIO FUNDAMENTAL

Toda automatización en SYNTRA CORE es un:

> 🔄 sistema con ciclo de vida controlado por estados

No es una tarea.
No es un proyecto aislado.

Es un flujo estructurado con transición de estados determinística.

---

# 4. PIPELINE STATES (ESTADOS DEL SISTEMA)

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
- requerimiento estructurado inicial

### Transición a:
👉 STATE 1

---

## 🟠 STATE 1 — STRUCTURED REQUIREMENT

### Descripción
El requerimiento fue descompuesto en proceso lógico.

### Agente responsable
Automation Intake Analyst

### Estado del sistema
- triggers identificados
- acciones definidas
- sistemas detectados

### Output esperado
- caso listo para análisis de valor y arquitectura

### Transición a:
👉 STATE 2

---

## 🔵 STATE 2 — ARCHITECTURE DESIGN

### Descripción
Se diseña la arquitectura del sistema de automatización.

### Agente responsable
Automation Architect

### Estado del sistema
- flujo definido
- nodos conceptuales
- integraciones identificadas

### Output esperado
- arquitectura completa del workflow

### Transición a:
👉 STATE 3

---

## 🟣 STATE 3 — IMPLEMENTATION READY

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
👉 STATE 4

---

## 🔴 STATE 4 — IMPLEMENTATION IN PROGRESS

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
👉 STATE 5

---

## 🟢 STATE 5 — QA VALIDATION

### Descripción
Se valida el workflow antes de producción.

### Agente responsable
Automation QA & Reliability Guard

### Estado del sistema
- simulación de ejecución
- validación de edge cases
- testing de integraciones

### Output esperado
- aprobado o rechazado

### Transición a:
👉 STATE 6 o rollback a STATE 3 / 4

---

## ⚫ STATE 6 — PRODUCTION DEPLOYED

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
👉 STATE 7

---

## 🟢 STATE 7 — PRODUCTION VERIFIED

### Descripción
El workflow fue validado en producción.

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

---

## 5.1 Regla de avance obligatorio

No se puede avanzar de estado si:

- el agente actual no aprobó el output
- existe ambigüedad sin resolver
- falta validación del estado anterior

---

## 5.2 Regla de rollback

Se puede retroceder si:

- QA detecta fallos
- arquitectura es inconsistente
- intake estaba incompleto

---

## 5.3 Regla de bloqueo absoluto

El sistema se bloquea si:

- no existe claridad del estado actual
- falta agente responsable definido
- hay inconsistencias en el flujo

---

# 6. RESPONSABILIDAD POR ESTADO

| Estado | Agente Responsable |
|--------|------------------|
| 0 | Automation Intake Analyst |
| 1 | Automation Intake Analyst |
| 2 | Automation Architect |
| 3 | n8n Workflow Engineer |
| 4 | n8n Workflow Engineer |
| 5 | Automation QA & Reliability Guard |
| 6 | n8n Workflow Engineer |
| 7 | Automation QA & Reliability Guard |

---

# 7. PRINCIPIO DE CONTROL

Cada automatización debe tener:

- estado definido
- agente responsable claro
- transición válida
- trazabilidad completa del flujo

---

# 8. PRINCIPIO FINAL

Sin estado no hay sistema.

Sin transición válida no hay ejecución.

Sin QA no hay producción.