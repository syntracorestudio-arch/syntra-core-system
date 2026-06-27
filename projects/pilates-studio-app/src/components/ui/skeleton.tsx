import { cn } from "@/lib/cn";

/** Placeholder de carga. Usar con la MISMA geometría que el contenido real (CLS 0). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} aria-hidden />;
}
