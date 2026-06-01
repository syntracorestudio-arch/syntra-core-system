# SYNTRA UI

Objetivo:

Contener componentes reutilizables oficiales de SYNTRA CORE.

Reglas:

- TypeScript obligatorio
- Mobile-first
- Componentes desacoplados
- Accesibilidad obligatoria
- TailwindCSS
- Reutilización prioritaria

---

## Design System (implementado en `projects/syntra-core-website` — Sprint 0)

La fundación visual y de componentes vive en el sitio oficial. Estructura:

```txt
src/
 ├── app/
 │    ├── globals.css      # Design tokens SYNTRA (dark-first) + utilidades glow/glass
 │    └── layout.tsx       # Fuentes oficiales (Sora/Space Grotesk/Inter) + metadata
 ├── config/site.ts        # Contenido del sitio (content-driven, ES) — fuente única de copy
 ├── types/index.ts        # Contratos de tipos compartidos
 ├── lib/
 │    ├── utils.ts         # cn()
 │    └── motion.ts        # Variantes Framer Motion centralizadas (sello de movimiento)
 └── components/
      ├── ui/              # Primitivos: button, card, badge
      ├── layout/          # container, section, navbar, footer
      ├── animations/      # fade-in, blur-reveal, stagger (client wrappers)
      └── shared/          # section-heading, glow-orb / gradient-background
```

### Design tokens (`globals.css`)

| Token CSS | Valor | Utilidad Tailwind |
|---|---|---|
| `--brand-bg` | `#0F172A` | `bg-brand-bg` |
| `--brand-deep` | `#0B3D91` | `*-brand-deep` |
| `--brand-electric` | `#2563EB` | `*-brand-electric` (primary/CTA) |
| `--brand-cyan` | `#38BDF8` | `*-brand-cyan` (glow/accent) |
| `--brand-smoke` | `#F8FAFC` | `*-brand-smoke` (texto) |

Tipografías: `font-heading` (Sora) · `font-accent` (Space Grotesk) · `font-sans` (Inter).
Utilidades premium: `.glow-electric`, `.glow-cyan`, `.text-gradient-brand`, `.surface-glass`.

### Reglas de uso

- **Server Components por defecto.** Solo `navbar` y los wrappers de `animations/` son client.
- **Motion:** importar variantes de `lib/motion.ts`, nunca redefinir tiempos/easing.
- **Copy:** editar en `config/site.ts`, no hardcodear texto en componentes.
- **Accesibilidad:** `prefers-reduced-motion` ya se respeta globalmente desde `globals.css`.
