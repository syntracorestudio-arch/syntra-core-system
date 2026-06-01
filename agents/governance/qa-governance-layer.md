SYNTRA QA GOVERNANCE LAYER v1 — CORE SYSTEM
1. PROPÓSITO DEL DOCUMENTO

Este documento define la gobernanza unificada de calidad dentro de SYNTRA CORE.

Su objetivo es eliminar conflictos entre dominios de QA y establecer reglas claras de validación, bloqueo y escalamiento.

2. PRINCIPIO FUNDAMENTAL

La calidad no es un rol aislado. Es un sistema de validación distribuido por dominio con reglas de conflicto jerárquicas.

3. DOMINIOS DE QA
🧪 3.1 Automation QA & Reliability Guard
Dominio

Automatizaciones (n8n workflows)

Autoridad
Validación de workflows
Integración entre sistemas
Seguridad operativa de automatizaciones
Estabilidad de procesos automatizados
Puede bloquear:
deployment de automatizaciones
paso a producción en Execution Protocol
🧪 3.2 Web QA & Performance Guard
Dominio

Productos web (frontend + backend + UX funcional)

Autoridad
performance web
errores funcionales en UI
consistencia de UX en producción
estabilidad de aplicaciones web
validación de integración frontend/backend
Puede bloquear:
deployment web
release en Web Delivery Pipeline
4. REGLA PRINCIPAL DE SEPARACIÓN
🚫 NO OVERLAP RULE
Automation QA NO puede evaluar productos web
Web QA NO puede evaluar workflows de automatización

👉 Cada QA solo opera dentro de su dominio

5. REGLA DE CONFLICTO ENTRE QAs

Cuando existe discrepancia entre dominios:

CASO 1 — Sin impacto cruzado

👉 cada QA decide en su dominio
👉 no hay bloqueo global

CASO 2 — Impacto cruzado (CRÍTICO)

Ejemplo:

Web depende de API fallando
Automation workflow impacta sistema web

👉 entonces se activa ESCALAMIENTO

6. ESCALAMIENTO OBLIGATORIO

Si hay conflicto entre QA:

Se deriva a:
🟣 Technical Product Owner (TPO)
→ define si el problema es lógico o funcional
🏗 Automation Architect
→ si es problema estructural de integración
📋 Project Manager
→ si es problema de coordinación o timing
7. JERARQUÍA DE BLOQUEO

La jerarquía de autoridad en conflictos es la definida en
ROLE-AUTHORITY-MAP §4.1 (fuente única). Este documento NO define un
orden propio: solo precisa cómo se ubica QA dentro de esa jerarquía.

Orden vigente (ROLE-AUTHORITY-MAP §4.1):
Sales Agent → Automation Intake Analyst → Technical Product Owner →
Automation Business Analyst → Product Strategist → Project Manager →
Automation Architect → QA (Web / Automation) → Engineers

Precisión de dominio para QA:
- Dentro de su dominio, cada QA (Web / Automation) es autoridad final
  de calidad y puede bloquear el paso a producción (ver §8).
- Ante conflicto entre dominios o con otra capa, aplica el orden de
  ROLE-AUTHORITY-MAP §4.1 y el escalamiento de §6 de este documento.
8. REGLA DE PRODUCCIÓN

Ningún sistema puede pasar a producción si:

Web QA no aprobó STATE 7 o STATE 9 (web)
Automation QA no aprobó STATE 5 o STATE 7 (automation)
9. INTEGRACIÓN CON PIPELINES
🌐 WEB DELIVERY PIPELINE
QA activo en:
STATE 7
STATE 9

👉 Web QA es gatekeeper final

⚙️ AUTOMATION EXECUTION PROTOCOL
QA activo en:
STATE 5
STATE 7

👉 Automation QA es gatekeeper final

10. PRINCIPIO DE CONSISTENCIA GLOBAL

Ambos QA deben garantizar:

estabilidad del sistema completo
no degradación de experiencia del usuario
no ruptura de integraciones
11. PRINCIPIO FINAL

Un sistema puede tener múltiples QA, pero solo una verdad por dominio.