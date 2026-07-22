# Session Handoff — template (cierre de arco pre-`/clear`)

> Patrón adaptado de codegraph (`docs/design/agent-codegraph-adoption.md`, 2026-07-22):
> un doc de diseño escrito PARA una sesión fresca de Claude, con contexto shipped,
> decisiones cerradas ("do not relitigate"), ideas rankeadas y orden de arranque.
> Complementa (no reemplaza) TASKS.md, reference-locks y la memoria persistente:
> el handoff captura el estado de un ARCO en curso que ninguno de esos cubre.

## Cuándo escribir uno

- Al cerrar un arco grande cuya continuación queda para otra sesión (antes de
  sugerir `/clear`, junto con el checklist de cierre de CLAUDE.md).
- Cuando un arco queda A MITAD de camino y el contexto de la sesión ya no da más.
- NO escribir handoff para tareas cerradas por completo (ahí alcanza TASKS.md +
  commit + memoria). El handoff existe para trabajo EN VUELO.

## Dónde

`docs/handoffs/<YYYY-MM-DD>-<arco>.md` — se commitea con el arco. Cuando el arco
se termina, el handoff se marca `status: closed` (o se borra) para que no quede
guidance duplicada viva.

## Template

```markdown
---
arc: <nombre corto del arco>
date: <YYYY-MM-DD>
branch: <branch de trabajo>
status: open | closed
---

# Handoff — <arco>

## Estado shipped (qué YA está hecho y verificado)
- <qué se commiteó/mergeó, con PR # y qué evidencia de verificación hubo>

## Decisiones cerradas — do not relitigate
- <decisión> — <por qué / quién la tomó (owner/medición)>. No reabrir sin
  pedido explícito del owner.

## En vuelo (estado exacto)
- <qué está a medias, en qué archivo(s), qué falta exactamente>
- Working tree: <qué archivos quedaron sin commitear y por qué>

## Próximos pasos, rankeados
1. <paso con mayor leverage> — <cómo validar que funcionó>
2. <siguiente>

## Orden de arranque sugerido para la sesión fresca
1. <primer comando/lectura concreta — p. ej. "leer este handoff y git status">
2. <segundo>

## Trampas conocidas
- <qué NO hacer / qué ya se intentó y falló, para no repetirlo>
```

## Reglas

1. **Denso y corto** (≤1 pantalla ideal): la sesión fresca lo lee entero; cada
   línea que no cambia una decisión es costo.
2. **"Do not relitigate" es vinculante**: la sesión que lee el handoff no reabre
   esas decisiones; si cree que una está mal, lo marca al owner en una línea.
3. **Evidencia, no memoria**: "tests verdes (salida vista)" ≠ "debería andar".
   Registrar qué se VERIFICÓ y qué quedó sin verificar.
4. **Un handoff por arco**, actualizado en el mismo archivo si el arco sigue
   varias sesiones — no crear uno nuevo por día.
