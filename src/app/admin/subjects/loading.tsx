import { Skeleton } from "@/components/skeleton";
import { Card, CardSoft } from "@/app/ui";

export default function AdminSubjectsLoading() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <ul className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSoft as="li" key={i} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                </div>
              </CardSoft>
            ))}
          </ul>
        </div>

        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-24" />
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-9 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1 h-9 w-full rounded-lg" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </Card>
      </div>
    </>
  );
}
