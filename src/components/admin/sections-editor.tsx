"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SectionRow = { name: string; details: string; points: string };

export default function SectionsEditor({
  examId,
  initialSections,
}: {
  examId: number;
  initialSections: {
    id: number;
    name: string;
    details: string | null;
    pointsPerQuestion: number;
  }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SectionRow[]>(
    initialSections.map((s) => ({
      name: s.name,
      details: s.details ?? "",
      points: String(s.pointsPerQuestion),
    }))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [dirty, setDirty] = useState(false);

  function update(index: number, patch: Partial<SectionRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
    setDirty(true);
  }

  function add() {
    setRows((prev) => [...prev, { name: "", details: "", points: "1" }]);
    setDirty(true);
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: rows.map((r) => ({
            name: r.name.trim(),
            details: r.details.trim() || null,
            pointsPerQuestion: Number(r.points),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({
          ok: false,
          text:
            data?.error ??
            `Could not save. (HTTP ${res.status} — try restarting the dev server if this persists.)`,
        });
        return;
      }
      setMessage({ ok: true, text: "Sections saved." });
      setDirty(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="card space-y-4 p-6"
    >
      <h2 className="font-medium text-slate-900">Sections</h2>
      <p className="text-xs text-slate-500">
        Each section has its own points per question. Questions assigned to a
        section use its points; others use the exam default.
      </p>
      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No sections yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  className="input"
                  placeholder={`Section ${index + 1} name`}
                  aria-label={`Section ${index + 1} name`}
                  value={row.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  className="input w-24 shrink-0"
                  aria-label={`Points per question for section ${index + 1}`}
                  value={row.points}
                  onChange={(e) => update(index, { points: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm shrink-0"
                  aria-label={`Remove section ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                className="input mt-2"
                placeholder="Details (optional) — shown to students"
                aria-label={`Details for section ${index + 1}`}
                value={row.details}
                onChange={(e) => update(index, { details: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={add}
        >
          + Add section
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save sections"}
        </button>
        {dirty && !busy ? (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}
