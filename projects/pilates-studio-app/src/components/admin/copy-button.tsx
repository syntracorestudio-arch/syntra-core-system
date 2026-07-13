"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Botón copiar-al-portapapeles con feedback (check 2s). */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard no disponible */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copiado" : label}
    </button>
  );
}
