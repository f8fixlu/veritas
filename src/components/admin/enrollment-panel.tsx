"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EnrollmentPanel({
  subjectId,
  subjectName,
  students,
  enrolledIds,
}: {
  subjectId: number;
  subjectName: string;
  students: { id: number; name: string; email: string }[];
  enrolledIds: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enrolled = students.filter((s) => enrolledIds.includes(s.id));
  const available = students.filter((s) => !enrolledIds.includes(s.id));

  async function enroll() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not enroll the student.");
        return;
      }
      setSelected("");
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
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium text-slate-900">Enrolled students</h2>
        <p className="text-sm text-slate-500">
          Students in {subjectName} can take its published exams
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      {available.length > 0 ? (
        <div className="flex gap-2">
          <select
            className="input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a student…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            disabled={busy || !selected}
            onClick={enroll}
          >
            Enroll
          </button>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          All registered students are already enrolled.
        </p>
      )}

      {enrolled.length === 0 ? (
        <p className="px-1 py-2 text-sm text-slate-400">No students enrolled yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {enrolled.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {s.name}
                </p>
                <p className="truncate text-xs text-slate-500">{s.email}</p>
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
      )}
    </div>
  );
}
