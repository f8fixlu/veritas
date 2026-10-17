import { Skeleton } from "@/components/skeleton";
import TableSkeleton from "@/components/admin/table-skeleton";

export default function AdminStudentsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mb-3 h-4 w-full max-w-xl" />
        <div className="mb-3 grid max-w-md gap-3 sm:grid-cols-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <TableSkeleton rows={5} columns={4} />
        <div className="mt-3">
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="mb-3 grid max-w-md gap-3 sm:grid-cols-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <TableSkeleton rows={5} columns={6} />
        <div className="mt-3">
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
      </section>
    </>
  );
}
