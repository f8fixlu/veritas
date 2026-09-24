import { Skeleton } from "@/components/skeleton";

export default function AttemptLoading() {
  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-800 antialiased"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <div className="min-w-0">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-1.5 h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 pb-28">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3">
          <Skeleton className="h-4 w-40" />
        </div>

        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card space-y-3 p-5">
            <div className="flex items-start gap-2">
              <Skeleton className="mt-0.5 h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, optionIndex) => (
                <Skeleton key={optionIndex} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}