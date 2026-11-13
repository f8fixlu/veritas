"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Input, Select } from "@/app/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

type SchoolOption = { id: number; name: string };
const SCHOOL_OPTIONS_EVENT = "veritas-school-options-updated";

export default function InstructorCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSchools() {
      try {
        const res = await fetch("/api/admin/schools", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load schools.");
        if (active) {
          const options = (data.schools ?? []) as SchoolOption[];
          setSchools(options);
          setSchoolError(null);
          setSchool((current) => options.some((option) => option.name === current) ? current : "");
        }
      } catch (err) {
        if (active) setSchoolError(err instanceof Error ? err.message : "Could not load schools.");
      }
    }
    const refresh = () => void loadSchools();
    void loadSchools();
    window.addEventListener(SCHOOL_OPTIONS_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(SCHOOL_OPTIONS_EVENT, refresh);
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, school }),
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
      setSchool("");
      router.refresh();
    } catch {
      setError("Could not create the instructor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="form" onSubmit={onSubmit} className="h-full space-y-4 p-6">
      <h2 className="font-medium text-slate-900">New instructor</h2>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      {created ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <p className="font-medium">Instructor created</p>
          <p className="mt-0.5 text-emerald-700">
            {created.name}&apos;s student code — share it so students can link their accounts:
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
      <Select
        id="instructor-school"
        label="School / HEI"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      >
        <option value="">Select a school / HEI (optional)</option>
        {schools.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
      </Select>
      {schoolError ? <p className="text-sm text-red-600">{schoolError}</p> : null}
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
