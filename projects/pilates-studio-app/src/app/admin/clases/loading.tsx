import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-11 w-full rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </main>
  );
}
