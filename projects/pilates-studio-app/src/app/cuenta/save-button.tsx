"use client";

import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      <KeyRound className="size-4" aria-hidden />
      {pending ? "Guardando…" : "Cambiar contraseña"}
    </button>
  );
}
