"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ImportFromExamPanel({
  examId,
  sections,
  otherExams,
}: {
  examId: number;
  sections: { id: number; name: string }[];
  otherExams: {
    id: number;
    title: string;
    subjectName: string;
    questions: number;
  }[];
}) {
  const router = useRouter();
  const [sourceExamId, setSourceExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  async function onCopy() {
    if (!sourceExamId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/import-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceExamId: Number(sourceExamId),
          sectionId: sectionId ? Number(sectionId) : null,
          replace,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error ?? "Copy failed." });
        return;
      }
      setMessage({
        kind: "ok",
        text:
          `Copied ${data.copied} question${data.copied === 1 ? "" : "s"}` +
          (replace ? " (replaced existing)" : ""),
      });
      setSourceExamId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium text-slate-900">Import from another exam</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Copy the questions of another exam into this one.
        </p>
      </div>

      {otherExams.length === 0 ? (
        <p className="text-sm text-slate-500">
          No other exams available yet — create one first.
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="copy-source" className="label">Source exam</label>
            <select
              id="copy-source"
              required
              className="input"
              value={sourceExamId}
              onChange={(e) => setSourceExamId(e.target.value)}
            >
              <option value="" disabled>
                Select an exam…
              </option>
              {otherExams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.subjectName} · {e.questions} question
                  {e.questions === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="copy-section" className="label">
              Put copied questions in
            </label>
            <select
              id="copy-section"
              className="input"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">No section (exam default points)</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-indigo-600"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span className="text-sm">
              <span className="block font-medium text-slate-800">
                Replace this exam&apos;s existing questions
              </span>
              <span className="block text-xs text-slate-500">
                Leave unchecked to append after the current questions.
              </span>
            </span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !sourceExamId}
            onClick={onCopy}
          >
            {busy ? "Copying…" : "Copy questions"}
          </button>
        </>
      )}

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
