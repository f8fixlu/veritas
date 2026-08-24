"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SubjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the subject.");
        return;
      }
      setName("");
      setDescription("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New subject</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="subject-name" className="label">Name</label>
        <input
          id="subject-name"
          type="text"
          required
          className="input"
          placeholder="Mathematics"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="subject-desc" className="label">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="subject-desc"
          type="text"
          className="input"
          placeholder="Algebra, geometry and statistics"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create subject"}
      </button>
    </form>
  );
}
