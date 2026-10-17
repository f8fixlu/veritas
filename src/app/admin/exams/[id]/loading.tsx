import { Skeleton } from "@/components/skeleton";
import { Card } from "@/app/ui";

export default function AdminExamDetailLoading() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </Card>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card as="li" key={i} className="p-5">
            <Skeleton className="h-4 w-2/3" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </Card>
        ))}
      </ul>
    </>
  );
}
