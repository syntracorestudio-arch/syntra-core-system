# Signature Palette Exception — SYNTRA CORE

> ⚠️ **SUPERSEDED (reforma V2, 2026-07-07)** por `design-freedom-v2.md`: la paleta de
> marca es de USO LIBRE con criterio — no existe más la regla 90/10, ni "cyan solo
> HECHO" (solo conserva semántica en componentes de sistema), ni el trámite de
> excepción de paleta. Este documento queda como archivo histórico.


La paleta SYNTRA (regla 90/10: azul = señal; cyan = HECHO; base slate/near-black;
todo sobrio) es **la base de todo el sitio** y **sigue vigente**. Este documento
define la **excepción acotada** para **piezas-firma**: bloques visuales
protagonistas de alta recordación donde aplicar la regla de secciones al pie de
la letra producía resultados **oscuros, rígidos y poco premium**.

Causa que origina esta excepción: forzar Hero/objetos protagonistas a "todo azul
oscuro + cyan controlado + near-black + todo sobrio" empujó cada pieza-firma a
leerse apagada y genérica. Una pieza-firma necesita poder **brillar**.

## Qué es una pieza-firma
Un bloque visual protagonista de alto impacto y primera impresión, por ejemplo:
- Hero visual;
- objeto 3D protagonista;
- background protagonista;
- imagen principal de campaña;
- escena de marca;
- asset visual de alto impacto;
- sección premium cuyo objetivo sea la primera impresión.

(Las **secciones comunes** —Servicios, Casos, Proceso, Contacto, Sistema, UI en
general— **siguen bajo la regla 90/10 estándar**. La excepción es solo para la
pieza-firma de impacto, no para toda la página.)

## Regla principal
La paleta SYNTRA sigue siendo la base. En piezas-firma se permite **más libertad
visual**:
- más blanco / luz dominante;
- plata;
- vidrio;
- materiales translúcidos;
- reflejos eléctricos;
- acentos no-azules **controlados**;
- gradientes más ricos;
- contrastes más altos;
- mayor presencia visual que una sección común.

## Lo que NO se permite
La excepción **no** habilita:
- estética gamer;
- estética crypto;
- gradients arcoíris sin criterio;
- colores random;
- UI genérica SaaS;
- template AI;
- exceso de glow;
- starfields;
- partículas decorativas;
- ruido visual;
- pérdida de legibilidad;
- romper el sistema visual del sitio.

## Cuándo aplica
Solo en piezas-firma (arriba), y solo cuando la excepción está **declarada en el
reference-lock aprobado** de esa sección. Fuera de eso, rige la regla 90/10.

## Regla práctica
```text
En piezas-firma, SYNTRA no tiene que verse "todo azul".
Tiene que verse premium, confiable, tecnológico y memorable.
```

## Relación con el reference-lock
Cualquier excepción de paleta **debe declararse en el reference-lock** de la
sección (`docs/reference-locks/<section>.md`):
- qué colores/materiales se habilitan;
- por qué son necesarios;
- qué límite tienen (hasta dónde, no más);
- cómo se evita romper la marca / la legibilidad.

Sin esa declaración en un lock `approved`, la excepción no está habilitada.
(Este documento NO modifica la skill `syntra-reference-lock`; solo define la
regla que el lock declara.)

## Relación con el Design System Guardian
El Design System Guardian **no debe bloquear automáticamente** una pieza-firma
por salirse del 90/10 azul si se cumplen **todas**:
- existe reference-lock aprobado;
- la excepción de paleta está declarada en ese lock;
- la legibilidad se mantiene (texto/CTA con contraste suficiente);
- la pieza sigue sintiéndose SYNTRA (no genérica, no template);
- el uso de color/material está justificado y acotado.

Si falta alguna de esas condiciones, el DSG mantiene su autoridad de bloqueo por
drift. La excepción flexibiliza la paleta de la pieza-firma; **no** suspende al
DSG ni a la legibilidad.
