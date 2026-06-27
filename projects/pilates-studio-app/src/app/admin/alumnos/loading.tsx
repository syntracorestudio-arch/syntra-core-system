import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-16 pt-8 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-11 w-full rounded-xl" />
      <Skeleton className="mt-6 h-5 w-24" />
      <div className="mt-3 grid gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
