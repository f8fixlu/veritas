import { Skeleton } from "@/components/skeleton";

export default function ExamStartLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />

        <div className="my-6 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-slate-50 px-3 py-4">
              <Skeleton className="mx-auto h-3 w-16" />
              <Skeleton className="mx-auto mt-2 h-6 w-10" />
            </div>
          ))}
        </div>

        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="mt-4 h-10 w-40 rounded-lg" />
      </div>
    </div>
  );
}
