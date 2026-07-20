# StockFlow — Guion de demo comercial (3-4 min)

> **Estado:** Fase 0 · La demo corre sobre el tenant seed **"Kiosco El Trébol"**
> (tanda 1I) con datos vivos — nunca improvisar datos en vivo (regla StudioFlow).
> Marca del negocio demo en primer plano; SYNTRA aparece solo al cierre.
> Dispositivo: teléfono Android del vendedor (PWA instalada), con push habilitado.

---

## Preparación (antes de la reunión)

- [ ] Seed cargado y verificado: dashboard con ganancia visible, 5-6 productos en
  stock bajo, 4 vencimientos (2 críticos), 8 clientes de fiado.
- [ ] Un producto real del kiosco visitado SIN cargar (para el momento alta-en-10s:
  se escanea algo del mostrador de ellos).
- [ ] Push de prueba disparado y visto en el teléfono esa mañana.
- [ ] Modo no molestar OFF, brillo alto, datos móviles (no depender del wifi del local).

## Guion

**0:00 — El gancho: el negocio en una pantalla.**
Abrir la PWA en el dashboard: *"Esto es tu kiosco, ahora mismo."* Señalar en orden:
vendido hoy ($ y nº de ventas vs promedio), **ganancia estimada de hoy** (el número
que nadie le mostró nunca), stock bajo, por vencer, fiado en la calle. No explicar
menús: dejar que los números hablen.

**0:45 — La caja: más rápida que la calculadora.**
Ir al POS. Escanear 3 productos con la cámara (o lector si hay), cobrar con "QR" en
un tap. Mostrar que el stock del producto bajó solo. *"Tu empleado no carga nada:
escanea y cobra. Menos de 15 segundos."*

**1:45 — El catálogo se arma solo.**
Escanear el producto del mostrador de ELLOS que no está cargado → sheet de alta:
nombre (autocompleta si está en el catálogo argentino) + precio → guardar → queda
en el ticket. *"Diez segundos. No hay 'carga inicial': el catálogo se arma
vendiendo."*

**2:15 — El fiado sin cuaderno.**
Nueva venta → medio de pago "Fiado" → cliente "Marta" → listo. Abrir la ficha de
Marta: saldo, historial, botón "Registrar pago" con pago parcial. *"Se acabó el
cuaderno. Y si Marta se pasa del límite que vos pongas, te llega un aviso."*

**2:45 — El momento mágico: te avisa solo.**
Disparar (pre-armado) el push real al teléfono, que suena en vivo: **"Te quedan 3
Coca 500 — vendés 8 por día."** Dejar que lo lean en la pantalla bloqueada.
*"Esto es lo que ningún sistema hace: no tenés que entrar a mirar — te avisa antes
de que pierdas la venta. Lo mismo con lo que está por vencer."*

**3:15 — Cierre.**
Volver al dashboard. Señalar el logo y el color: *"Y esto no dice StockFlow — dice
'Kiosco El Trébol'. Es TU sistema, con TU marca."* Precio único en pesos, sin
sorpresas. Cierre directo: *"¿Lo dejamos cargado esta semana y lo probás con tu
mercadería?"*

## Datos del seed que la demo necesita (tanda 1I)

- ~120 productos con **EAN reales argentinos** (gaseosas, golosinas, cigarrillos,
  galletitas, limpieza) con emoji y color por categoría.
- 30 días de ventas históricas con curva creíble (`generate_series`, picos viernes/
  sábado, ticket promedio realista) y **costos cargados** (la ganancia se tiene que
  ver, no "—").
- 5-6 productos bajo umbral de stock (entre ellos uno de altísima rotación: la Coca
  del push).
- 4 vencimientos: 2 críticos (<7 días), 2 lejanos.
- 8 clientes de fiado: saldos dispares, uno cerca del límite, pagos parciales en el
  historial de al menos 3.
- Cierres de caja previos, uno con diferencia chica de efectivo (muestra control,
  no perfección).
- Tenant B ("Kiosco B") con datos distintos — para demostrar aislamiento si un
  prospecto técnico pregunta.

## Reglas

- Nunca demo sobre datos vacíos o inventados en el momento.
- Si algo falla en vivo: seguir con el guion desde el dashboard (siempre carga) y
  agendar re-demo; no debuggear delante del prospecto.
- El pitch de respaldo y las objeciones viven en `pitch.md`.
