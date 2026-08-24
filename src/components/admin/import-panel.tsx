"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ImportPanel({ examId }: { examId: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onUpload() {
    if (!file || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/exams/${examId}/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Import failed." });
        return;
      }
      setMessage({
        ok: true,
        text: `Imported ${data.imported} question${data.imported === 1 ? "" : "s"}${
          data.skipped > 0 ? ` · skipped ${data.skipped} invalid row${data.skipped === 1 ? "" : "s"}` : ""
        }`,
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
      </div>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Importing replaces all existing questions in this exam.
      </p>

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
        <a href="/exam-template.csv" download className="btn btn-secondary btn-sm">
          Download template
        </a>
      </div>

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
