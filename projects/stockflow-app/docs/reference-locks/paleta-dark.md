---
section: "paleta-dark"
status: approved
approved_by: owner
approved_date: 2026-07-21
date: 2026-07-21
decision: reference-first
---

# Reference Lock — Paleta dark de StockFlow ("Slate operativo")

Dirección visual base del producto. Informada por `design-director` (read-only) +
skill `ui-ux-pro-max` (`data/colors.csv`, 96 paletas) sobre **3 referencias
aportadas por el owner**. Aprobada por el owner el 2026-07-21 con sus dos
decisiones resueltas (§5).

## Las referencias y qué tomamos de cada una

| Ref | Qué es | Qué tomamos |
| --- | --- | --- |
| **Taskify** (team dashboard) | near-black azulado, sidebar elevado, primary azul, data viz multi-hue | **El esqueleto**: densidad operativa, superficie elevada, semántica multicolor |
| **Portfolio cripto** | negro casi puro, acento teal con glow, espacioso | **La nitidez**: superficies limpias y jerarquía de elevación (que no se sienta plano) |
| **RRM** (asset management) | slate azul-grisáceo muteado, corporativo | **Descartada como dirección**: un mostrador necesita más punch, no menos. Queda como plan B si hay glare (§6) |

## El sentir objetivo

**Dark frío, alto contraste, el color ES información.** Un tablero de control de
negocio que se lee de un vistazo desde el mostrador: verde es plata, ámbar es
cuidado, rojo es pérdida. Se diferencia de forma tajante de StudioFlow (cálido
crema + carbón) y de la web SYNTRA (navy + dorado) — **diferenciar productos por
color es objetivo declarado del owner.**

## Tokens (destino: `src/app/globals.css`, Tailwind v4 `@theme`)

```css
/* Neutros — near-black azulado, superficies elevadas nítidas */
--background:            #0A0D13;  /* lienzo POS/dashboard */
--card:                  #111621;  /* superficie de card */
--elevated:              #171D2A;  /* popover / modal / sheet */
--secondary:             #1A2130;
--secondary-foreground:  #DCE3EF;
--accent:                #16233C;  /* item seleccionado (azul-teñido) */
--accent-foreground:     #DCE7FF;
--border:                #232B3A;
--input:                 #2A3444;  /* 1 paso sobre border = affordance de campo */
--foreground:            #F1F5FB;  /* ~16:1 sobre background */
--muted-foreground:      #94A1B6;  /* ~6.8:1 — AA */
--ring:                  var(--primary);

/* PRIMARY — ÚNICO token white-label (default: azul eléctrico) */
--primary:               #2E6BFF;
--primary-foreground:    #FFFFFF;  /* ~4.6:1 sobre el fill — AA */
--primary-ink:           #6D9BFF;  /* el acento como TEXTO/link sobre dark */

/* SEMÁNTICOS FIJOS — léxico de retail, NO white-label */
--success:               #22C55E;  /* ganancia / cobrado / HECHO   ~8.4:1 */
--success-ink:           #4ADE80;
--success-foreground:    #052E14;  /* texto oscuro sobre fill verde */
--warning:               #F59E0B;  /* stock bajo / por vencer      ~8.9:1 */
--warning-ink:           #FBBF24;
--danger:                #EF4444;  /* sin stock / vencido / fiado  ~5.4:1 */
--danger-ink:            #F87171;
--info:                  #818CF8;  /* aviso neutral (indigo, no cyan) */
--info-ink:              #A5B0FF;
```

Reglas de uso: `primary` como **fill** lleva `primary-foreground`; como **texto o
link** se usa `primary-ink` (nunca el fill sobre dark). Los fills verde/ámbar
llevan texto **oscuro**, nunca blanco.

## Chips de categoría (grilla de "rápidos" del POS)

Render: `fill color-mix 16%` + `ring 40%` + ícono/texto al 100% — vivo sin gritar.

```
Bebidas #3B82F6 · Golosinas #EC4899 · Cigarrillos #F59E0B · Almacén #10B981
Limpieza #06B6D4 · Varios #8B5CF6 · Fiambres #F43F5E · Panadería #84CC16
```

Los hex **puros** `#22C55E` / `#EF4444` / `#F59E0B` quedan **reservados a la
semántica de dato**: los chips usan vecinos (`#10B981`, `#F43F5E`) para no leerse
como estado.

## White-label

- **`--primary` es el único token por-tenant**, inyectado en runtime (patrón
  `accent.ts` de StudioFlow: `accentForeground()` elige blanco/oscuro AA sobre el
  acento del negocio). Además se deriva `--primary-ink` clareando el acento hasta
  AA ≥4.5:1 sobre dark.
- **Los semánticos no se tocan: son léxico, no marca.** Separación por contexto de
  uso — primary = affordance interactiva (botón/nav/foco/link); semántico = estado
  de un dato (número de plata, badge de stock, chip de vencimiento). Nunca se
  disputan el mismo pixel.
- **Colisión primary-verde ↔ success-verde**, en 3 capas: (1) todo estado lleva
  **glyph + label**, el color solo refuerza; (2) el tenant elige de una **paleta
  curada** de swatches (hex libre = modo avanzado), sin el verde-success ni el
  rojo-danger exactos; (3) si el hex libre cae a <25° de hue del success o danger,
  **aviso no bloqueante** ("tu color se parece al de 'ganancia'", puede confundir en
  la caja) — avisar, no bloquear, coherente con la filosofía del producto.

## Decisiones del owner (2026-07-21)

- **Ganancia/éxito = VERDE `#22C55E`**, no dorado. En un POS, verde = plata es
  idioma universal que el cajero decodifica sin leer; el dorado sobre dark se
  confunde con el ámbar de *cuidado*, justo lo contrario de "ganó plata". La regla
  "éxito → warm dorado" **queda acotada a la web de marketing** (ver memoria
  `no-violeta-cyan`).
- **Primary = AZUL `#2E6BFF`**, no teal. El azul deja el verde libre para la plata;
  un primary teal pelea con el verde-ganancia a un vistazo. **El teal sigue
  disponible como swatch de tenant**, nunca como default.

## Riesgos a vigilar

- **Glare en el mostrador:** `#0A0D13` maximiza reflejos y huellas. Verificar en
  teléfono real durante la tanda 1D; si molesta, subir la base a `#0F141C` (variante
  RRM) sin tocar el resto. Números héroe (total, vuelto) grandes y `tabular-nums`.
- **Daltonismo (deuteranopía, ~8% de los hombres):** verde-ganancia vs rojo-pérdida
  son los dos datos más críticos del POS y el par más riesgoso. **No negociable:
  forma + ícono + signo siempre** (↑/↓, `$`, badge distinto) — jamás "el número rojo
  vs el verde" a color solo. Ídem stock-bajo (ámbar, triángulo) vs vencido (rojo,
  reloj).
- **Choque acento ↔ semántico** en tenants nuevos: auditar con una captura del
  dashboard al dar de alta cada negocio.

## Iconografía

**Emojis = lenguaje de producto/categoría** (pedido del owner: diferenciar
productos de un vistazo en la grilla del POS). **El chrome de UI va con SVG
(Lucide)** — nav, acciones, estados. Mezclar emojis en la navegación abarata la app;
la excepción es deliberada y acotada al catálogo.
