import { Skeleton } from "@/components/skeleton";

export default function ResultLoading() {
  return (
    <>
      <div className="card p-8 text-center">
        <Skeleton className="mx-auto h-6 w-24 rounded-md" />
        <Skeleton className="mx-auto mt-3 h-6 w-56" />
        <Skeleton className="mx-auto mt-2 h-4 w-40" />
        <Skeleton className="mx-auto mt-6 h-12 w-32" />
        <Skeleton className="mx-auto mt-2 h-4 w-24" />
        <Skeleton className="mx-auto mt-4 h-9 w-32 rounded-lg" />
      </div>

      <Skeleton className="mb-3 mt-8 h-5 w-40" />

      <ul className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="card space-y-3 p-5">
            <Skeleton className="h-4 w-2/3" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((__, optionIndex) => (
                <Skeleton
                  key={optionIndex}
                  className="h-11 w-full rounded-xl"
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
