"use client";

import { useEffect, useRef, useState } from "react";
import { X, CameraOff } from "lucide-react";

/**
 * Escáner por cámara. Usa `BarcodeDetector`, que es nativo del navegador — cero
 * dependencias y cero megabytes. No está en todos lados (Safari no lo trae), así
 * que si falta lo decimos claro y el cajero sigue con búsqueda o lector USB: la
 * caja nunca se frena por esto.
 */

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

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

      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
      });

      const tick = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found.length > 0 && found[0].rawValue) {
            onScan(found[0].rawValue);
            return; // el padre cierra
          }
        } catch {
          // un frame ilegible no es un error: seguimos
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-white">Apuntá al código de barras</p>
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
            <video
              ref={videoRef}
              playsInline
              muted
              className="size-full object-cover"
            />
            {/* Guía de encuadre */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-28 w-4/5 max-w-sm rounded-xl border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
