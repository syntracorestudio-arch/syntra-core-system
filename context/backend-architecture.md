# SYNTRA CORE — Backend Architecture Rules

## Objetivo

La arquitectura backend de SYNTRA CORE debe ser:

* escalable
* segura
* modular
* performante
* mantenible
* desacoplada

Toda la infraestructura debe estar diseñada pensando en crecimiento futuro.

---

# Stack Oficial

Backend oficial:

* Supabase
* PostgreSQL
* Next.js API Routes
* Server Actions
* Edge Functions
* Node.js

---

# Filosofía General

El backend debe priorizar:

* simplicidad
* escalabilidad
* seguridad
* claridad
* performance
* mantenibilidad

---

# Arquitectura General

La lógica debe dividirse claramente entre:

* frontend
* backend
* servicios
* base de datos
* automatizaciones
* integraciones externas

---

# Supabase Rules

Supabase es la base oficial del ecosistema.

---

## Utilizar para

* autenticación
* base de datos
* storage
* realtime
* policies
* APIs automáticas

---

# Database Philosophy

La base de datos debe diseñarse pensando en:

* escalabilidad
* claridad
* relaciones limpias
* performance
* seguridad

---

## Evitar

* tablas innecesarias
* relaciones complejas sin necesidad
* duplicación de datos
* estructuras difíciles de mantener

---

# Security Rules

La seguridad es obligatoria.

---

## Implementar siempre

* RLS policies
* validación de inputs
* protección de APIs
* manejo seguro de secrets
* environment variables
* autenticación segura

---

## Nunca

* exponer secrets
* hardcodear claves
* confiar solamente en frontend validation

---

# API Design Rules

Las APIs deben ser:

* limpias
* consistentes
* tipadas
* seguras
* fáciles de mantener

---

# TypeScript Rules

TypeScript estricto obligatorio.

---

## Evitar

* any
* lógica ambigua
* tipos inseguros

---

# Service Layer

La lógica de negocio debe abstraerse mediante:

```txt id="v17v1z"
services/
```

Evitar lógica compleja directamente dentro de componentes UI.

---

# Validation Rules

Validar siempre:

* formularios
* payloads
* inputs
* respuestas API

Preferir Zod para validaciones.

---

# Error Handling

El sistema debe manejar errores de forma:

* elegante
* segura
* consistente

---

## Evitar

* crashes
* errores silenciosos
* mensajes inseguros
* exposición de datos internos

---

# Performance Rules

Priorizar:

* queries optimizadas
* mínimo overfetching
* caché inteligente
* edge performance
* lazy loading

---

# Authentication Rules

La autenticación debe sentirse:

* moderna
* rápida
* segura
* simple

---

## Métodos Preferidos

* GitHub OAuth
* Google OAuth
* Magic Links

---

# File Structure Philosophy

La estructura backend debe ser:

* organizada
* modular
* predecible
* desacoplada

---

# Integrations Rules

Las integraciones externas deben:

* abstraerse correctamente
* manejar retries
* validar respuestas
* registrar errores

---

# Automation Philosophy

Todo backend debe estar preparado para:

* automatizaciones
* workflows
* webhooks
* agentes IA
* integraciones API

---

# Logging Rules

Implementar logs claros para:

* errores
* requests
* workflows
* automatizaciones críticas

---

# Escalabilidad

Todo sistema debe diseñarse pensando en:

* crecimiento futuro
* reutilización
* expansión modular

---

# Filosofía Final

El backend de SYNTRA CORE debe sentirse:

* moderno
* robusto
* seguro
* inteligente
* altamente escalable

Como infraestructura real de un ecosistema AI-native.
