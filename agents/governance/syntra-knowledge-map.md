# SYNTRA KNOWLEDGE MAP — CORE SYSTEM

---

# 1. PROPÓSITO

Este documento define qué documentos, frameworks, protocolos y fuentes de verdad debe consultar cada agente dentro de SYNTRA CORE.

Su objetivo es:

* evitar referencias inconsistentes
* evitar documentos huérfanos
* evitar duplicación de conocimiento
* garantizar que todos los agentes operen sobre las mismas fuentes de verdad

Este documento NO define autoridad.

La autoridad se define exclusivamente en:

👉 ROLE-AUTHORITY-MAP — SYNTRA CORE

---

# REGLA DE MANTENIMIENTO

Este documento funciona como mapa de referencia.

No reemplaza:

- ROLE-AUTHORITY-MAP
- WEB DELIVERY PIPELINE
- SYNTRA EXECUTION PROTOCOL
- QA GOVERNANCE LAYER
- FAST TRACK PROTOCOL

El Knowledge Map no define autoridad.

No define estados.

No define aprobaciones.

No define bloqueos.

No define criterios de calidad.

Su única función es indicar qué documentos debe consultar cada agente o familia de agentes.

Ante cualquier conflicto:

- la autoridad se resuelve en ROLE-AUTHORITY-MAP
- los procesos web se resuelven en WEB DELIVERY PIPELINE
- los procesos de automatización se resuelven en SYNTRA EXECUTION PROTOCOL
- los criterios QA se resuelven en QA GOVERNANCE LAYER
- los cambios rápidos se resuelven en FAST TRACK PROTOCOL

---

# REGLA ANTI-DUPLICACIÓN

Este documento no debe copiar contenido extenso de otros documentos.

Debe evitar:

- repetir responsabilidades completas de agentes
- repetir pipelines
- repetir criterios de QA
- repetir frameworks
- repetir reglas de autoridad

Si un documento cambia, este mapa solo debe actualizarse cuando:

- aparece un nuevo documento obligatorio
- se elimina un documento existente
- cambia qué familia de agentes debe consultar un documento
- aparece un nuevo agente o familia de agentes

No debe actualizarse por cambios menores de redacción interna.

---

# 2. PRINCIPIO FUNDAMENTAL

Cada agente debe consultar únicamente los documentos necesarios para operar dentro de su dominio.

Más información no significa mejores decisiones.

Cada agente debe consumir el mínimo conocimiento necesario para ejecutar correctamente su función.

---

# 3. DOCUMENTOS FUNDACIONALES

Todos los agentes deben reconocer la existencia de:

### ROLE-AUTHORITY-MAP

Fuente única de autoridad.

Define:

* jerarquía
* escalamiento
* conflictos
* límites de responsabilidad

---

### FAST-TRACK-PROTOCOL

Define:

* categorías de ejecución rápida
* límites de bypass
* reglas de aceleración

---

### QA-GOVERNANCE-LAYER

Define:

* autoridad QA
* bloqueos
* validaciones
* conflictos entre dominios

---

---

# FAMILIAS DE AGENTES

## Business & Strategy

Incluye:

- Sales Agent
- Product Strategist
- Automation Business Analyst
- Automation Intake Analyst
- Technical Product Owner

Documentos base:

- ROLE-AUTHORITY-MAP
- SYNTRA-KNOWLEDGE-MAP
- FAST-TRACK-PROTOCOL

Según el tipo de proyecto:

- WEB DELIVERY PIPELINE
- SYNTRA EXECUTION PROTOCOL

---

## Design & Experience

Incluye:

- Creative Director
- Product Experience Designer
- UI/UX Designer
- Design System Guardian
- Website Experience Auditor

Documentos base:

- ROLE-AUTHORITY-MAP
- SYNTRA PREMIUM STANDARD
- SYNTRA WEB PLAYBOOK

Según etapa:

- WEB DELIVERY PIPELINE
- FAST-TRACK-PROTOCOL

---

## Development

Incluye:

- Frontend Engineer
- Backend Engineer
- n8n Workflow Engineer
- Automation Architect

Documentos base:

- ROLE-AUTHORITY-MAP
- WEB DELIVERY PIPELINE
- SYNTRA EXECUTION PROTOCOL
- FRONTEND DELIVERY PROTOCOL
- FAST-TRACK-PROTOCOL

Según proyecto:

- outputs del Technical Product Owner
- outputs del Product Experience Designer
- outputs del UI/UX Designer
- reglas del Design System Guardian

---

## Quality Assurance

Incluye:

- Web QA & Performance Guard
- Automation QA & Reliability Guard
- Website Experience Auditor

Documentos base:

- ROLE-AUTHORITY-MAP
- QA GOVERNANCE LAYER
- WEB DELIVERY PIPELINE
- SYNTRA EXECUTION PROTOCOL
- SYNTRA PREMIUM STANDARD

---

## Management

Incluye:

- Project Manager

Documentos base:

- ROLE-AUTHORITY-MAP
- SYNTRA-KNOWLEDGE-MAP
- WEB DELIVERY PIPELINE
- SYNTRA EXECUTION PROTOCOL
- FAST-TRACK-PROTOCOL
- QA GOVERNANCE LAYER

# 4. MAPA DE CONOCIMIENTO POR AGENTE

---

## Sales Agent

Consulta:

* ROLE-AUTHORITY-MAP

---

## Automation Intake Analyst

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA EXECUTION PROTOCOL

---

## Automation Business Analyst

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA EXECUTION PROTOCOL

---

## Product Strategist

Consulta:

* ROLE-AUTHORITY-MAP
* WEB DELIVERY PIPELINE
* SYNTRA EXECUTION PROTOCOL

---

## Technical Product Owner

Consulta:

* ROLE-AUTHORITY-MAP
* WEB DELIVERY PIPELINE
* SYNTRA EXECUTION PROTOCOL

---

## Creative Director

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA PREMIUM STANDARD

---

## Website Experience Auditor

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA PREMIUM STANDARD

---

## Product Experience Designer

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA PREMIUM STANDARD

---

## UI/UX Designer

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA PREMIUM STANDARD

Además debe respetar:

* outputs del Product Experience Designer
* reglas del Design System Guardian

---

## Design System Guardian

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA PREMIUM STANDARD

Autoridad exclusiva sobre:

* consistencia visual
* componentes
* design tokens
* patrones UI reutilizables

---

## Project Manager

Consulta:

* ROLE-AUTHORITY-MAP
* WEB DELIVERY PIPELINE
* SYNTRA EXECUTION PROTOCOL
* FAST-TRACK-PROTOCOL
* QA-GOVERNANCE-LAYER

---

## Automation Architect

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA EXECUTION PROTOCOL

---

## Frontend Engineer

Consulta:

* ROLE-AUTHORITY-MAP
* WEB DELIVERY PIPELINE

Además debe respetar:

* outputs del UI/UX Designer
* reglas del Design System Guardian
* especificaciones del Technical Product Owner

---

## Backend Engineer

Consulta:

* ROLE-AUTHORITY-MAP
* WEB DELIVERY PIPELINE

Además debe respetar:

* especificaciones del Technical Product Owner

---

## n8n Workflow Engineer

Consulta:

* ROLE-AUTHORITY-MAP
* SYNTRA EXECUTION PROTOCOL

Además debe respetar:

* outputs del Automation Architect
* especificaciones del Technical Product Owner

---

## Web QA & Performance Guard

Consulta:

* ROLE-AUTHORITY-MAP
* QA-GOVERNANCE-LAYER
* WEB DELIVERY PIPELINE
* SYNTRA PREMIUM STANDARD

---

## Automation QA & Reliability Guard

Consulta:

* ROLE-AUTHORITY-MAP
* QA-GOVERNANCE-LAYER
* SYNTRA EXECUTION PROTOCOL

---

# 5. REGLA DE INCORPORACIÓN DE DOCUMENTOS

Cuando se cree un nuevo documento de gobernanza, framework o protocolo:

1. Debe definirse su propósito.
2. Debe definirse qué agentes lo consultan.
3. Debe agregarse a este Knowledge Map.
4. Debe evitar duplicar conocimiento existente.

Si un documento no está referenciado aquí:

se considera NO integrado al sistema.

---

# 6. REGLA DE MINIMIZACIÓN DE CONTEXTO

Los agentes no deben consultar documentos innecesarios.

Objetivo:

* reducir ruido
* reducir contradicciones
* aumentar consistencia

Cada agente debe operar con el conjunto mínimo de conocimiento necesario.

---

# 7. PRINCIPIO FINAL

La calidad de un sistema no depende únicamente de sus agentes.

Depende de que todos consulten las mismas fuentes de verdad.

La autoridad vive en el ROLE-AUTHORITY-MAP.

El conocimiento vive en este documento.
