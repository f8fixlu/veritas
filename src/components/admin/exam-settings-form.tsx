"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Textarea } from "@/app/ui";

export default function ExamSettingsForm({
  examId,
  title: initialTitle,
  description: initialDescription,
  durationMinutes: initialDuration,
  pointsPerQuestion: initialPoints,
  showResult: initialShowResult,
  randomize: initialRandomize,
  requireCamera: initialRequireCamera,
  requireScreenCapture: initialRequireScreenCapture,
  scheduledDate: initialScheduledDate,
}: {
  examId: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  pointsPerQuestion: number;
  showResult: boolean;
  randomize: boolean;
  requireCamera: boolean;
  requireScreenCapture: boolean;
  scheduledDate: Date | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [duration, setDuration] = useState(String(initialDuration));
  const [pointsPerQuestion, setPointsPerQuestion] = useState(
    String(initialPoints)
  );
  const [showResult, setShowResult] = useState(initialShowResult ?? false);
  const [randomize, setRandomize] = useState(initialRandomize ?? true);
  const [requireCamera, setRequireCamera] = useState(initialRequireCamera ?? false);
  // Existing rows loaded by a dev server running an older Prisma client can
  // temporarily omit this new column. Keep the checkbox controlled regardless.
  const [requireScreenCapture, setRequireScreenCapture] = useState(
    initialRequireScreenCapture ?? false
  );
  const [scheduledDate, setScheduledDate] = useState(
    initialScheduledDate ? toDateTimeLocal(initialScheduledDate) : ""
  );
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
          requireCamera,
          requireScreenCapture,
          scheduledDate: scheduledDate
            ? new Date(scheduledDate).toISOString()
            : null,
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
    <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
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
      <Input
        id="settings-title"
        label="Title"
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        id="settings-duration"
        label="Time limit (minutes)"
        type="number"
        required
        min={1}
        max={600}
        inputClassName="max-w-32"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
      />
      <Input
        id="settings-points"
        label="Points per question"
        type="number"
        required
        min={1}
        max={100}
        inputClassName="max-w-32"
        value={pointsPerQuestion}
        onChange={(e) => setPointsPerQuestion(e.target.value)}
        helperText="Default for questions without a section — manage per-section points in the Sections panel."
      />
      <Textarea
        id="settings-desc"
        label="Description"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        id="settings-scheduled"
        label={
          <>
            Schedule date{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </>
        }
        type="datetime-local"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        helperText="Planned start date & time, shown to students. Leave blank to unschedule."
      />
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
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={requireScreenCapture} onChange={(e) => setRequireScreenCapture(e.target.checked)} />
        <span className="text-sm"><span className="block font-medium text-slate-800">Require screen capture</span><span className="block text-xs text-slate-500">Students must share their screen to start. Snapshots are taken every 10 seconds and reviewed from the exam report.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-indigo-600"
          checked={randomize}
          onChange={(e) => setRandomize(e.target.checked)}
        />
        <span className="text-sm">
          <span className="block font-medium text-slate-800">
            Randomize question order
          </span>
          <span className="block text-xs text-slate-500">
            Each student gets the questions in their own shuffled order, stable
            for the whole attempt.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-indigo-600"
          checked={requireCamera}
          onChange={(e) => setRequireCamera(e.target.checked)}
        />
        <span className="text-sm">
          <span className="block font-medium text-slate-800">
            Require webcam
          </span>
          <span className="block text-xs text-slate-500">
            Students must allow their camera to start. Snapshots are captured
            every 10 seconds and reviewed from the exam report.
          </span>
        </span>
      </label>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </Card>
  );
}

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
