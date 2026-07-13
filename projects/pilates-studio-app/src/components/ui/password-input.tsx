"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input de contraseña con toggle de visibilidad (el "ojo"). Reutilizable en
 * login, alta y cambio de clave. `leadingIcon` opcional (ej. candado del login);
 * si se pasa, el input debe traer padding-left acorde en `inputClassName`.
 */
export function PasswordInput({
  name,
  placeholder,
  autoComplete = "current-password",
  required = true,
  minLength,
  maxLength = 72,
  inputClassName,
  leadingIcon,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  inputClassName: string;
  leadingIcon?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {leadingIcon}
      <input
        type={visible ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
