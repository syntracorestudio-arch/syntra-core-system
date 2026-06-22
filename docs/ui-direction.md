# SYNTRA CORE — UI Direction

> **Nota (vinculante).** Este documento es **dirección visual general**. Para cada
> sección, **los reference-locks aprobados** (`docs/reference-locks/<section>.md`,
> `status: approved`) y los **tokens de `globals.css`** son la fuente de verdad y
> **prevalecen** sobre cualquier descripción genérica de acá. Lo descartado (visual
> reset / hero 3D-R3F / glassmorphism como dirección de marca) **no** se reintroduce.

## Objetivo

La interfaz de SYNTRA CORE debe sentirse como:

- una software factory moderna,
- un estudio AI-native premium,
- y una empresa tecnológica de alto nivel.

La experiencia visual debe transmitir:

- sofisticación,
- precisión,
- modernidad,
- velocidad,
- minimalismo,
- y tecnología avanzada.

---

# Filosofía Visual

La web debe sentirse:

- limpia,
- elegante,
- futurista,
- modular,
- y premium.

Nunca debe verse:

- genérica,
- recargada,
- corporativa antigua,
- o similar a templates baratos.

---

# Inspiración Visual

Referencias principales:

- Linear
- Vercel
- Raycast
- Stripe
- Framer
- Resend
- Supabase

---

# Estilo General

## Dark Mode First

La experiencia principal debe estar diseñada sobre fondo oscuro.

Paleta dominante:

- #0F172A
- #0B3D91
- #2563EB
- #38BDF8
- #F8FAFC

---

# Layout Philosophy

## Secciones Amplias

Las secciones deben respirar visualmente.

Usar:

- padding generoso,
- spacing amplio,
- grids limpios,
- contenido bien separado.

---

## Max Width

Usar containers controlados.

Evitar:

- contenido excesivamente ancho,
- bloques gigantes,
- layouts desordenados.

---

## Grid System

Preferencia:

- 12-column grid
- layouts modulares
- estructura consistente

---

# Hero Section

> **Estado actual (vinculante): el Hero es image-first.** Implementado contra el
> asset aprobado en `docs/reference-locks/hero.md` (`hero-stratos.webp`) + 2.5D hover,
> ya mergeado y en producción (Home V1 FROZEN). Lo de abajo es la intención original;
> el reference-lock manda. No reinventar un protagonista visual desde código.

La hero section debe transmitir impacto inmediato.

Debe incluir:

- headline fuerte,
- subtítulo claro,
- CTA principal,
- CTA secundario,
- el asset protagonista aprobado (image-first; el código compone y anima, no reinventa),
- motion elegante y sobrio.

---

# Motion Design

## Filosofía

Las animaciones deben sentirse:

- suaves,
- premium,
- modernas,
- inteligentes.

Nunca exageradas.

---

## Permitido

- fade-in
- blur reveal
- smooth hover
- subtle parallax
- stagger animations
- gradient motion
- soft glow transitions

---

## Prohibido

- bounce agresivo
- animaciones caricaturescas
- exceso de partículas
- efectos distractivos

---

# Glassmorphism

Usar de forma moderada.

Características:

- blur suave
- transparencias ligeras
- bordes delicados
- overlays premium

Nunca exagerar.

---

# Tipografía

## Headings

Sora

Características:

- tecnológica,
- premium,
- limpia.

---

## Body

Inter

Características:

- legible,
- moderna,
- clara.

---

# Espaciado

Preferencia por:

- spacing amplio,
- jerarquía clara,
- secciones aireadas.

Evitar interfaces comprimidas.

---

# Componentes

## Cards

Deben sentirse:

- premium,
- modernas,
- suaves,
- tecnológicas.

Usar:

- borders sutiles,
- sombras suaves,
- glow ligero,
- rounded-2xl.

---

## Buttons

Los botones deben verse:

- modernos,
- sólidos,
- tecnológicos.

Características:

- hover elegante,
- transiciones suaves,
- buen contraste,
- padding cómodo.

---

## Navbar

Debe ser:

- minimalista,
- limpia,
- sticky,
- elegante.

Puede incluir:

- blur background,
- transparencia ligera,
- transición suave al scroll.

---

# Secciones Recomendadas

## Home

- Hero
- Servicios
- Automatizaciones
- Beneficios
- Stack
- Workflow
- Casos de uso
- CTA final

---

# Visual Language

La web debe sentirse como:

“infraestructura digital moderna impulsada por inteligencia artificial.”

---

# UX Rules

## Mobile First

La experiencia móvil es prioridad absoluta.

---

## Escaneabilidad

El usuario debe entender rápidamente:

- qué hace SYNTRA,
- qué ofrece,
- y por qué es diferente.

---

## Claridad

Evitar exceso de texto.

Usar:

- bloques claros,
- jerarquía fuerte,
- CTAs visibles,
- contenido escaneable.

---

# SEO Visual

La estructura visual debe favorecer:

- lectura rápida,
- jerarquía semántica,
- claridad,
- y accesibilidad.

---

# Performance

Toda interfaz debe priorizar:

- velocidad,
- optimización,
- y fluidez.

Objetivo mínimo:

- Lighthouse +95
- excelente experiencia mobile.

---

# Stack UI Obligatorio

- Next.js
- TailwindCSS
- Framer Motion
- shadcn/ui

---

# Regla Final

Toda interfaz creada para SYNTRA CORE debe sentirse como:

“un producto premium desarrollado por una software factory AI-native de nueva generación.”