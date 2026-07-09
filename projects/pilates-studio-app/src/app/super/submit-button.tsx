"use client";

import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      <Plus className="size-4" aria-hidden />
      {pending ? "Creando…" : "Crear estudio"}
    </button>
  );
}
