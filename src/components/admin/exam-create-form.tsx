"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Label, Select, Textarea } from "@/app/ui";

type SectionDraft = { name: string; details: string; points: string };

export default function ExamCreateForm({
  subjects,
  defaultSubjectId,
}: {
  subjects: { id: number; name: string }[];
  defaultSubjectId?: number;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(
    defaultSubjectId ? String(defaultSubjectId) : subjects[0] ? String(subjects[0].id) : ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [pointsPerQuestion, setPointsPerQuestion] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [showResult, setShowResult] = useState(false);
  const [randomize, setRandomize] = useState(true);
  const [requireCamera, setRequireCamera] = useState(false);
  const [requireScreenCapture, setRequireScreenCapture] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addSection() {
    setSections((prev) => [...prev, { name: "", details: "", points: "1" }]);
  }

  function updateSection(index: number, patch: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanSections = sections
      .map((s) => ({
        name: s.name.trim(),
        details: s.details.trim() || null,
        pointsPerQuestion: Number(s.points),
      }))
      .filter((s) => s.name);
    if (cleanSections.some((s) => !Number.isInteger(s.pointsPerQuestion) || s.pointsPerQuestion < 1)) {
      setError("Section points must be whole numbers of at least 1.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subjectId: Number(subjectId),
          description,
          sections: cleanSections,
          pointsPerQuestion: Number(pointsPerQuestion),
          durationMinutes: Number(durationMinutes),
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
      <Card className="p-6">
        <h2 className="font-medium text-slate-900">New exam</h2>
        <p className="mt-2 text-sm text-slate-500">
          Create a subject first — exams belong to subjects.
        </p>
      </Card>
    );
  }

  return (
    <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New exam</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      <Select
        id="exam-subject"
        label="Subject"
        required
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
      >
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Input
        id="exam-title"
        label="Title"
        type="text"
        required
        placeholder="Midterm Exam 1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        id="exam-desc"
        label={
          <>
            Description{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </>
        }
        rows={3}
        placeholder="Chapters 1–4. Answer all questions."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <Input
        id="exam-scheduled"
        label={
          <>
            Schedule date{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </>
        }
        type="datetime-local"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        helperText="Planned start date & time, shown to students. Informational — it does not gate when the exam opens."
      />

      <div>
        <Label>Sections</Label>
        {sections.length === 0 ? (
          <p className="mb-2 text-xs text-slate-500">
            No sections yet — questions use the default points below.
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={index} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder={`Section ${index + 1} name`}
                    aria-label={`Section ${index + 1} name`}
                    value={section.name}
                    onChange={(e) => updateSection(index, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    className="input w-24 shrink-0"
                    aria-label={`Points per question for section ${index + 1}`}
                    value={section.points}
                    onChange={(e) => updateSection(index, { points: e.target.value })}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    aria-label={`Remove section ${index + 1}`}
                    onClick={() => removeSection(index)}
                  >
                    ×
                  </Button>
                </div>
                <input
                  type="text"
                  className="input mt-2"
                  placeholder="Details (optional) — shown to students"
                  aria-label={`Details for section ${index + 1}`}
                  value={section.details}
                  onChange={(e) => updateSection(index, { details: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={addSection}
        >
          + Add section
        </Button>
        <p className="mt-1 text-xs text-slate-500">
          Each section has its own points per question; assign questions to a
          section when adding them.
        </p>
      </div>

      <Input
        id="exam-points"
        label={
          <>
            Points per question{" "}
            <span className="font-normal text-slate-400">(default)</span>
          </>
        }
        type="number"
        required
        min={1}
        max={100}
        inputClassName="max-w-32"
        value={pointsPerQuestion}
        onChange={(e) => setPointsPerQuestion(e.target.value)}
        helperText="Used for questions not assigned to any section."
      />

      <Input
        id="exam-duration"
        label="Time limit (minutes)"
        type="number"
        required
        min={1}
        max={600}
        inputClassName="max-w-32"
        value={durationMinutes}
        onChange={(e) => setDurationMinutes(e.target.value)}
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
            review with correct answers right after submitting.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={requireScreenCapture} onChange={(e) => setRequireScreenCapture(e.target.checked)} />
        <span className="text-sm"><span className="block font-medium text-slate-800">Require screen capture</span><span className="block text-xs text-slate-500">Students must share their screen to start. Screen snapshots are taken every 10 seconds for the exam report.</span></span>
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
            every 10 seconds and can be reviewed by admins from the exam report.
          </span>
        </span>
      </label>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Creating…" : "Create exam"}
      </Button>
    </Card>
  );
}
