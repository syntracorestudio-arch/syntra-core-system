"use client";

import { useFormStatus } from "react-dom";
import { LogIn, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Botón de ingreso con estado pending (deshabilita + spinner mientras autentica). */
export function LoginSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "mt-1 w-full")}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Ingresando…
        </>
      ) : (
        <>
          <LogIn className="size-4" aria-hidden />
          Ingresar
        </>
      )}
    </button>
  );
}
