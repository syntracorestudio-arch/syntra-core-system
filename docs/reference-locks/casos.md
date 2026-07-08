---
section: casos
status: approved
approved_by: "Matias / SYNTRA CORE (owner)"
date: 2026-07-08
decision: code-first (prototipo vivo juzgado en navegador — workflow variantes vivas)
supersedes: "Casos v1 'Campo de señales' (2026-06-26)"
---

# Reference Lock — Casos v2 ("Ejemplos — demos vivas de servicio")

> **Documentación POST-aprobación** (design-freedom-v2 §4): el owner aprobó el
> prototipo VIVO en su navegador el 2026-07-08 tras ~6 rondas de iteración en vivo.
> Este lock registra lo aprobado; no fue gate previo.

## Qué es la sección ahora

- Nav: **"Ejemplos"** (`#casos`). Heading: eyebrow "Qué construimos" · título
  **"Lo que construimos, funcionando"**.
- Se eliminó el eje por rubro (inmobiliaria/legal/salud) — la audiencia es
  **cualquier negocio** (reforma V2). En su lugar: **4 demos vivas de servicio**
  en orden de pipeline: **Landing → Asistente IA → Automatización → Panel**.
- Hilo narrativo ficticio que cruza las 4 demos: **"Julián P." compra una campera
  azul talle M en "Tienda Moda"** (local de ropa genérico). La consulta de la
  landing es el pedido del chat, se registra en la automatización y aparece en el
  panel.
- Nota de honestidad invertida a fortaleza (dogfooding aprobado): "los sistemas
  son reales… las consultas de esta web se registran con un sistema como este".

## Decisiones de diseño aprobadas (vinculantes para iteraciones futuras)

1. **Interiores = apps REALES, no cards azules SYNTRA.** Cada demo reproduce la
   app de verdad con su propia paleta: WhatsApp dark oficial (#0b141a/#005c4b/
   #00a884), sitio del cliente en tema claro con marca propia (ámbar #d97706),
   planilla estilo Sheets (verde #188038), mail estilo Gmail (rojo #EA4335),
   panel SaaS claro (estados ámbar/azul/verde). El chrome (navegador/teléfono/
   frame) + halo exterior = única capa de presentación SYNTRA.
2. **Regla permanente de marca: SIN violeta (#6d5dfb) y SIN cyan (#38bdf8)**
   (estética "hecho con IA"). Éxito/HECHO → **warm dorado**. Acentos de demo:
   electric #2563eb / warm / #60a5fa.
3. **Chip HECHO siempre FUERA del frame** (dentro rompería el realismo).
4. **Fotos realistas** (Pollinations MCP): `public/demo-assets/tienda-hero.jpg`
   (interior boutique) + `producto-campera.jpg` (campera denim).
5. **Aviso de automatización = MAIL, no WhatsApp** (decisión owner 2026-07-08:
   mail es lo simple de programar — Gmail/SMTP directo vs Meta Business API; la
   demo muestra solo lo realista de implementar fácil).
6. **Chat compacto con conversación que fluye** (opción B aprobada): teléfono
   proporcionado, hilo `flex-col-reverse` (solo CSS) — los mensajes viejos salen
   por arriba y el frame final muestra el cierre de la venta (reserva + link de
   pago). Guion de 6 mensajes con foto+caption en burbuja.
7. **Flujo de automatización con artefactos reales, no genéricos**: formulario
   web con campos → fila que se escribe en la planilla → notificación de mail al
   equipo, unidos por línea de pipeline con pulso.
8. **Content-driven**: todo el copy vive en `site.ts` (`serviceDemos`,
   `serviceDemoScenes`); motor compartido `useDemoLoop` (IntersectionObserver
   pausa fuera de viewport; reduced-motion → estado final estático).
9. **CasosBackdrop (campo vivo v1) se conserva** como fondo de la sección.

## Archivos

- `src/components/marketing/aplicaciones/demos/` — `use-demo-loop.ts`,
  `demo-shared.tsx`, `demo-landing.tsx`, `demo-chat.tsx`, `demo-automation.tsx`,
  `demo-dashboard.tsx`, `service-demo-selector.tsx`.
- `src/components/sections/use-cases-section.tsx` (Server Component).
- Eliminados: `application-selector.tsx`, `use-case-chat-scene.tsx` (v1).

## Criterios binarios (verificados en la aprobación)

- [x] Las 4 demos parecen apps reales (paletas oficiales), no cards SYNTRA.
- [x] Cero violeta y cero cyan en toda la sección; HECHO en warm dorado.
- [x] Hilo "Julián P. / Tienda Moda" consistente en las 4 demos.
- [x] Nada se corta al final de las animaciones (chat fluye; landing scrollea a
      límite limpio; automatización y panel completos).
- [x] Loops pausan fuera de viewport · reduced-motion → estado final.
- [x] `tsc` · `lint` verdes · 0 errores de consola · verificado en loop visual
      (Playwright MCP) a 1920.

## Anti-loop

Máx. 2 iteraciones de código sobre una demo; a la 3ª, volver a este lock.
