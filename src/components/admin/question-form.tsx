"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const LETTERS = ["A", "B", "C", "D"] as const;

export default function QuestionForm({
  examId,
  sections,
}: {
  examId: number;
  sections: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [options, setOptions] = useState<Record<(typeof LETTERS)[number], string>>({
    A: "",
    B: "",
    C: "",
    D: "",
  });
  const [correct, setCorrect] = useState<(typeof LETTERS)[number]>("A");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sectionId: sectionId ? Number(sectionId) : null,
          optionA: options.A,
          optionB: options.B,
          optionC: options.C,
          optionD: options.D,
          correctOption: correct,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add the question.");
        return;
      }
      setText("");
      setSectionId("");
      setOptions({ A: "", B: "", C: "", D: "" });
      setCorrect("A");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="font-medium text-slate-900">Add question manually</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div>
        <label htmlFor="q-text" className="label">Question</label>
        <textarea
          id="q-text"
          required
          rows={2}
          className="input"
          placeholder="What is the capital of France?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="q-section" className="label">
          Section <span className="font-normal text-slate-400">(optional)</span>
        </label>
        {sections.length === 0 ? (
          <p className="text-xs text-slate-500">
            No sections defined — this question uses the exam default points.
          </p>
        ) : (
          <select
            id="q-section"
            className="input"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">No section (default points)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LETTERS.map((letter) => (
          <div key={letter}>
            <label htmlFor={`q-opt-${letter}`} className="label">
              Option {letter}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-option"
                aria-label={`Mark option ${letter} as correct`}
                className="h-4 w-4 shrink-0 accent-indigo-600"
                checked={correct === letter}
                onChange={() => setCorrect(letter)}
              />
              <input
                id={`q-opt-${letter}`}
                type="text"
                required
                className="input"
                value={options[letter]}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, [letter]: e.target.value }))
                }
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        The selected radio button marks the correct answer.
      </p>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Adding…" : "Add question"}
      </button>
    </form>
  );
}
