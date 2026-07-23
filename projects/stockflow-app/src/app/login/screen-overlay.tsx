"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "El sistema en uso" sobre el vidrio de la notebook de la foto del login.
 *
 * Secuencia (pedido del owner 2026-07-23): arranca en el LOGIN de StockFlow
 * (réplica de esta misma página), se completa solo y entra → DASHBOARD →
 * ventas entrando en loop con el total subiendo.
 *
 * La foto es FRONTAL a propósito (2026-07-23): la pantalla es un rectángulo
 * plano, así que el overlay se posiciona con translate + scale 2D UNIFORME —
 * sin matrix3d, sin perspectiva, sin re-muestreo diagonal. Eso es lo que
 * garantiza texto nítido (las iteraciones con pantalla inclinada quedaban
 * borrosas sin remedio). Overlay e <img> comparten lienzo (`.sf-hero-canvas`),
 * así que se recortan y escalan JUNTOS en cualquier viewport.
 *
 * Perf: transform GPU + timeouts livianos. reduced-motion → dashboard
 * estático, sin secuencia ni interval.
 */

const IMG = 1122; // ancho de la foto (1122×1402)
const UW = 640; // lienzo de diseño de la UI
const UH = 405; // = UW · RECT.h / RECT.w (mantiene la proporción del vidrio)

// Vidrio de la notebook en coords de la foto, medido sobre zooms 8× de las 4
// esquinas (máx ±4px de desvío, invisible contra el bisel oscuro).
const RECT = { x: 344, y: 749, w: 408, h: 258 };

// Ciclo de ventas del dashboard. Montos chicos a propósito: el total se
// acota por ciclo (ver abajo) y así nunca pasa de 5 cifras → la card no se
// desborda por más horas que quede abierta la página.
const VENTAS = [
  { monto: 1850, label: "$ 1.850", metodo: "QR", items: "2 art." },
  { monto: 2400, label: "$ 2.400", metodo: "Efectivo", items: "3 art." },
  { monto: 950, label: "$ 950", metodo: "QR", items: "1 art." },
  { monto: 1600, label: "$ 1.600", metodo: "Tarjeta", items: "2 art." },
];
const fmt = (n: number) => "$ " + n.toLocaleString("es-AR");

// Guion del arranque: login que se completa solo y entra.
// step: 0 vacío · 1 email tipeado · 2 contraseña · 3 botón presionado · dash.
const GUION = [
  { at: 900, step: 1 },
  { at: 1900, step: 2 },
  { at: 2800, step: 3 },
  { at: 3600, step: 4 }, // → dashboard
];

export function ScreenOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);

  const enDash = step >= 4;
  const venta = VENTAS[(tick + VENTAS.length - 1) % VENTAS.length];
  // tick 0 = total base. El acumulado se reinicia en cada ciclo de 4 ventas:
  // el total queda SIEMPRE entre $ 82.450 y $ 89.250 (5 cifras, ancho fijo
  // con tabular-nums) y la card nunca se desborda.
  const total =
    82450 +
    (tick > 0
      ? VENTAS.slice(0, ((tick - 1) % VENTAS.length) + 1).reduce((a, v) => a + v.monto, 0)
      : 0);

  // Posicionamiento: translate + scale uniforme, recalculado si el lienzo
  // cambia de tamaño. 2D puro → raster nítido.
  useEffect(() => {
    const el = ref.current;
    const canvas = el?.parentElement;
    if (!el || !canvas) return;
    const apply = () => {
      const s = canvas.clientWidth / IMG;
      el.style.transform = `translate(${RECT.x * s}px, ${RECT.y * s}px) scale(${(RECT.w * s) / UW})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Guion login→dashboard + loop de ventas. reduced-motion: directo al
  // dashboard, quieto. (El primer tick cae a los 4.2s, ya dentro del
  // dashboard — el guion termina a los 3.6s.)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = setTimeout(() => setStep(4), 0);
      return () => clearTimeout(t);
    }
    const timeouts = GUION.map(({ at, step: s }) => setTimeout(() => setStep(s), at));
    const id = setInterval(() => setTick((t) => t + 1), 4200);
    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(id);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 origin-top-left select-none overflow-hidden rounded-[18px] bg-background text-foreground"
      style={{ width: UW, height: UH }}
    >
      {/* ── Fase 1: el login de StockFlow (réplica de esta página) ── */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          enDash ? "opacity-0" : "opacity-100"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(24rem 18rem at 80% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 62%)",
        }}
      >
        {/* Tipografía GRANDE a propósito: la pantalla se ve a ~55% del lienzo,
            todo lo menor a ~17px de diseño queda ilegible en pantalla real. */}
        <div className="w-[400px]">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary-ink" />
            <p className="text-[25px] font-bold">
              Stock<span className="text-primary-ink">Flow</span>
            </p>
          </div>
          <p className="mt-3.5 text-[24px] font-bold tracking-tight">Entrá a tu negocio</p>

          <p className="mt-3 text-[14px] font-medium text-muted-foreground">Email</p>
          <div className="mt-1.5 flex h-12 items-center rounded-lg border border-border bg-[#0d121c] px-4 text-[17px]">
            {step >= 1 ? (
              <span className="sf-screen-type">vos@eltrebol.com</span>
            ) : (
              <span className="text-muted-foreground/50">vos@tunegocio.com</span>
            )}
          </div>

          <p className="mt-2.5 text-[14px] font-medium text-muted-foreground">Contraseña</p>
          <div className="mt-1.5 flex h-12 items-center rounded-lg border border-border bg-[#0d121c] px-4 text-[17px] tracking-[0.22em]">
            {step >= 2 && <span className="sf-screen-type">••••••••</span>}
          </div>

          <div
            className={`mt-4 flex h-12 items-center justify-center rounded-lg bg-primary text-[18px] font-semibold text-primary-foreground transition-all duration-300 ${
              step >= 3 ? "brightness-125" : ""
            }`}
          >
            Entrar
          </div>
        </div>
      </div>

      {/* ── Fase 2: el dashboard en uso ── */}
      <div
        className={`absolute inset-0 flex transition-opacity duration-500 ${
          enDash ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* riel de navegación, solo gesto */}
        <aside className="flex w-[52px] shrink-0 flex-col items-center gap-4 border-r border-border bg-[#0f1420] pt-4">
          <span className="size-7 rounded-lg bg-gradient-to-br from-primary to-primary-ink" />
          <span className="mt-1 size-5 rounded-md bg-accent ring-1 ring-primary/40" />
          <span className="size-5 rounded-md bg-secondary" />
          <span className="size-5 rounded-md bg-secondary" />
        </aside>

        {/* Tipografía GRANDE (≥14px de diseño): la pantalla se ve a ~55% del
            lienzo; menos que eso es ilegible por tamaño, no por raster. */}
        <div className="flex min-w-0 flex-1 flex-col px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[26px] font-bold leading-8 tracking-tight">Hoy</p>
            <span className="rounded-full bg-accent px-3.5 py-1 text-[14px] text-accent-foreground">
              Caja abierta
            </span>
          </div>

          {/* el número que importa — pop sutil con cada venta */}
          <div className="mt-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[15px] text-muted-foreground">Vendido hoy</p>
            <p key={total} className="sf-screen-pop tabular text-[50px] font-semibold leading-[1.15]">
              {fmt(total)}
            </p>
            <p className="text-[14px]">
              <span className="font-semibold text-success-ink">▲ +12%</span>
              <span className="text-muted-foreground"> vs. tu promedio · {38 + tick} ventas</span>
            </p>
          </div>

          {/* medios de pago */}
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {(["Efectivo", "QR", "Tarjeta"] as const).map((m, i) => (
              <div
                key={m}
                className={`rounded-xl border bg-card px-3 py-2 transition-all duration-500 ${
                  enDash && tick > 0 && venta.metodo === m ? "border-primary/60" : "border-border"
                }`}
              >
                <p className="text-[14px] text-muted-foreground">{m}</p>
                <p className="tabular text-[19px] font-semibold leading-6">
                  {["$ 38.500", "$ 22.800", "$ 15.900"][i]}
                </p>
                <div className="mt-1.5 h-[5px] rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: ["58%", "34%", "24%"][i] }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* stock bajo: llena el pie de la pantalla y muestra el diferencial */}
          <div className="mt-2.5 flex-1 rounded-xl border border-border bg-card px-4 py-2.5">
            <p className="text-[14px] text-warning-ink">⚠ Te estás quedando sin</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[16px] font-medium">🧉 Yerba Playadito 1kg</p>
              <p className="tabular text-[15px] font-semibold text-warning-ink">quedan 2</p>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-[16px] font-medium">🥤 Coca-Cola 500ml</p>
              <p className="tabular text-[15px] font-semibold text-warning-ink">quedan 3</p>
            </div>
          </div>

          {/* toast: la venta que acaba de entrar */}
          {enDash && tick > 0 && (
            <div
              key={tick}
              className="sf-screen-toast absolute right-4 top-[104px] flex items-center gap-2.5 rounded-xl border border-border bg-[#0f1420] py-2.5 pl-3 pr-4 shadow-2xl"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-success/15 text-[14px] text-success-ink">
                ✓
              </span>
              <span className="text-[15px]">
                <b className="tabular">Venta cobrada · {venta.label}</b>
                <span className="text-muted-foreground"> · {venta.metodo}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* vidrio: reflejo diagonal + viñeta, para fundir con la foto */}
      <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-br from-white/[0.07] via-transparent to-black/25 ring-1 ring-white/5" />
    </div>
  );
}
