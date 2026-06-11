# clients/ — DEPRECATED PLACEHOLDER

Esta carpeta raíz queda **deprecada como placeholder**.

## Convención oficial

Los proyectos de clientes **viven dentro de `projects/`**, no aquí:

```txt
projects/
  syntra-core-website/      # website propio
  clients/
    _template/              # plantilla base (se crea en Fase 3)
    <cliente>/              # un proyecto por cliente
```

Motivo: todo lo que se construye, deploya o entrega vive en `projects/`. El website
propio ya vive en `projects/syntra-core-website`; los clientes siguen el mismo patrón
en `projects/clients/`.

**No crear proyectos de cliente en esta carpeta raíz.** Se mantiene vacía a propósito
hasta decidir su archivado en una fase posterior.
