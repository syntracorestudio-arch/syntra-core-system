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

Productos web funcionando correctamente a nivel técnico, funcional, visual y operativo.

Incluye:

- frontend
- backend
- performance
- responsive
- accesibilidad básica
- integración frontend/backend
- UX funcional según especificación aprobada

Autoridad

- performance web
- errores funcionales en UI
- errores visuales de implementación
- correcto funcionamiento de la UX definida
- estabilidad de aplicaciones web
- validación de integración frontend/backend
- detección de diferencias entre implementación y especificación aprobada
- validación responsive
- validación básica de accesibilidad

Pregunta principal:

¿La web funciona como fue especificada?

Puede bloquear:

- deployment web
- release en Web Delivery Pipeline
- entregables con fallas técnicas, funcionales, visuales, responsive o de performance

No evalúa:

- memorabilidad
- diferenciación percibida
- percepción premium
- narrativa emocional
- señales de template
- impacto experiencial subjetivo

Eso corresponde al Website Experience Auditor.

🎭 3.3 Website Experience Auditor

Dominio

Experiencia percibida del producto web.

Evalúa si una web que funciona correctamente también se siente:

- premium
- clara
- memorable
- diferencial
- coherente
- confiable
- no genérica

Autoridad

- percepción premium
- diferenciación
- memorabilidad
- narrativa visual
- coherencia de experiencia
- detección de señales de template
- claridad del mensaje
- impacto del contenido
- fuerza de la propuesta percibida
- calidad narrativa entre secciones

Pregunta principal:

¿La web funciona, pero se siente débil, genérica, confusa o poco memorable?

Puede:

- aprobar experiencia
- recomendar mejoras
- devolver entregables a revisión por calidad experiencial percibida
- generar rollback de experiencia
- marcar deuda experiencial

NO puede:

- bloquear deploy por fallas técnicas
- bloquear producción por bugs funcionales
- reemplazar decisiones de QA técnico
- reemplazar al Web QA & Performance Guard
- reemplazar al Creative Director
- reemplazar al Product Experience Designer
- redefinir estrategia, producto o arquitectura

Su bloqueo o devolución aplica únicamente sobre:

- experiencia percibida
- diferenciación
- memorabilidad
- narrativa
- percepción premium
- claridad del mensaje

👉 Opera después de Web QA y antes del cierre definitivo del proyecto.

4. REGLA PRINCIPAL DE SEPARACIÓN

🚫 NO OVERLAP RULE

Cada dominio de QA valida una dimensión distinta de calidad.

---

## Automation QA & Reliability Guard

Evalúa:

- automatizaciones
- workflows n8n
- integraciones operativas
- estabilidad de procesos automatizados
- manejo de errores
- confiabilidad en producción

Pregunta principal:

¿La automatización es confiable y segura para producción?

---

## Web QA & Performance Guard

Evalúa:

- productos web
- frontend
- backend
- performance
- responsive
- accesibilidad básica
- bugs visuales
- bugs funcionales
- UX funcional según especificación aprobada

Pregunta principal:

¿La web funciona como fue especificada?

---

## Website Experience Auditor

Evalúa:

- experiencia percibida
- percepción premium
- diferenciación
- memorabilidad
- narrativa
- claridad del mensaje
- señales de template
- calidad emocional y comercial del recorrido

Pregunta principal:

¿La web funciona, pero no impacta, no diferencia o no se recuerda?

---

## Regla simple

Automation QA evalúa:

confiable / no confiable.

Web QA evalúa:

funciona / no funciona.

Website Experience Auditor evalúa:

impacta / no impacta.

---

Cada QA solo opera dentro de su dominio.

Ningún QA reemplaza la autoridad de otro.

## 4.1 FRONTERA ENTRE WEB QA Y WEBSITE EXPERIENCE AUDITOR

La frontera entre Web QA y Website Experience Auditor se define así:

Web QA valida si la web funciona correctamente.

Website Experience Auditor valida si la web se percibe premium, clara, memorable y diferencial.

---

### Web QA & Performance Guard

Foco:

técnico, funcional y operativo.

Evalúa:

- errores de frontend
- errores de backend
- bugs visuales
- responsive roto
- problemas de performance
- accesibilidad básica
- enlaces rotos
- formularios que fallan
- comportamientos incorrectos
- inconsistencias funcionales
- problemas de estabilidad
- diferencias entre implementación y especificación aprobada

Pregunta principal:

¿La web funciona como fue especificada?

Si la respuesta es no:

puede bloquear deploy.

---

### Website Experience Auditor

Foco:

experiencial, narrativo y perceptivo.

Evalúa:

- experiencia genérica
- pérdida de diferenciación
- monotonía visual
- señales de template
- narrativa débil
- falta de memorabilidad
- percepción poco premium
- contenido poco claro
- copy genérico
- secciones que no aportan valor
- recorrido que funciona técnicamente pero no convence

Pregunta principal:

¿La web funciona, pero se siente débil, genérica o poco memorable?

Si la respuesta es sí:

puede devolver a revisión por calidad experiencial percibida.

---

### Regla de separación

Web QA evalúa:

funciona / no funciona.

Website Experience Auditor evalúa:

impacta / no impacta.

Web QA bloquea por fallas técnicas, funcionales, visuales, responsive o de performance.

Website Experience Auditor bloquea o devuelve a revisión por fallas de experiencia percibida, diferenciación, narrativa o memorabilidad.

---

### Ejemplos

#### Caso 1

El formulario no envía correctamente.

Responsable:

Web QA & Performance Guard.

Motivo:

fallo funcional.

---

#### Caso 2

El formulario funciona, pero el texto no genera confianza y la sección se siente genérica.

Responsable:

Website Experience Auditor.

Motivo:

fallo de experiencia y conversión percibida.

---

#### Caso 3

Una sección se ve rota en mobile.

Responsable:

Web QA & Performance Guard.

Motivo:

fallo responsive.

---

#### Caso 4

Una sección funciona en mobile, pero no comunica valor, se siente repetitiva y no aporta al recorrido.

Responsable:

Website Experience Auditor.

Motivo:

fallo narrativo y experiencial.

---

#### Caso 5

La implementación no respeta el diseño aprobado.

Responsable:

Web QA & Performance Guard.

Motivo:

fallo de implementación contra especificación.

---

#### Caso 6

La implementación respeta el diseño aprobado, pero el diseño aprobado se siente commodity o poco memorable.

Responsable:

Website Experience Auditor.

Motivo:

fallo de percepción premium.

---

### Regla de conflicto

Si un problema puede clasificarse como técnico y experiencial al mismo tiempo:

1. Web QA valida primero si existe una falla funcional, visual, responsive o técnica.
2. Si la implementación funciona correctamente, Website Experience Auditor evalúa la calidad percibida.
3. Si ambos detectan problemas, cada uno reporta dentro de su dominio.
4. Ninguno reemplaza la autoridad del otro.

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

Web QA activo en:

STATE 7
STATE 9

👉 Gatekeeper técnico final

Website Experience Auditor activo en:

STATE 9.5

👉 Auditor final de experiencia

Puede generar:

- APPROVED
- REQUIRES IMPROVEMENT

No puede bloquear deploy ya realizado.

10. PRINCIPIO DE CONSISTENCIA GLOBAL

Ambos QA deben garantizar:

estabilidad del sistema completo
no degradación de experiencia del usuario
no ruptura de integraciones
11. PRINCIPIO FINAL

Un sistema puede tener múltiples QA, pero solo una verdad por dominio.

🎭 3.3 Website Experience Auditor

Dominio

Experiencia percibida del producto web

Autoridad

- percepción premium
- diferenciación
- memorabilidad
- narrativa visual
- coherencia de experiencia
- detección de señales de template

Puede:

- aprobar experiencia
- recomendar mejoras
- generar rollback de experiencia

NO puede:

- bloquear deploy
- bloquear producción
- reemplazar decisiones de QA técnico

👉 Opera después de Web QA y antes del cierre definitivo del proyecto.

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

La jerarquía de autoridad en conflictos es la definida en:

ROLE-AUTHORITY-MAP §4.1

Este documento NO define un orden propio.

Solo precisa cómo se ubican los dominios de QA dentro de esa jerarquía.

---

## Regla principal

Cada QA es autoridad final dentro de su dominio de calidad.

Automation QA & Reliability Guard es autoridad final sobre confiabilidad de automatizaciones.

Web QA & Performance Guard es autoridad final sobre calidad técnica, funcional, visual y operativa de productos web.

Website Experience Auditor es autoridad final sobre calidad experiencial percibida.

---

## Límites de bloqueo

Automation QA puede bloquear:

- deployment de automatizaciones
- paso a producción en Execution Protocol

Web QA puede bloquear:

- deployment web
- release en Web Delivery Pipeline
- entregables con fallas técnicas, funcionales, visuales, responsive o de performance

Website Experience Auditor puede bloquear o devolver a revisión:

- cierre definitivo de experiencia
- entregables que no alcancen estándar premium
- experiencias genéricas, débiles o poco memorables
- resultados con deuda experiencial grave

Website Experience Auditor no bloquea deploy por fallas técnicas.

Web QA no bloquea por percepción subjetiva de falta de diferenciación si la implementación cumple especificación.

---

## Conflicto entre dominios

Si existe conflicto entre dominios de QA:

1. cada QA reporta el problema dentro de su dominio
2. el Project Manager coordina resolución operativa
3. el Technical Product Owner interviene si el conflicto afecta lógica funcional
4. el Product Experience Designer interviene si afecta experiencia end-to-end
5. el Creative Director interviene si afecta dirección creativa o percepción de marca
6. el Product Strategist interviene si afecta posicionamiento, propuesta de valor o mensaje estratégico

La jerarquía final de conflicto sigue siendo la definida por ROLE-AUTHORITY-MAP.

8. REGLA DE PRODUCCIÓN

Ningún sistema puede pasar a producción si:

- Web QA & Performance Guard no aprobó los estados correspondientes del Web Delivery Pipeline.
- Automation QA & Reliability Guard no aprobó los estados correspondientes del Syntra Execution Protocol.
- Existen bloqueos técnicos, funcionales, visuales, responsive, performance o confiabilidad sin resolver.

Website Experience Auditor no reemplaza la aprobación técnica de producción.

Pero el cierre definitivo del proyecto requiere validación experiencial cuando el cambio afecte:

- percepción premium
- narrativa
- diferenciación
- memorabilidad
- claridad del mensaje
- experiencia global

Regla principal:

Producción técnica requiere QA técnico.

Cierre premium requiere validación experiencial.

9. INTEGRACIÓN CON PIPELINES

🌐 WEB DELIVERY PIPELINE

Web QA & Performance Guard actúa como gatekeeper técnico, funcional, visual y operativo según los estados definidos por el Web Delivery Pipeline.

Valida:

- funcionamiento
- performance
- responsive
- accesibilidad básica
- integración frontend/backend
- cumplimiento de especificación aprobada
- errores visuales o funcionales

Puede bloquear:

- release
- deployment web
- cierre técnico

---

Website Experience Auditor actúa como auditor final de experiencia cuando el cambio afecta percepción, narrativa, diferenciación o memorabilidad.

Valida:

- percepción premium
- diferenciación
- memorabilidad
- narrativa
- claridad del mensaje
- ausencia de patrones commodity
- calidad del recorrido desde la perspectiva del usuario

Puede generar:

- APPROVED
- REQUIRES IMPROVEMENT
- EXPERIENCE BLOCKED

No bloquea deploy por fallas técnicas.

Puede bloquear o devolver a revisión el cierre experiencial del proyecto.

---

⚙️ SYNTRA EXECUTION PROTOCOL

Automation QA & Reliability Guard actúa como gatekeeper de confiabilidad para automatizaciones según los estados definidos por el Syntra Execution Protocol.

Valida:

- workflows n8n
- manejo de errores
- confiabilidad
- estabilidad
- seguridad operativa
- integraciones

Puede bloquear:

- deployment de automatizaciones
- paso a producción en procesos de automation

10. PRINCIPIO DE CONSISTENCIA GLOBAL

Todos los dominios de QA deben proteger la calidad del sistema desde su especialidad.

Automation QA protege confiabilidad operativa.

Web QA protege funcionamiento técnico, visual y funcional.

Website Experience Auditor protege percepción premium, diferenciación y memorabilidad.

En conjunto deben garantizar:

- estabilidad del sistema completo
- no ruptura de integraciones
- no degradación funcional
- no degradación experiencial
- no pérdida de percepción premium

11. PRINCIPIO FINAL

Un sistema puede tener múltiples dominios de QA, pero solo una verdad por dominio.

Web QA responde:

¿Funciona correctamente?

Automation QA responde:

¿Es confiable?

Website Experience Auditor responde:

¿Se siente premium, claro, diferencial y memorable?

La calidad se valida por dominios separados.

La producción se protege con QA técnico.

La percepción premium se protege con auditoría experiencial.