import Link from "next/link";

/**
 * Server-rendered pager shared by lists that paginate on the server (exams,
 * enrolled students, newly registered students). Renders nothing when there is
 * a single page. `hrefFor` builds the URL for a target page so each caller can
 * preserve its own filters.
 */
export default function Pager({
  page,
  totalPages,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hrefFor: (target: number) => string;
}) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-xs text-slate-400">
        Showing {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="btn btn-secondary btn-sm" scroll={false}>
            &larr; Previous
          </Link>
        ) : (
          <span className="btn btn-secondary btn-sm pointer-events-none opacity-50">
            &larr; Previous
          </span>
        )}
        <span className="text-xs text-slate-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="btn btn-secondary btn-sm" scroll={false}>
            Next &rarr;
          </Link>
        ) : (
          <span className="btn btn-secondary btn-sm pointer-events-none opacity-50">
            Next &rarr;
          </span>
        )}
      </div>
    </div>
  );
}
