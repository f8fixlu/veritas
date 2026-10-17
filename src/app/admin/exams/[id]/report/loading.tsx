import { Skeleton } from "@/components/skeleton";
import TableSkeleton from "@/components/admin/table-skeleton";
import { Card } from "@/app/ui";

export default function ExamReportLoading() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
            </div>
            <Skeleton className="mt-2 h-5 w-10" />
          </Card>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mb-3 h-9 w-full max-w-xs rounded-lg" />
        <TableSkeleton rows={5} columns={4} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mb-3 grid max-w-md gap-3 sm:grid-cols-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <TableSkeleton rows={5} columns={6} />
      </section>
    </>
  );
}
