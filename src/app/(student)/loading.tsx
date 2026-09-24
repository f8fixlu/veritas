import { Skeleton } from "@/components/skeleton";

export default function StudentLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-44" />

      <div className="mt-6 space-y-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="card flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
              <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}