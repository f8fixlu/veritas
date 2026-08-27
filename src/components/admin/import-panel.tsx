"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ImportPanel({
  examId,
  sections,
}: {
  examId: number;
  sections: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  function describeSkips(details: string[]): string {
    if (details.length === 0) return "";
    return ` ${details
      .slice(0, 5)
      .join(" · ")}${details.length > 5 ? ` · +${details.length - 5} more` : ""}`;
  }

  async function onUpload() {
    if (!file || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (sectionId) form.append("sectionId", sectionId);
      form.append("replace", String(replace));
      const res = await fetch(`/api/admin/exams/${examId}/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      const details: string[] = Array.isArray(data.skipDetails)
        ? data.skipDetails
        : [];
      if (!res.ok) {
        setMessage({
          kind: "error",
          text: (data.error ?? "Import failed.") + describeSkips(details),
        });
        return;
      }
      setMessage({
        kind: data.skipped > 0 ? "warn" : "ok",
        text:
          `Imported ${data.imported} question${data.imported === 1 ? "" : "s"}` +
          (replace ? " (replaced existing)" : " · appended") +
          (Array.isArray(data.sectionsCreated) && data.sectionsCreated.length > 0
            ? ` · created section${data.sectionsCreated.length === 1 ? "" : "s"} ${data.sectionsCreated.join(", ")}`
            : "") +
          (data.skipped > 0
            ? ` · skipped ${data.skipped} row${data.skipped === 1 ? "" : "s"}:${describeSkips(details)}`
            : ""),
      });
      setFile(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium text-slate-900">Import questions</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Upload a CSV or Excel file. Required columns:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            question, option_a, option_b, option_c, option_d, answer
          </code>
          , where answer is A, B, C or D.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Optional per-row{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">section</code>{" "}
          column assigns questions by section name &mdash; sections that don&apos;t exist
          yet are created automatically with the exam&apos;s default points.
        </p>
      </div>

      {sections.length > 0 ? (
        <div>
          <label htmlFor="import-section" className="label">
            Assign imported questions to
          </label>
          <select
            id="import-section"
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
          <p className="mt-1 text-xs text-slate-500">
            A <code className="rounded bg-slate-100 px-1 py-0.5">section</code>{" "}
            column in the file overrides this choice per row.
          </p>
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-indigo-600"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
        <span className="text-sm">
          <span className="block font-medium text-slate-800">
            Replace existing questions
          </span>
          <span className="block text-xs text-slate-500">
            {replace
              ? "All current questions will be deleted first."
              : "New questions are appended after the existing ones."}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="block w-full max-w-xs cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700 hover:file:bg-indigo-100"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !file}
          onClick={onUpload}
        >
          {busy ? "Importing…" : "Upload & import"}
        </button>
        <a
          href="/exam-template.csv?v=3"
          download="exam-template.csv"
          className="btn btn-secondary btn-sm"
        >
          Download template
        </a>
      </div>

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : message.kind === "warn"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
