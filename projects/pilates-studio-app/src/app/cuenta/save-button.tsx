"use client";

import { useFormStatus } from "react-dom";
import { KeyRound, Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function SaveButton({
  label = "Cambiar contraseña",
  icon = "key",
}: {
  label?: string;
  icon?: "key" | "check";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "check" ? Check : KeyRound;
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      <Icon className="size-4" aria-hidden />
      {pending ? "Guardando…" : label}
    </button>
  );
}
