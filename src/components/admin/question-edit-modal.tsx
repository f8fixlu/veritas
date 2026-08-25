"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

export type EditableQuestion = {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  sectionId: number | null;
};

export default function QuestionEditModal({
  question,
  sections,
  onClose,
}: {
  question: EditableQuestion;
  sections: { id: number; name: string; pointsPerQuestion: number }[];
  onClose: (saved?: boolean) => void;
}) {
  const [text, setText] = useState(question.text);
  const [sectionId, setSectionId] = useState(
    question.sectionId ? String(question.sectionId) : ""
  );
  const [options, setOptions] = useState<Record<Letter, string>>({
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  });
  const [correct, setCorrect] = useState<Letter>(
    (question.correctOption as Letter) ?? "A"
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, busy]);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
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
        setError(data.error ?? "Could not save the question.");
        return;
      }
      onClose(true);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="edit-question-title"
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <h2
            id="edit-question-title"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Edit question
          </h2>
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSave();
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label htmlFor="eq-section" className="label">
                Section{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              {sections.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No sections defined — uses the exam default points.
                </p>
              ) : (
                <select
                  id="eq-section"
                  className="input"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <option value="">No section (default points)</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.pointsPerQuestion} pt
                      {s.pointsPerQuestion === 1 ? "" : "s"}/question
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label htmlFor="eq-text" className="label">Question</label>
              <textarea
                id="eq-text"
                required
                rows={2}
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {LETTERS.map((letter) => (
                <div key={letter}>
                  <label htmlFor={`eq-opt-${letter}`} className="label">
                    Option {letter}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="eq-correct-option"
                      aria-label={`Mark option ${letter} as correct`}
                      className="h-4 w-4 shrink-0 accent-indigo-600"
                      checked={correct === letter}
                      onChange={() => setCorrect(letter)}
                    />
                    <input
                      id={`eq-opt-${letter}`}
                      type="text"
                      required
                      className="input"
                      value={options[letter]}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          [letter]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              The selected radio button marks the correct answer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => onClose()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
