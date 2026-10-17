"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@/app/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default function InstructorCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; code: string } | null>(
    null
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
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
      setCreated({ name: data.name ?? name, code: data.studentCode ?? "" });
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New instructor</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {created ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <p className="font-medium">Instructor created</p>
          <p className="mt-0.5 text-emerald-700">
            {created.name}&apos;s student code — share it so students can link
            their accounts:
          </p>
          <p className="mt-1.5 inline-block rounded-md bg-white px-2.5 py-1 font-mono text-lg font-semibold tracking-wider text-emerald-900">
            {created.code}
          </p>
        </div>
      ) : null}
      <Input
        id="instructor-name"
        label="Name"
        type="text"
        required
        placeholder="Jane Doe"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        id="instructor-email"
        label="Email"
        type="email"
        required
        placeholder="jane@school.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="instructor-password"
        label="Password"
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Creating…" : "Create instructor"}
      </Button>
    </Card>
  );
}
