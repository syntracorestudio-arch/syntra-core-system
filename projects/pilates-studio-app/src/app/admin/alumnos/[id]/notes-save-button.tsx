"use client";

import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

export function NotesSaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
    >
      <Check className="size-3.5" aria-hidden />
      {pending ? "Guardando…" : "Guardar nota"}
    </button>
  );
}
