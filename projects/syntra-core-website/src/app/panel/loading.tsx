import { Container } from "@/components/layout/container";

/** Loading UI del panel — skeleton elegante (sin JS). */
export default function PanelLoading() {
  return (
    <Container className="flex flex-col gap-8 py-8">
      <div className="flex items-center justify-between">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-secondary/60" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-secondary/60" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-secondary/40"
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded-2xl bg-secondary/30" />
    </Container>
  );
}
