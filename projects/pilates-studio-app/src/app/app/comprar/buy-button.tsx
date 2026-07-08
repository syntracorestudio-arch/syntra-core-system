"use client";

import { useFormStatus } from "react-dom";
import { Wallet, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function BuyButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wallet className="size-4" aria-hidden />}
      {pending ? "Abriendo pago…" : label}
    </button>
  );
}
