import { Skeleton } from "@/components/skeleton";
import { Card } from "@/app/ui";

export default function AdminSubjectDetailLoading() {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <ul className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card as="li" key={i} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                </div>
              </Card>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-3 w-full" />
          </Card>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </Card>
        </div>
      </div>
    </>
  );
}
