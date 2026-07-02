"use client";

import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { uploadLogo, removeLogo } from "@/app/admin/configuracion/actions";

const LOGO_MAX = 2_097_152; // 2 MB

export function LogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LOGO_MAX) {
      setError("El logo debe pesar menos de 2 MB. Probá con una imagen más liviana.");
      e.target.value = "";
      return;
    }
    setError(null);
    formRef.current?.requestSubmit();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">Logo del estudio</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Se muestra en tu landing pública. PNG, JPG, SVG o WEBP, hasta 2 MB.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-sunken/60">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo del estudio" className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-7 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form ref={formRef} action={uploadLogo}>
            <label className={`${buttonClass("secondary", "md")} cursor-pointer`}>
              <Upload className="size-4" aria-hidden />
              {logoUrl ? "Cambiar logo" : "Subir logo"}
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={onPick}
              />
            </label>
          </form>
          {logoUrl ? (
            <form action={removeLogo}>
              <button type="submit" className={buttonClass("ghost", "md")}>
                <X className="size-4" aria-hidden />
                Quitar
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
