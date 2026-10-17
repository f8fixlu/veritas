import { Button, ButtonLink } from "@/app/ui";

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
          <ButtonLink
            href={hrefFor(page - 1)}
            variant="secondary"
            size="sm"
            scroll={false}
          >
            &larr; Previous
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="pointer-events-none opacity-50"
          >
            &larr; Previous
          </Button>
        )}
        <span className="text-xs text-slate-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <ButtonLink
            href={hrefFor(page + 1)}
            variant="secondary"
            size="sm"
            scroll={false}
          >
            Next &rarr;
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="pointer-events-none opacity-50"
          >
            Next &rarr;
          </Button>
        )}
      </div>
    </div>
  );
}
