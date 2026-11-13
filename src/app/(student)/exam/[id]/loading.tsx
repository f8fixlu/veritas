import { Skeleton } from "@/components/skeleton";

export default function ExamStartLoading() {
  return (
    <div className="mx-auto w-full max-w-none">
      <div className="card p-6 sm:p-10">
        <Skeleton className="h-7 w-32 rounded-md" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-3 h-5 w-full" />

        <div className="my-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 sm:block sm:py-5"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-12 sm:mx-auto sm:mt-2" />
            </div>
          ))}
        </div>

        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="mt-5 h-11 w-48 rounded-lg" />
      </div>
    </div>
  );
}
