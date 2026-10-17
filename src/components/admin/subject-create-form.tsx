"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@/app/ui";

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
    <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New subject</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Input
        id="subject-name"
        label="Name"
        type="text"
        required
        placeholder="Mathematics"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        id="subject-desc"
        label={
          <>
            Description{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </>
        }
        type="text"
        placeholder="Algebra, geometry and statistics"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Creating…" : "Create subject"}
      </Button>
    </Card>
  );
}
