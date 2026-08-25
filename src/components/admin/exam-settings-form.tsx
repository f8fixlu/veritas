"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ExamSettingsForm({
  examId,
  title: initialTitle,
  description: initialDescription,
  durationMinutes: initialDuration,
  pointsPerQuestion: initialPoints,
  showResult: initialShowResult,
  randomize: initialRandomize,
}: {
  examId: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  pointsPerQuestion: number;
  showResult: boolean;
  randomize: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [duration, setDuration] = useState(String(initialDuration));
  const [pointsPerQuestion, setPointsPerQuestion] = useState(
    String(initialPoints)
  );
  const [showResult, setShowResult] = useState(initialShowResult);
  const [randomize, setRandomize] = useState(initialRandomize ?? true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          durationMinutes: Number(duration),
          pointsPerQuestion: Number(pointsPerQuestion),
          showResult,
          randomize,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Could not save." });
        return;
      }
      setMessage({ ok: true, text: "Settings saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="font-medium text-slate-900">Exam settings</h2>
      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      <div>
        <label htmlFor="settings-title" className="label">Title</label>
        <input
          id="settings-title"
          type="text"
          required
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="settings-duration" className="label">
          Time limit (minutes)
        </label>
        <input
          id="settings-duration"
          type="number"
          required
          min={1}
          max={600}
          className="input max-w-32"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="settings-points" className="label">Points per question</label>
        <input
          id="settings-points"
          type="number"
          required
          min={1}
          max={100}
          className="input max-w-32"
          value={pointsPerQuestion}
          onChange={(e) => setPointsPerQuestion(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Default for questions without a section — manage per-section points in
          the Sections panel.
        </p>
      </div>
      <div>
        <label htmlFor="settings-desc" className="label">Description</label>
        <textarea
          id="settings-desc"
          rows={3}
          className="input"
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
            review with correct answers.
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
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
