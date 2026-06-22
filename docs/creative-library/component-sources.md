# SYNTRA Creative Library — Component Sources by Use

> Qué fuente consultar **primero** según la categoría. Consultivo, no autoridad:
> todo se adapta a tokens SYNTRA y se subordina al design system, al VQD, al DSG y a
> las skills (ver reglas de autoridad en `inspiration-sources.md`).
>
> Fuentes núcleo: **Magic UI** (escenas/device/listas/beam) y **Animate UI**
> (microinteracciones/notificaciones). Resto = ideas adaptadas.

| Categoría | Consultar primero | Alternativa | Notas de adaptación |
| --- | --- | --- | --- |
| **Hero** | Magic UI (device mockup) | Aceternity (container/3D card) | Una sola pieza-firma + 1 motion; nada de fondo aurora/beam. |
| **Servicios** | Magic UI (device + animated list) | Animate UI (flip/hover) | 3 puertas con **escenas distintas** (sitio / lista viva / chat); no repetir mini-UI. |
| **Sistema** | Magic UI (animated beam) | Animate UI (notification list) | Beam solo si conecta con significado; recorrido entra→ordena→responde, no nodos. |
| **Casos** | Magic UI (animated list / bento) | Aceternity (sticky reveal) | Variar la escena por rubro (panel, calendario, feed); apoyar en `useCase.flow`. |
| **Contacto** | Magic UI (iPhone mockup) | Animate UI (notification list) | "Así le llega tu consulta al equipo"; **no tocar la lógica del form (013C)**. |
| **Backgrounds** | (propio CSS/SVG) | Magic UI (1 acento) | Ver `background-patterns.md`; **un tipo distinto por sección**, nunca el mismo. |
| **Floating Product Scenes** | Magic UI (device/list/beam) | scene-kit propio | Profundidad por sombra/perspectiva/capas; cyan=resultado, electric=marca. |
| **AI / chat UI** | Magic UI / Animate UI | 21st.dev (ideas) | Burbujas con copy real de negocio (turnos/consultas), no lorem ni "AI magic". |
| **Automation flows** | Magic UI (animated list) | Animate UI (notification) | Mostrar pasos que se completan solos (HECHO en cyan), no diagramas técnicos. |
| **3D / objects** | Spline (diferido) | — | Solo pieza-firma única, lazy, con aprobación; jamás como fondo. |
| **Forms** | shadcn (propio) | Animate UI (microcopy/estados) | Mantener accesibilidad y server actions; estética sobre lo ya construido. |
| **Dashboards** | shadcn + Bento (Magic UI) | 21st.dev (ideas) | Datos reales/plausibles; evitar "gráfico decorativo" sin sentido. |
| **Motion** | framer-motion (propio) | Aceternity/Animate UI (recetas) | Ver `motion-patterns.md`; reduced-motion obligatorio, sin scroll-jacking. |

## Orden de preferencia general

1. **Construido en SYNTRA** (scene-kit, design system, tokens) — siempre primero.
2. **Magic UI / Animate UI** — adaptados, sin deps nuevas.
3. **Aceternity** — patrones de profundidad/scroll, selectivo.
4. **21st.dev / UI UX Pro Max** — solo ideas/heurística.
5. **Spline / lightswind** — excepción, con aprobación y presupuesto de performance.
