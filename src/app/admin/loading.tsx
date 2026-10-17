import { Skeleton } from "@/components/skeleton";
import TableSkeleton from "@/components/admin/table-skeleton";
import { Card } from "@/app/ui";

export default function AdminLoading() {
  return (
    <>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
            </div>
            <Skeleton className="mt-2 h-5 w-8" />
          </Card>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="flex items-start gap-3 p-6">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            </Card>
          ))}
        </div>
        <Card className="p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-40" />
        </Card>
      </div>

      <div className="mt-10">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-4">
          <TableSkeleton rows={5} columns={5} />
        </div>
      </div>
    </>
  );
}
