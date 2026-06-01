import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { GlowOrb } from "@/components/shared/glow-orb";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <GlowOrb
        tone="electric"
        size="lg"
        className="-top-20 left-1/2 -translate-x-1/2"
      />
      <Container className="relative flex flex-col items-center gap-6 text-center">
        <span className="font-heading text-7xl font-bold tracking-tight text-gradient-brand">
          404
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Página no encontrada
        </h1>
        <p className="max-w-md text-muted-foreground">
          La página que buscás no existe o fue movida. Volvé al inicio para
          seguir explorando.
        </p>
        <Button asChild variant="brand" size="xl">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </Container>
    </main>
  );
}
