# Pre-show checklist — patrones de rechazo del owner (operativa)

> **Cuándo corre:** SIEMPRE antes de mostrarle un prototipo visual al owner,
> después del QA técnico (tsc/lint/consola). Se verifica **con visión** sobre el
> render a 1920 (+390 si aplica). Cada ítem es binario; **un NO = no se muestra,
> se corrige primero**. Cada ítem viene de un rechazo real (fuente citada).
> Mantenimiento: cada rechazo NUEVO del owner agrega un ítem acá y una entrada
> en `taste/README.md`.

## La checklist

1. **¿Nada flota como maqueta?** Ningún objeto chico suspendido sobre fondo
   vivo sin anclaje (sombra de contacto, marco, bleed del borde, o fundido).
   _Fuente: circuito de Servicios ("iconos con pulso"), orbe de Contacto,
   doctrina anti-loop del lock servicios v5._
2. **¿No huele a "hecho con IA"?** Sin violeta/cyan, sin hologramas/HUDs
   flotantes, sin renders con estética synthwave/crypto, sin aforismos de
   copy tipo slogan vacío. Fotos: reales > generadas; si es generada, que
   pase por fotografía. _Fuente: regla no-violeta-cyan (2026-07-08), assets
   de Proceso (3 rondas rechazadas), copy "suena a IA" (Nosotros v4)._
3. **¿Sin card dentro de card?** Ningún panel con fondo+borde+radius propios
   adentro de otra card. La superficie contenedora es UNA. _Fuente: mini-UI
   del rail de Contacto (rechazada por estructura)._
4. **¿Sin brillos falsos?** Nada de speculars/hotspots CSS pintados a mano
   simulando material; el brillo o es real (render/foto/shader con luz
   coherente) o no está. _Fuente: orbe CSS y orbe 3D de Contacto ("reflejos
   de mala calidad", "brillo feo")._
5. **¿El texto vive sobre CALMA?** Ningún bloque de texto sobre zona de alta
   frecuencia o luminancia mutante; AA 4.5:1 contra el PEOR frame, no el
   promedio. Si el fondo es animado, la arquitectura de luz debe ser fija
   (imagen) y la vida puntual (partículas de baja frecuencia). _Fuente:
   columnas 3D de Contacto (ilegible por construcción)._
6. **¿No es una grilla de cards genérica de SaaS?** Si la solución es "N
   cards iguales en grid", buscar la forma superior (carrusel, split, panel
   imagen-led, editorial). El sitio ya está lleno de cards. _Fuente: rechazo
   de "4 cards" en Servicios ("la mayoría de estudios tiene el mismo diseño
   de cards")._
7. **¿Las imágenes se ven completas y nítidas?** Sin recortes que mutilen el
   sujeto (ratio del asset ≈ ratio del contenedor), sin upscaling blando
   (fuente ≥ tamaño físico renderizado × DPR), sin zonas "rellenas" no
   fotográficas que lean como corte. _Fuente: panel de Contacto (3
   iteraciones: ensanchada, cortada, corte al medio)._
8. **¿El motion respeta el ritmo de lectura?** Ninguna transición interrumpe
   una animación interna o un texto a mitad de lectura; los ciclos van en
   TIEMPO REAL (dt), nunca por frame (monitores de 144Hz). Frenos y arranques
   con rampa, nunca hard-stop. _Fuente: carrusel de Nosotros (5 rondas de
   calibración de ritmo + bug de refresh rate)._
9. **¿Los espacios respiran con intención?** Ningún hueco muerto entre
   bloques de contenido (se llena con contenido REAL o con el visual
   protagonista — nunca con relleno defensivo tipo timeline de proceso).
   _Fuente: rail de Contacto (espacio muerto señalado 2 veces; el "qué pasa
   después" fue rechazado como relleno)._
10. **¿La info es nueva para el lector en ese punto?** El contenido del slot
    no duplica lo que está a centímetros (ej.: capacidades que repetían los
    chips del propio form) ni lo que otra sección ya dijo. _Fuente:
    diagnóstico PED del rail de Contacto._
11. **¿Se juzgó la PROPORCIÓN en el viewport real?** Columnas/paneles
    calibrados a 1920 Y al monitor del owner (escala Windows 125% — pedir
    su captura si hay duda dimensional). _Fuente: idas y vueltas de rem del
    panel de Contacto (26→31→32→33→34)._
12. **¿Está vivo?** Lo opuesto también es rechazo: sobriedad estática sin
    motion/profundidad/color = "plano, sin vida". La belleza es propósito
    suficiente, la quietud no. _Fuente: fondos "desparejos, sin vida"
    (2026-07-09), doctrina design-freedom-v2 §2._

## Cómo se corre

En el loop visual (Playwright CLI), con el render de 1920 delante: leer los 12
ítems y contestarlos mirando la captura. Los que no se puedan verificar en
estático (8, ritmo) se verifican interactuando o razonando sobre el código
(dt-based, rampas). Si todos dan SÍ → mostrar al owner. Si alguno da NO →
corregir sin gastar una ronda del owner.
