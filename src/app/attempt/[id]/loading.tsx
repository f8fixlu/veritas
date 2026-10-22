"use client";

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
        <div className="mx-auto flex h-16 w-full max-w-none items-center justify-between gap-6 px-6 lg:px-8">
          <div className="min-w-0">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-none space-y-6 px-6 py-8 pb-32 lg:px-8">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-6 py-4">
          <Skeleton className="h-5 w-40" />
        </div>

        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card space-y-4 p-6">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-7 w-7 rounded-full" />
              <Skeleton className="h-6 flex-1" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, optionIndex) => (
                <Skeleton key={optionIndex} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 pt-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-6 px-6 py-4 lg:px-8">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}