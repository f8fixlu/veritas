import { Card } from "@/app/ui";
import { Skeleton } from "@/components/skeleton";

export default function StudentOverviewLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-60" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-6" />
            </div>
            <Skeleton className="mt-2 h-6 w-10" />
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 2 }).map((__, row) => (
                <Card
                  key={row}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
