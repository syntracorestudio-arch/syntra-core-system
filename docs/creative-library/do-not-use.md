# SYNTRA Creative Library — Do Not Use

> Anti-patrones. Si aparece alguno, es señal de "landing IA genérica" o de
> repetición de fórmula. Cada uno con el reemplazo correcto.

| Anti-patrón | Por qué es un problema | Qué hacer en su lugar |
| --- | --- | --- |
| **Browser frame + chat repetido en todas las secciones** | La pieza buena se vuelve plantilla; mata el asombro | Variar el tipo de escena por sección (sitio / lista viva / panel / calendario / chat). |
| **Nodos abstractos como solución universal** | No comunican producto; hablan del sistema, no del cliente | Recorrido de producto concreto (entra → se ordena → responde). |
| **Cards iguales con ícono Lucide blanco** | Lee como SaaS template; íconos como protagonista | Escena de producto concreta; ícono solo como acento pequeño. |
| **Grilla azul en toda la landing** | Monotonía; el cliché #1 de "web IA" | Un campo visual distinto por sección (ver `background-patterns.md`). |
| **Copy SaaS genérica** | "Soluciones integrales", "transformación digital" = humo | Lenguaje de negocio real (consultas, turnos, mails); ver `docs/visual-reset/copy-tone.md`. |
| **Auroras cliché sin propósito** | Efecto-por-efecto; no aporta mensaje | Quitar; si hace falta luz, 1 glow tenue con foco. |
| **Partículas por decoración** | Costo de performance + genérico | Nada; el movimiento debe tener significado. |
| **3D pesado sin función** | Deps pesadas, riesgo Lighthouse, "wow" vacío | Solo pieza-firma única justificada, lazy y aprobada. |
| **Stock photos genéricas** | Rompen la sensación premium/propia | Mini-UIs/escenas construidas o assets de marca reales. |
| **Mockups vacíos con barras grises** | Lee como maqueta, contradice "ves lo que recibís" | Mini-sitio reconocible con copy y CTA real. |

## Señales de alarma (revisar de inmediato)

```text
- Dos secciones contiguas con el mismo fondo.
- La misma mini-UI (frame+chat) en 3+ secciones.
- Más de 1 motion-firma compitiendo en un viewport.
- Cualquier dep nueva sumada por un solo efecto decorativo.
- Copy que un dueño de negocio no entiende en 5 segundos.
- Un efecto que se puede borrar sin perder mensaje (→ borrarlo).
```

Cualquiera de estas dispara revisión del **Visual Quality Director** antes de avanzar.
