"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Student = { id: number; name: string; email: string };
type EnrolledPage = {
  students: Student[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 10;

/**
 * Roster for one subject. `students` is the set the instructor already teaches
 * somewhere; anyone else has to be found with the search box, so this panel
 * never dumps the global student list. The enrolled list is paginated on the
 * server (10 per page).
 */
export default function EnrollmentPanel({
  subjectId,
  subjectName,
  students,
  enrolledIds,
}: {
  subjectId: number;
  subjectName: string;
  students: Student[];
  enrolledIds: number[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const [enrolled, setEnrolled] = useState<EnrolledPage | null>(null);
  const [enrolledError, setEnrolledError] = useState<string | null>(null);

  // Students already in this subject, or enrolled in another of this
  // instructor's subjects, can be added without a search.
  const known = students.filter((s) => !enrolledIds.includes(s.id));
  const showResults = query.trim().length >= 2;
  const excludeKey = enrolledIds.join(",");
  const addable = known.filter((s) => !matches.some((m) => m.id === s.id));

  async function loadPage(page: number) {
    try {
      const res = await fetch(
        `/api/admin/subjects/${subjectId}/enrollments?page=${page}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not load enrolled students.");
      }
      setEnrolled((await res.json()) as EnrolledPage);
      setEnrolledError(null);
    } catch (err) {
      setEnrolledError(
        err instanceof Error ? err.message : "Could not load enrolled students."
      );
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/subjects/${subjectId}/enrollments?page=1`
        );
        const data = (await res.json().catch(() => ({}))) as EnrolledPage & {
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load enrolled students.");
        if (!alive) return;
        setEnrolled(data);
        setEnrolledError(null);
      } catch (err) {
        if (!alive) return;
        setEnrolledError(
          err instanceof Error ? err.message : "Could not load enrolled students."
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [subjectId, enrolledIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ query: q });
        if (excludeKey) params.set("exclude", excludeKey);
        const res = await fetch(`/api/admin/subjects/students?${params}`);
        const data = await res.json().catch(() => ({}));
        setMatches(Array.isArray(data.students) ? data.students : []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, excludeKey]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setMatches([]);
      setSearching(false);
    }
  }

  async function enroll(userId: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not enroll the student.");
        return;
      }
      setQuery("");
      setMatches([]);
      // New student is sorted into the list; show its first page.
      await loadPage(1);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unroll(userId: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not remove the student.");
        return;
      }
      // If the last row of a page was removed, step back a page.
      const current = enrolled?.page ?? 1;
      const wasLastOnly =
        enrolled?.students.length === 1 &&
        enrolled.page === enrolled.totalPages;
      await loadPage(wasLastOnly && current > 1 ? current - 1 : current);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const pager =
    enrolled && enrolled.total > PAGE_SIZE ? (
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">
          Showing {enrolled.students.length === 0 ? 0 : (enrolled.page - 1) * PAGE_SIZE + 1}–{Math.min(enrolled.page * PAGE_SIZE, enrolled.total)} of {enrolled.total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={enrolled.page <= 1}
            onClick={() => loadPage(enrolled.page - 1)}
          >
            &larr; Previous
          </button>
          <span className="min-w-16 text-center text-xs text-slate-500">
            Page {enrolled.page} of {enrolled.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={enrolled.page >= enrolled.totalPages}
            onClick={() => loadPage(enrolled.page + 1)}
          >
            Next &rarr;
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium text-slate-900">Enrolled students</h2>
        <p className="text-sm text-slate-500">
          Students in {subjectName} can take its published exams
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="student-search"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Add a student
        </label>
        <input
          id="student-search"
          type="search"
          className="input mt-1"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-400">
          Type at least two characters to find a registered student.
        </p>
      </div>

      {addable.length > 0 && !showResults ? (
        <ul className="divide-y divide-slate-100">
          {addable.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {s.name}
                </p>
                <p className="truncate text-xs text-slate-500">{s.email}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => enroll(s.id)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showResults ? (
        searching ? (
          <p className="text-sm text-slate-400">Searching…</p>
        ) : matches.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No registered student matches that search.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matches.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {s.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{s.email}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => enroll(s.id)}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Enrolled
        </h3>
        {enrolledError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {enrolledError}
          </p>
        ) : enrolled === null ? (
          <p className="px-1 py-2 text-sm text-slate-400">Loading…</p>
        ) : enrolled.students.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-400">
            No students enrolled yet.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {enrolled.students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {s.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => unroll(s.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {pager}
          </>
        )}
      </div>
    </div>
  );
}