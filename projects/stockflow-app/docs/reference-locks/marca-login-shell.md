# Reference Lock — Marca + Login + Shell (APPROVED)

> Aprobado por el owner en su navegador el 2026-07-22 (workflow variantes vivas).
> **Login reescrito el 2026-08-19** tras el OK del owner sobre el prototipo vivo
> de "tres actores". Documenta lo aprobado; cambiar esto requiere nuevo OK.
>
> ⚠️ Al reabrirlo se encontró que la sección Login describía tres cosas que el
> código ya no hacía (alto de la banda, imagen "neutra de rubro", ubicación de
> la marca): eran de la versión de julio y nadie había reescrito el lock. Ese
> es el modo de falla a vigilar — un lock desactualizado se lee como autoridad
> y manda a "arreglar" lo que estaba bien.

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

### Estructura
- Split panel dark: mobile = banda de imagen arriba; desktop = imagen a la
  izquierda / panel del formulario a la derecha.
- **Alto de la banda** (reemplaza el `h-[38vh]` de julio, que ya no existía):
  - dueño: `h-[30dvh] min-h-[240px]`
  - empleado: `h-[22dvh] min-h-[170px]` — tiene un campo más, el form manda
  - pantallas bajas (`max-height:700px`, tipo 360×640): la banda baja a
    `min-h-[128px]`. **Regla:** en pantallas chicas cede la FOTO, nunca el
    contenido ni el pie.
- `dvh` y no `vh`: con la barra del navegador móvil, `vh` deja la banda más
  alta que la pantalla real.

### Imagen (reemplaza "neutra de rubro")
- `public/login-hero.jpg` — **mostrador de kiosco real, tomado de frente**, con
  una notebook corriendo el sistema. No es un depósito genérico.
- **La foto es FRONTAL a propósito.** Encima va `ScreenOverlay`, la pantalla de
  la notebook en uso: arranca en el login de StockFlow, se completa solo, entra
  → dashboard → ventas en loop (secuencia pedida por el owner 2026-07-23).
  El overlay se posiciona con **translate + scale 2D uniforme**, sin perspectiva
  ni `matrix3d`: cualquier transformación en diagonal vuelve el texto borroso
  sin remedio. Overlay e `<img>` comparten lienzo (`.sf-hero-canvas`) para
  recortarse juntos. Sin Ken Burns — el lienzo estático es lo que deja
  rasterizar nítido.
- Gradiente `from-background/90 via-background/25 to-background/5` de abajo
  hacia arriba: funde con el fondo sin tapar la escena.

### Marca en la banda (reemplaza "chip arriba")
- Abajo a la izquierda y discreta: `LogoMark3D size-12` + wordmark `text-lg` +
  "Stock y ventas para tu negocio". El headline se mudó al panel del formulario
  (pedido owner 2026-07-23) — la banda es escena, no titular.

### Panel del formulario — tres actores (2026-08-19)
- **Una sola columna** para pitch, formulario y pie (`mx-auto w-full max-w-sm`).
  El pitch NO se alinea al borde del panel: con `lg:px-16` arrancaba en un eje
  y el form en otro, y a 1920 —panel de 960px— el desfase se leía como descuido.
- **Selector de identidad ARRIBA del formulario**, no un link de 12px al pie:
  `Soy el dueño` / `Trabajo acá`. Etiquetas por lo que la persona ES, no por
  cómo la nombra el sistema ("empleado"). Es navegación de servidor
  (`<Link href="/login?como=…">`): cero JS, cero flash, la página se renderiza
  directamente en el modo correcto.
- **La memoria del negocio vive DENTRO del campo que reemplaza**, no en un chip
  aparte. El chip decía "no es acá" —un cartel de error para el caso normal— y
  se eliminó. Ahora el campo Negocio muestra lo recordado con un "Cambiar"
  fantasma al costado (`/login?cambiar=1`).
- **Nunca inventar el nombre del negocio.** Si se llega por `?k=<slug>` y el
  slug no coincide con la cookie, se muestra el **slug en monoespaciada** — no
  el nombre guardado de otro negocio.
- **Rescate al PRIMER fallo** (antes al segundo): "¿Es este tu negocio? Tocá
  «Cambiar» para elegir otro."
- Pitch de producto (`h2` + subtítulo) sólo desde
  `min-width:768px and min-height:760px`. El gate anterior (820px) lo dejaba
  invisible justo en 1440×900 con la barra del navegador (~780 útiles).
- "Me olvidé la contraseña" **sólo en modo dueño**: el empleado no tiene email
  y su camino es pedirle al dueño que se la resetee.
- Motion: formulario 300ms (el que viene a tipear no espera), panel de marca
  700ms (es lienzo, no tarea).
- Form sin card flotante, sobre glow ambiental
  `radial-gradient(color-mix primary 10%)`; inputs `h-11 rounded-xl bg-card`
  con ícono leading; contraseña con ojito accesible.
- Perks (md+): Vendés en segundos / Stock siempre al día / El fiado bajo control.

### El pie es marca, no relleno
- `StockFlow · un producto de SYNTRA`. **Debe quedar visible sin scrollear en
  todos los viewports, 360×640 incluido** — decisión del owner 2026-08-19:
  cuando esté comprado el dominio, esa línea lleva la URL de SYNTRA. Por eso lo
  que se recorta en pantallas bajas es la foto.

### Criterios binarios (se vuelven a medir ante cualquier cambio)
| Viewport | Scroll vertical | Pie visible |
|---|---|---|
| 360×640 (peor caso) | 0 | sí |
| 390×844 | 0 | sí |
| 1440×900 | 0 | sí (y el pitch aparece) |
| 1920×1080 | 0 | sí |

Además: cero scroll horizontal, consola limpia, y pitch/form/pie compartiendo
el mismo eje izquierdo en desktop (verificado: 888px en 1440).

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
