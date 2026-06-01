# SYNTRA CORE — Frontend Architecture Rules

## Objetivo

La arquitectura frontend de SYNTRA CORE debe ser:

* modular
* escalable
* mantenible
* reutilizable
* organizada
* performante

El código debe sentirse como un producto SaaS moderno de alta calidad.

---

# Stack Oficial

Frontend oficial:

* Next.js App Router
* React
* TypeScript
* TailwindCSS
* shadcn/ui
* Framer Motion

---

# Filosofía General

Todo debe construirse pensando en:

* reutilización
* claridad
* separación de responsabilidades
* escalabilidad futura
* performance
* experiencia premium

---

# Reglas de Componentización

## Componentes pequeños

Preferir componentes:

* pequeños
* reutilizables
* desacoplados
* fáciles de mantener

---

## Evitar

* componentes gigantes
* lógica mezclada
* archivos excesivamente largos
* duplicación de código

---

# Estructura Recomendada

## App Router

Utilizar estructura moderna de Next.js App Router.

---

## Organización sugerida

```txt
src/
 ├── app/
 ├── components/
 │    ├── ui/
 │    ├── layout/
 │    ├── sections/
 │    ├── shared/
 │    └── animations/
 ├── lib/
 ├── hooks/
 ├── services/
 ├── styles/
 ├── types/
 └── utils/
```

---

# Reglas de Naming

## Componentes

Usar PascalCase.

Ejemplo:

```txt
HeroSection.tsx
FeatureCard.tsx
AnimatedGrid.tsx
```

---

## Hooks

Usar prefijo:

```txt
useSomething
```

Ejemplo:

```txt
useScrollAnimation
useMousePosition
```

---

## Utils

Nombres descriptivos y específicos.

---

# Reglas de Tailwind

## Priorizar

* utility classes limpias
* consistencia
* composición clara
* reutilización

---

## Evitar

* classnames gigantes
* estilos desordenados
* duplicación excesiva

---

# Reglas de UI

Toda la interfaz debe seguir:

* dark mode first
* spacing amplio
* jerarquía visual clara
* consistencia visual
* estética premium

---

# Framer Motion

Framer Motion debe utilizarse para:

* reveal animations
* hover states
* section transitions
* motion premium
* microinteractions

Evitar complejidad innecesaria.

---

# Performance Rules

El frontend debe priorizar:

* Lighthouse +95
* carga rápida
* mínimo layout shift
* optimización de imágenes
* renderizado eficiente

---

# SEO Rules

Todo proyecto debe incluir:

* metadata optimizada
* semantic HTML
* estructura accesible
* performance SEO-friendly

---

# Accessibility Rules

Cumplir estándares modernos:

* contraste correcto
* navegación accesible
* semantic tags
* keyboard accessibility

---

# Responsive Rules

Mobile-first obligatorio.

La experiencia debe sentirse premium en:

* desktop
* tablet
* mobile

---

# Código Limpio

Todo el código debe ser:

* legible
* organizado
* documentado cuando sea necesario
* consistente

---

# Evitar

* hacks rápidos
* lógica innecesaria
* duplicación
* estilos inconsistentes
* componentes acoplados

---

# Filosofía Final

El frontend de SYNTRA CORE debe sentirse:

* moderno
* altamente diseñado
* premium
* escalable
* tecnológico
* performante

Como un producto SaaS de primer nivel.
