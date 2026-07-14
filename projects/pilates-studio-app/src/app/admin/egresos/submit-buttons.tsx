"use client";

import { useFormStatus } from "react-dom";
import { Plus, Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function ExpenseSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "mt-1 w-full")}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Guardando…" : "Registrar egreso"}
    </button>
  );
}

export function RateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Guardar tarifa"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
    >
      <Check className="size-4" aria-hidden />
    </button>
  );
}
