# FAST TRACK PROTOCOL — SYNTRA CORE

## 1. PROPÓSITO

Este protocolo existe para evitar burocracia innecesaria.

No todos los cambios requieren el pipeline completo del sistema.

Este documento define qué tipo de cambios pueden utilizar un flujo simplificado y cuáles requieren el proceso completo de gobernanza.

---

## 2. PRINCIPIO FUNDAMENTAL

La profundidad del proceso debe ser proporcional al impacto de la decisión.

Cambios pequeños no deben activar revisiones estratégicas.

Cambios estratégicos no deben saltarse validaciones críticas.

---

## 2.1 RELACIÓN CON TIERS DE AUTORIDAD

Este protocolo utiliza los tiers definidos en:

👉 ROLE-AUTHORITY-MAP

Los tiers no son pasos obligatorios.

Son dominios de decisión.

Un cambio debe activar únicamente:

* el tier afectado
* los agentes necesarios
* la validación mínima suficiente
* el QA correspondiente

No todo cambio requiere activar todo el sistema SYNTRA CORE.

Escalar innecesariamente un cambio simple es considerado deuda operativa.

---

### TIER 1 — Negocio, estrategia y valor

Activar solo si el cambio afecta:

* posicionamiento
* propuesta de valor
* narrativa comercial
* claims estratégicos
* oferta
* modelo de negocio
* prioridad estratégica
* enfoque SEO conceptual
* intención de búsqueda estratégica

Si no afecta estrategia, no escalar a Tier 1.

---

### TIER 2 — Producto, lógica y experiencia

Activar solo si el cambio afecta:

* comportamiento funcional
* arquitectura de información
* estructura funcional de contenido
* experiencia end-to-end
* narrativa de experiencia
* recorrido del usuario
* dirección creativa
* percepción de marca

Si no afecta producto, lógica ni experiencia, no escalar a Tier 2.

---

### TIER 3 — Diseño, arquitectura e implementación

Activar si el cambio afecta:

* interfaz visual
* componentes
* layout
* design system
* frontend
* backend
* workflows
* arquitectura técnica
* implementación

Este es el tier más frecuente para cambios operativos.

---

### TIER 4 — QA, validación y control final

Activar cuando el cambio requiere:

* validación técnica
* validación visual
* validación de experiencia
* validación de performance
* validación de automatización
* aprobación antes de producción

Todo cambio implementado debe tener validación proporcional a su riesgo.

---

## 3. CLASIFICACIÓN DE CAMBIOS

Todos los cambios deben clasificarse en una de las siguientes categorías.

---

## 3.1 CRITERIO BINARIO DE CLASIFICACIÓN

Antes de clasificar un cambio, responder las siguientes preguntas en orden.

Si la respuesta es SÍ a cualquiera de estas preguntas:

el cambio NO puede ser Categoría A.

Debe escalar como Categoría B o Categoría C según corresponda.

---

### Pregunta 1 — ¿Cambia el significado?

¿El cambio modifica lo que la web, producto o sección comunica?

Ejemplos:

- cambia propuesta de valor
- cambia claim principal
- cambia promesa comercial
- cambia posicionamiento
- cambia narrativa comercial
- cambia intención SEO estratégica

Si SÍ:

Categoría C — Strategic Track.

---

### Pregunta 2 — ¿Cambia la experiencia?

¿El cambio modifica cómo el usuario vive, entiende o recorre la experiencia?

Ejemplos:

- cambia el recorrido del usuario
- cambia la narrativa del scroll
- cambia la jerarquía de una sección clave
- agrega o elimina una sección importante
- cambia una interacción principal
- cambia el Hero
- cambia un momento diferencial

Si SÍ:

Categoría B — Experience Track.

---

### Pregunta 3 — ¿Cambia el comportamiento funcional?

¿El cambio modifica cómo funciona el producto, flujo, formulario, navegación o sistema?

Ejemplos:

- nuevo comportamiento
- nueva lógica
- nuevo estado funcional
- cambio de navegación
- cambio en formularios
- cambio en arquitectura de información
- cambio en integración

Si SÍ:

Categoría B o pipeline completo según impacto.

Debe intervenir Technical Product Owner.

---

### Pregunta 4 — ¿Cambia el sistema visual?

¿El cambio modifica tokens, componentes reutilizables, patrón visual global o consistencia del Design System?

Ejemplos:

- nuevo componente base
- cambio de tokens
- cambio de escala tipográfica
- cambio de sistema de spacing
- cambio de patrón reutilizable
- cambio visual que afecta varias secciones

Si SÍ:

Categoría B.

Debe intervenir Design System Guardian.

---

### Pregunta 5 — ¿Solo corrige o refina algo existente?

¿El cambio mantiene exactamente el mismo significado, experiencia, comportamiento y sistema visual?

Ejemplos:

- corregir spacing
- ajustar responsive menor
- arreglar hover
- corregir typo
- mejorar microcopy sin alterar significado
- corregir bug visual
- optimizar performance sin cambiar experiencia
- ajustar alineación
- corregir contraste dentro de tokens existentes

Si SÍ:

Categoría A — Fast Track.

---

## Regla final

Categoría A solo aplica cuando el cambio:

- no cambia significado
- no cambia experiencia
- no cambia comportamiento funcional
- no cambia sistema visual global
- no cambia posicionamiento
- no cambia propuesta de valor
- no cambia claims estratégicos
- no cambia arquitectura de información
- no cambia narrativa principal

Categoría A corrige o refina.

Categoría B rediseña o modifica experiencia.

Categoría C redefine estrategia, mensaje u oferta.

---

# CATEGORÍA A — FAST TRACK

## Definición

Cambios de bajo impacto que corrigen, ajustan o refinan una implementación existente.

Categoría A solo aplica cuando el cambio NO modifica:

* significado estratégico
* propuesta de valor
* claims principales
* posicionamiento
* narrativa comercial
* experiencia global
* recorrido del usuario
* arquitectura de información
* comportamiento funcional
* sistema visual global
* componentes base
* arquitectura técnica

Solo puede usarse Categoría A cuando el cambio mantiene intacto:

* qué se comunica
* cómo se vive la experiencia
* cómo funciona el sistema
* cómo se organiza el contenido
* cómo se percibe la marca

---

## Ejemplos

### UI

* spacing
* padding
* margin
* alineaciones
* responsive fixes
* iconos
* estados hover
* estados active
* animaciones menores
* microinteracciones

### Frontend

* bugs visuales
* accesibilidad
* performance menor
* optimizaciones

### Contenido

* errores tipográficos
* correcciones gramaticales
* ajustes menores de claridad
* microcopy que no altera significado
* mejoras de lectura sin cambiar posicionamiento
* cambios de texto que no modifican claims estratégicos

No aplica Categoría A si el cambio modifica:

* propuesta de valor
* claim principal
* narrativa comercial
* promesa de negocio
* posicionamiento
* enfoque SEO conceptual

En esos casos debe escalarse a Categoría C.

---

## Pipeline

Project Manager

↓

Agente afectado según dominio:

* UI/UX Designer si afecta interfaz visual
* Design System Guardian si afecta tokens, componentes o consistencia visual
* Frontend Engineer si afecta implementación frontend
* Backend Engineer si afecta implementación backend
* Technical Product Owner si afecta estructura funcional menor de contenido

↓

QA proporcional:

* Web QA & Performance Guard si afecta web
* Automation QA & Reliability Guard si afecta automatizaciones

---

## Agentes NO requeridos por defecto

* Product Strategist
* Creative Director
* Product Experience Designer
* Website Experience Auditor

Design System Guardian solo interviene si el cambio afecta:

* tokens
* componentes
* patrones reutilizables
* consistencia visual global

Technical Product Owner solo interviene si el cambio afecta:

* estructura funcional de contenido
* navegación
* arquitectura de información
* comportamiento funcional

---

## Regla

Si existe duda sobre la categoría:

escalar a Categoría B.

---

# CATEGORÍA B — EXPERIENCE TRACK

## Definición

Cambios que modifican la experiencia.

No alteran la estrategia del producto.

No alteran el posicionamiento.

Pero sí afectan:

* experiencia
* recorrido
* narrativa
* interacción

No debe escalar a Categoría C si el cambio no modifica:

* posicionamiento
* propuesta de valor
* oferta
* narrativa comercial principal
* claims estratégicos
* enfoque SEO conceptual

Un cambio puede afectar experiencia sin afectar estrategia.

---

## Criterio de entrada

Un cambio entra en Categoría B cuando modifica la experiencia, pero no redefine la estrategia.

Categoría B aplica si el cambio afecta:

* recorrido del usuario
* narrativa del scroll
* jerarquía de una sección clave
* interacción principal
* estructura de una sección
* percepción premium
* memorabilidad
* arquitectura de información
* presentación de contenido relevante
* sistema visual de una sección importante

Pero NO cambia:

* propuesta de valor
* posicionamiento
* oferta comercial
* claim principal
* narrativa comercial estratégica
* enfoque SEO conceptual

Si cambia alguno de esos puntos, debe escalarse a Categoría C.

---

## Ejemplos

* nueva sección
* rediseño de sección
* cambios de Hero
* nuevas animaciones relevantes
* cambios de flujo de navegación
* cambios de jerarquía visual
* nuevas experiencias interactivas

---

## Pipeline

Creative Director

↓

Product Experience Designer

↓

UI/UX Designer

↓

Design System Guardian

↓

Frontend Engineer

↓

Web QA

↓

Website Experience Auditor

---

## Objetivo

Garantizar que la experiencia siga siendo:

* premium
* diferenciada
* consistente

---

# CATEGORÍA C — STRATEGIC TRACK

## Definición

Cambios que alteran:

* visión
* propuesta de valor
* dirección del producto
* posicionamiento
* oferta comercial
* narrativa comercial principal
* mensaje estratégico
* claims principales
* enfoque SEO conceptual
* intención de búsqueda estratégica
* mercado objetivo

---

## Criterio de entrada

Un cambio entra en Categoría C cuando redefine estrategia, mensaje u oferta.

Categoría C aplica si el cambio afecta:

* qué vende SYNTRA
* para quién es
* por qué debería importarle al cliente
* qué promesa comercial sostiene
* qué propuesta de valor comunica
* qué posicionamiento ocupa
* qué claim principal utiliza
* qué narrativa comercial construye
* qué intención SEO estratégica busca capturar
* qué mercado objetivo prioriza

Si cambia el significado estratégico:

no puede ser Categoría A ni Categoría B.

---

## Ejemplos

* nuevo producto
* nueva línea de negocio
* cambio de posicionamiento
* nuevo mercado objetivo
* nueva propuesta de valor
* redefinición de servicios

---

## Pipeline

Product Strategist

↓

Creative Director

↓

Product Experience Designer

↓

UI/UX Designer

↓

Design System Guardian

↓

Project Manager

↓

Implementation Team

↓

QA

↓

Website Experience Auditor

---

## Objetivo

Proteger la coherencia estratégica del sistema.

---

## 4. REGLA DE ESCALAMIENTO

Un agente puede solicitar escalar un cambio:

Categoría A → Categoría B

o

Categoría B → Categoría C

si detecta impacto mayor al inicialmente estimado.

Debe justificar el motivo.

---

## 4.1 REGLA DE NO ESCALAMIENTO

Un cambio NO debe escalarse a un nivel superior si:

* no modifica su dominio de autoridad
* no cambia una decisión previamente aprobada por ese nivel
* no introduce ambigüedad estratégica, funcional o experiencial
* no aumenta riesgo de producción
* no afecta percepción premium de forma significativa
* no cambia propuesta de valor, claims ni posicionamiento

Escalar innecesariamente es deuda operativa.

El Project Manager debe proteger la velocidad del sistema evitando activar agentes que no aportan decisión real.

---

## 5. REGLA DE BLOQUEO

Ningún agente puede utilizar este protocolo para evitar validaciones obligatorias.

El Fast Track simplifica el flujo.

No elimina responsabilidades.

---

## 6. RELACIÓN CON ROLE AUTHORITY MAP

Este protocolo NO reemplaza el ROLE AUTHORITY MAP.

El ROLE AUTHORITY MAP continúa siendo la fuente única de autoridad.

Este documento solo determina qué nivel de proceso requiere cada tipo de cambio.

---

## 6.1 RELACIÓN CON WEB DELIVERY PIPELINE

Este protocolo no reemplaza el WEB DELIVERY PIPELINE.

El WEB DELIVERY PIPELINE sigue siendo la fuente oficial para proyectos web completos.

FAST TRACK PROTOCOL define cuándo un cambio puede usar un flujo reducido.

Ante conflicto:

WEB DELIVERY PIPELINE prevalece para proyectos web completos.

FAST TRACK PROTOCOL prevalece para clasificación de cambios menores o intermedios.

---

## 7. RESULTADO ESPERADO

Con este protocolo:

* los cambios menores avanzan más rápido
* se reduce la burocracia operativa
* se mantienen las validaciones críticas
* los agentes intervienen solo cuando aportan valor
* la velocidad aumenta sin perder calidad

---

## 8. FORMATO DE DECISIÓN FAST TRACK

Cada vez que se evalúe un cambio, responder:

### Tipo de cambio

[Categoría A / Categoría B / Categoría C]

### Descripción del cambio

[...]

### Tiers afectados

* Tier X
* Tier Y

### Agentes activos

* ...

### Agentes no activados

* ...

### Motivo de no escalamiento

[Explicar por qué no se activa un tier superior]

### Validación requerida

* Web QA
* Automation QA
* Website Experience Auditor
* Design System Guardian
* Otro

### Estado

FAST TRACK APROBADO  
ESCALAR A EXPERIENCE TRACK  
ESCALAR A STRATEGIC TRACK  
BLOQUEADO

---

## PRINCIPIO FINAL

La gobernanza debe proteger la calidad.

Nunca convertirse en una fuente de fricción innecesaria.
