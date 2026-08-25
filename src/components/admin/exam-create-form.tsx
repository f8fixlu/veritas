"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ExamCreateForm({
  subjects,
  defaultSubjectId,
}: {
  subjects: { id: number; name: string }[];
  defaultSubjectId?: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(
    defaultSubjectId ? String(defaultSubjectId) : subjects[0] ? String(subjects[0].id) : ""
  );
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [randomize, setRandomize] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subjectId: Number(subjectId),
          durationMinutes: Number(durationMinutes),
          description,
          showResult,
          randomize,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the exam.");
        return;
      }
      router.push(`/admin/exams/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="font-medium text-slate-900">New exam</h2>
        <p className="mt-2 text-sm text-slate-500">
          Create a subject first — exams belong to subjects.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New exam</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div>
        <label htmlFor="exam-title" className="label">Title</label>
        <input
          id="exam-title"
          type="text"
          required
          className="input"
          placeholder="Midterm Exam 1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="exam-subject" className="label">Subject</label>
        <select
          id="exam-subject"
          required
          className="input"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="exam-duration" className="label">Time limit (minutes)</label>
        <input
          id="exam-duration"
          type="number"
          required
          min={1}
          max={600}
          className="input"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="exam-desc" className="label">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="exam-desc"
          rows={3}
          className="input"
          placeholder="Chapters 1–4. Answer all questions."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-indigo-600"
          checked={showResult}
          onChange={(e) => setShowResult(e.target.checked)}
        />
        <span className="text-sm">
          <span className="block font-medium text-slate-800">
            Show answer review after submission
          </span>
          <span className="block text-xs text-slate-500">
            Students always see their score. This also reveals the full question
            review with correct answers right after submitting.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-indigo-600"
          checked={randomize}
          onChange={(e) => setRandomize(e.target.checked)}
        />
        <span className="text-sm">
          <span className="block font-medium text-slate-800">Randomize question order</span>
          <span className="block text-xs text-slate-500">
            Each student gets the questions in their own shuffled order, stable
            for the whole attempt.
          </span>
        </span>
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create exam"}
      </button>
    </form>
  );
}
