import { Skeleton } from "@/components/skeleton";
import { Card } from "@/app/ui";

export default function AdminInstructorsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card as="li" key={i} className="px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-44" />
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            </Card>
          ))}
        </ul>

        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-9 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-9 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1 h-9 w-full rounded-lg" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </Card>
      </div>
    </>
  );
}
