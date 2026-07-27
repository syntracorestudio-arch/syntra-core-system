"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { GlowOrb } from "@/components/shared/glow-orb";

/**
 * Error boundary raíz. Sin esto, un error de runtime mostraba la pantalla
 * default de Next: genérica, en inglés y sin marca — la peor primera impresión
 * posible en la única web pública del estudio.
 *
 * Client Component por contrato de Next (recibe `reset`). No expone el mensaje
 * del error al visitante (puede filtrar detalle interno); lo manda a la consola
 * para debug y deja un `digest` que permite correlacionar con los logs del host.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      <GlowOrb
        tone="electric"
        size="lg"
        className="-top-20 left-1/2 -translate-x-1/2"
      />
      <Container className="relative flex flex-col items-center gap-6 text-center">
        <span className="font-heading text-7xl font-bold tracking-tight text-gradient-brand">
          Ups
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Algo se rompió de nuestro lado
        </h1>
        <p className="max-w-md text-muted-foreground">
          No es culpa tuya. Probá de nuevo — si sigue pasando, escribinos y lo
          resolvemos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="brand" size="xl" onClick={reset}>
            Reintentar
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Código de referencia: {error.digest}
          </p>
        ) : null}
      </Container>
    </main>
  );
}
