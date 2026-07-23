"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type AvisoData = { tone: "ok" | "warn" | "error"; text: string } | null;

/**
 * Banner de resultado ok/aviso/error — estaba copiado a mano en diez pantallas
 * (V5, limpieza 2026-07-22). El color nunca informa solo: ícono + texto siempre.
 */
export function AvisoBanner({
  aviso,
  onClose,
  className,
}: {
  aviso: AvisoData;
  onClose: () => void;
  className?: string;
}) {
  if (!aviso) return null;
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1",
        aviso.tone === "ok" && "bg-success/10 text-success-ink ring-success/25",
        aviso.tone === "warn" && "bg-warning/10 text-warning-ink ring-warning/25",
        aviso.tone === "error" && "bg-danger/10 text-danger-ink ring-danger/25",
        className,
      )}
    >
      {aviso.tone === "ok" ? (
        <Check className="mt-0.5 size-4 shrink-0" />
      ) : (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="flex-1">{aviso.text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="cursor-pointer opacity-60 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
