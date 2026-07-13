"use client";

import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
      <Send className="size-4" aria-hidden />
      {pending ? "Enviando…" : "Enviarme el link"}
    </button>
  );
}
