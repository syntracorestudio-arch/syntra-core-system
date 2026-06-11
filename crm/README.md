# SYNTRA CRM

Objetivo:

Gestionar clientes y proyectos dentro del ecosistema SYNTRA CORE.

Pipeline:

Lead
↓
Calificación
↓
Propuesta
↓
Proyecto activo
↓
Entrega
↓
Mantenimiento
↓
Cliente recurrente

Reglas:

- Ningún lead queda sin seguimiento
- Toda propuesta debe documentarse
- Todo cliente debe tener historial
- Automatizar seguimiento cuando sea posible

---

## Estado: PLACEHOLDER OS-LEVEL

Esta carpeta es **scaffolding** del sistema operativo SYNTRA.

- El CRM / pipeline de leads **real** vive hoy en **`projects/syntra-core-website`**
  (Supabase + panel de leads + n8n).
- Las subcarpetas (`leads/`, `pipeline/`, `proposals/`, …) están vacías por diseño.
- **No duplicar datos reales de leads/clientes aquí.** La fuente de verdad operativa
  es el website.