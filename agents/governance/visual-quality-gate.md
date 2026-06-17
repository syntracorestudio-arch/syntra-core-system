# SYNTRA VISUAL QUALITY GATE — PROTOCOLO

## 1. Propósito

Este documento define el **gate de calidad visual** de SYNTRA CORE: el protocolo
obligatorio que toda tarea **visual/perceptual** debe atravesar antes de commitear.

Existe porque, en varias iteraciones (especialmente Hero y Servicios), `tsc`,
`lint` y `build` pasaban pero el resultado **no era aprobable visualmente**, y eso
generó retrabajo. El gate separa **"compila"** de **"se ve premium"**.

Regla raíz:

```text
Build verde no significa diseño aprobado.
```

Este protocolo aplica la autoridad definida en `agents/ROLE-AUTHORITY-MAP.md`
(Tier 4 — Visual Quality Director). El mapa define la autoridad; este gate define
cuándo y cómo se ejecuta. La fuente de verdad del rol es
`agents/design/visual-quality-director.md`.

---

## 2. Diferenciación de tareas (qué dispara el gate)

### Tareas técnicas / bugfix
Pueden commitearse si pasan QA técnico (tsc/lint/build) y respetan el scope.
NO requieren aprobación visual. Ejemplos: refactors, fixes de lógica, tipados,
config, docs, automatizaciones, backend.

### Tareas visuales / perceptuales (DISPARAN EL GATE)
NO pueden commitearse sin **aprobación visual explícita del owner**. Disparan el
gate las tareas que afecten:

- composición / layout visual / uso del espacio;
- percepción premium / jerarquía;
- Hero, Servicios, Casos, Proceso, Contacto;
- motion visible / escenas premium;
- responsive visual;
- jerarquía/fuerza del CTA;
- percepción de marca.

Ante la duda de si una tarea es visual, **se trata como visual** (el gate es el
estado seguro).

---

## 3. Flujo obligatorio

```text
1. Implementar localmente.
2. Ejecutar QA técnico (tsc / lint / build).
3. Validar en navegador / screenshot (breakpoints de §5).
4. Entregar Visual Review (formato §6) — visual-quality-director.
5. Esperar aprobación visual explícita del owner.
6. Recién ahí: commit + push.
```

Mientras tanto, los cambios quedan en **working tree sin commitear**. No se
commitea por build verde ni por QA técnico aprobado.

---

## 4. Autoridad y veto

El `visual-quality-director` puede **bloquear un commit visual** aunque:

- `tsc` pase;
- `lint` pase;
- `build` pase;
- Lighthouse esté bien;
- `qa-performance-guard` no encuentre errores técnicos.

No reemplaza al QA técnico: lo **complementa** con veto visual. No diseña, no
implementa, no define estrategia ni producto. Su veto aplica solo sobre calidad
visual/perceptual. La aprobación final para commitear es del **owner**.

Veto:

```text
NO APROBADO VISUALMENTE.
No commitear.
```

---

## 5. Breakpoints obligatorios

Toda revisión visual valida, como mínimo:

```text
360x640     — mobile real
390x844     — mobile real
768x1024    — tablet
1024x768    — laptop chico / tablet landscape
1440x900    — desktop estándar
1920x1080   — desktop grande / monitor real
```

En desktop grande (1920) el diseño NO debe estirarse: conservar densidad visual,
jerarquía, límites de lectura, balance entre columnas, intención de la escena y
control del espacio negativo. Si una sección se percibe como contenido flotando
en una superficie demasiado grande, el diseño falla aunque sea técnicamente
responsive. Mobile-first siempre, con validación desktop-premium.

---

## 6. Formato Visual Review (obligatorio)

```text
# Visual Review

## Veredicto
APROBADO / NO APROBADO / APROBADO CON AJUSTES

## Qué funciona

## Qué falla

## Qué empeoró respecto a la versión anterior

## Qué debe cambiar antes de commit

## Riesgo si se aprueba así

## Decisión
- Commitear
- Ajustar sin commitear
- Revertir
- Abrir rediseño
```

---

## 7. Criterios de fracaso aunque compile

Un cambio visual **fracasa aunque pase tsc/lint/build** si:

- parece maqueta;
- parece template;
- parece PowerPoint;
- parece dashboard genérico;
- hay aire muerto sin intención;
- se siente comprimido;
- el CTA pierde fuerza;
- el texto y el visual parecen dos bloques separados;
- el cambio se ve peor que la versión anterior;
- no se entiende el valor en menos de 5 segundos.

---

## 8. Relación con el resto del sistema

- `agents/ROLE-AUTHORITY-MAP.md` — define la autoridad (Tier 4) y la jerarquía de
  conflicto.
- `agents/development/web-delivery-pipeline.md` — este gate es el **STATE 7.5
  (VISUAL QUALITY GATE)** para tareas visuales.
- `agents/design/visual-quality-director.md` — fuente de verdad del rol.
- `CLAUDE.md` — routing operativo y regla de no-commit visual.

Ningún documento de ejecución puede saltarse este gate para tareas visuales.
