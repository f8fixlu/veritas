"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function InstructorCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the instructor.");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New instructor</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="instructor-name" className="label">Name</label>
        <input
          id="instructor-name"
          type="text"
          required
          className="input"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="instructor-email" className="label">Email</label>
        <input
          id="instructor-email"
          type="email"
          required
          className="input"
          placeholder="jane@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="instructor-password" className="label">Password</label>
        <input
          id="instructor-password"
          type="password"
          required
          minLength={6}
          className="input"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create instructor"}
      </button>
    </form>
  );
}
