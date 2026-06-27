import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del dashboard (misma geometría que /admin → CLS 0). */
export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-11 w-full rounded-xl" />

      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-40 rounded-2xl sm:col-span-2" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-11 w-36 rounded-md" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
