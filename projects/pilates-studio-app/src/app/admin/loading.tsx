import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del panel dentro del shell con sidebar (título + contenido). */
export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 grid gap-5">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
