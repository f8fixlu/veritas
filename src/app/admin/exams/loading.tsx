import { Skeleton } from "@/components/skeleton";
import { Card, CardSoft } from "@/app/ui";

export default function AdminExamsLoading() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <ul className="min-w-0 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSoft as="li" key={i} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                </div>
              </CardSoft>
            ))}
          </ul>
        </div>

        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </Card>
      </div>
    </>
  );
}
