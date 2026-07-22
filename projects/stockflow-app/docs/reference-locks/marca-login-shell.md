# Reference Lock — Marca + Login + Shell (APPROVED)

> Aprobado por el owner en su navegador el 2026-07-22 (workflow variantes vivas).
> Documenta lo aprobado; cambiar esto requiere nuevo OK del owner.

## Marca

- **Isotipo**: cubo isométrico + flecha de tendencia que lo atraviesa y sale
  subiendo. Dos versiones, ambas en `src/components/brand/`:
  - `LogoMark` (logo.tsx) — plano, trazo con gradiente `--primary → --primary-ink`.
    Para usos chicos: sidebar, ancla, favicon.
  - `LogoMark3D` (logo-3d.tsx) — volumen con **interior negro** (caras
    `color-mix(primary 24/12/6%, #05070c)`) y **aristas azules**; flecha en
    relieve; float sutil 8s, reduced-motion → frame estático. Solo login.
- **Wordmark**: `Stock` en foreground + `Flow` en `--primary-ink`, bold tracking-tight.
- **Eslogan**: "Todo tu inventario, en un solo lugar."
- Todo por tokens → white-label intacto. Cero dependencias 3D (app POS).

## Login (`/login`)

- Split panel StudioFlow-v2 adaptado a dark: mobile = banda de imagen `h-[38vh]`
  arriba; desktop = imagen mitad izquierda / form derecha.
- Overlay de la foto **hacia `--background`** (`from-background/95 → /10`) — nunca
  hacia foreground (lavaría la imagen en dark).
- Imagen: **neutra de rubro** (depósito genérico luz azul, `public/login-hero.jpg`,
  1024×1280) — el mismo login sirve a cualquier vertical. Pendiente: versión
  hi-res del owner (mismo encuadre 4:5, prompt en la sesión 2026-07-22).
- Panel: chip `LogoMark3D size-14` + wordmark + tagline "Stock y ventas para tu
  negocio"; eslogan como H2 (oculto en mobile).
- Form: sin card flotante, sobre glow ambiental `radial-gradient(color-mix
  primary 10%)`; inputs h-11 `rounded-xl bg-card` con ícono leading; contraseña
  con ojito (toggle accesible); ancla md+ = `LogoMark3D size-12` + wordmark
  `text-2xl`; perks: Vendés en segundos / Stock siempre al día / El fiado bajo
  control; footer "StockFlow · un producto de SYNTRA".

## Shell (`src/components/shell/app-shell.tsx`)

- Sidebar 4 grupos (labels uppercase 11px): **Operación** (Resumen, Vender,
  Caja) · **Mercadería** (Productos, Recibir mercadería, Precios, Vencimientos) ·
  **Control** (Fiado, Reportes) · **Negocio** (Equipo, Ajustes).
  - "Control", NO "Plata" (pedido del owner). "Recibir mercadería", NO "Ingreso".
- Barra mobile: Resumen · Vender · Caja · Más — pill activa `bg-accent`; menú
  "Más" con los mismos grupos y separadores.
- Header sidebar: `LogoMark size-8` + nombre del negocio + wordmark chico.

## Decisiones de dirección que siguen vigentes

- Headers de sección: banda watermark token-driven, **sin fotos** (la foto es
  solo del login). Pendiente V3.
- Filtros por categoría: solo Productos y POS (chips). Pendiente V4.
