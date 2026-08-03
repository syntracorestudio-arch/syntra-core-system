"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, CameraOff, Flashlight, Check } from "lucide-react";
import { PuertaDeEscaneo } from "./scan-gate";

/**
 * Escáner por cámara. Usa `BarcodeDetector`, que es nativo del navegador — cero
 * dependencias y cero megabytes. No está en todos lados (Safari no lo trae), así
 * que si falta lo decimos claro y el cajero sigue con búsqueda o lector USB: la
 * caja nunca se frena por esto.
 *
 * Desde que la cámara del celular es el camino PRINCIPAL de escaneo (y no un
 * respaldo del lector USB), esto tiene que aguantar cientos de lecturas
 * seguidas en una góndola con poca luz. De ahí las cinco decisiones de acá:
 *
 *  · 10 Hz, no 60. Antes se decodificaba en cada `requestAnimationFrame`: es la
 *    causa principal del consumo de batería y del calentamiento, y encima lee
 *    PEOR (encola frames movidos). A 10 Hz no se nota y el teléfono aguanta.
 *  · Doble confirmación y enfriamiento viven en `PuertaDeEscaneo` (probado
 *    aparte): es la regla que separa cobrar una Coca de cobrar cuatro.
 *  · Linterna, si el equipo la tiene. Media góndola de kiosco está en sombra.
 *  · Beep + vibración al aceptar: con un producto en una mano y el teléfono en
 *    la otra, nadie puede confirmar mirando la pantalla.
 *  · Modo continuo: el escáner queda abierto y va cargando uno atrás de otro.
 *    Reabrirlo por producto son ~1,6 s de nada, que en una carga de catálogo
 *    entero se vuelven media hora.
 */

type CodigoDetectado = { rawValue: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<CodigoDetectado[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

/** Un ciclo de detección cada 100 ms: suficiente para que se sienta instantáneo. */
const PERIODO_MS = 100;

/** Beep corto de confirmación. Mismo tono que el de cobro (mostrador ruidoso). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* audio bloqueado o no disponible: el beep es un extra, no rompe nada */
  }
}

export function CameraScanner({
  onScan,
  onClose,
  modoInicial = "simple",
  permitirContinuo = false,
  titulo,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  /**
   * `simple`: una lectura y el padre cierra (mostrador).
   * `continuo`: queda abierto y va aceptando uno atrás de otro (carga/ingreso).
   */
  modoInicial?: "simple" | "continuo";
  /** Muestra el interruptor para pasar a continuo sin salir del escáner. */
  permitirContinuo?: boolean;
  /** Contador vivo del padre, p. ej. "3 productos · $3.600". */
  titulo?: string;
}) {
  const [modo, setModo] = useState<"simple" | "continuo">(modoInicial);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linterna, setLinterna] = useState(false);
  const [tieneLinterna, setTieneLinterna] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  /* El callback va en un ref y el efecto NO depende de él. Antes `onScan`
     cambiaba de identidad (depende del catálogo en memoria del padre) y la
     cámara se desmontaba y volvía a arrancar SOLA en mitad de la sesión. */
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* El ciclo de detección lee el modo por ref: cambiarlo NO puede reiniciar la
     cámara (perderíamos el stream y el enfriamiento en pleno uso). */
  const modoRef = useRef(modo);
  useEffect(() => {
    modoRef.current = modo;
  }, [modo]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detenido = false;
    const puerta = new PuertaDeEscaneo();

    async function start() {
      if (!window.BarcodeDetector) {
        setError("Tu navegador no puede escanear con la cámara. Usá el lector o buscá por nombre.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("No pudimos usar la cámara. Revisá los permisos del navegador.");
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      // Linterna: solo si el equipo la expone. No todos los Android la dan.
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      try {
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        if (caps?.torch) setTieneLinterna(true);
      } catch {
        /* sin capacidades declaradas: seguimos sin linterna */
      }

      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });

      const ciclo = async () => {
        if (detenido || !videoRef.current) return;

        let leido: string | null = null;
        try {
          const found = await detector.detect(videoRef.current);
          leido = found[0]?.rawValue ?? null;
        } catch {
          // un frame ilegible no es un error: seguimos
        }

        if (detenido) return;

        if (puerta.ver(leido, Date.now()) === "aceptado" && leido) {
          beep();
          navigator.vibrate?.(40);
          onScanRef.current(leido);

          if (modoRef.current === "simple") {
            // Una lectura y afuera: el escáner se cierra SOLO, así el padre no
            // tiene que saber en qué modo está.
            onCloseRef.current();
            return;
          }
          setUltimo(leido);
          setFlash(true);
          setTimeout(() => setFlash(false), 300);
        }

        timer = setTimeout(ciclo, PERIODO_MS);
      };

      timer = setTimeout(ciclo, PERIODO_MS);
    }

    start();

    return () => {
      detenido = true;
      if (timer) clearTimeout(timer);
      trackRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const alternarLinterna = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const siguiente = !linterna;
    try {
      await track.applyConstraints({
        advanced: [{ torch: siguiente } as MediaTrackConstraintSet],
      });
      setLinterna(siguiente);
    } catch {
      // Algunos equipos declaran la capacidad y después rechazan: no insistimos.
      setTieneLinterna(false);
    }
  }, [linterna]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {modo === "continuo" ? "Escaneá uno atrás de otro" : "Apuntá al código de barras"}
        </p>
        {/* En el mostrador el continuo es OPT-IN: se activa acá, sin salir del
            escáner, y no queda pegado para la próxima venta. Un doble cobro en
            la caja cuesta plata; se prende para todos cuando la prueba en tienda
            real lo respalde. */}
        {permitirContinuo && modo === "simple" && !error && (
          <button
            type="button"
            onClick={() => setModo("continuo")}
            className="h-9 shrink-0 cursor-pointer rounded-lg bg-white/10 px-3 text-xs font-medium text-white"
          >
            Escanear varios
          </button>
        )}
        {tieneLinterna && (
          <button
            type="button"
            onClick={alternarLinterna}
            aria-label="Linterna"
            aria-pressed={linterna}
            className={`grid size-9 cursor-pointer place-items-center rounded-lg ${
              linterna ? "bg-white text-black" : "bg-white/10 text-white"
            }`}
          >
            <Flashlight className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar escáner"
          className="grid size-9 cursor-pointer place-items-center rounded-lg bg-white/10 text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex-1">
        {error ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <CameraOff className="mx-auto mb-3 size-8 text-white/50" />
              <p className="text-sm text-white/80">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {/* Guía de encuadre. Parpadea en verde con cada lectura aceptada:
                confirmación visible sin tener que leer nada. */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={`h-28 w-4/5 max-w-sm rounded-xl border-2 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)] transition-colors duration-150 ${
                  flash ? "border-emerald-400 bg-emerald-400/20" : "border-white/70"
                }`}
              />
            </div>

            {modo === "continuo" && ultimo && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/70 px-4 py-2.5 text-sm text-white">
                <Check className="size-4 shrink-0 text-emerald-400" />
                <span className="tabular min-w-0 flex-1 truncate">Leído: {ultimo}</span>
              </div>
            )}
          </>
        )}
      </div>

      {modo === "continuo" && !error && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm text-white/80">
            {titulo ?? "Escaneá uno atrás de otro"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-10 shrink-0 cursor-pointer rounded-lg bg-white px-5 text-sm font-semibold text-black"
          >
            Listo
          </button>
        </div>
      )}
    </div>
  );
}
