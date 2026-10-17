"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Select } from "@/app/ui";

/**
 * Links an unassigned (legacy / no-code) student to an instructor. Admin-only
 * route; once linked, only that instructor can see or enroll the student.
 */
export default function AssignInstructorSelect({
  studentId,
  instructors,
}: {
  studentId: number;
  instructors: { id: number; name: string; email: string }[];
}) {
  const router = useRouter();
  const [instructorId, setInstructorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!instructorId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/instructor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId: Number(instructorId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not assign the instructor.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={assign}
      className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"
    >
      <Select
        aria-label="Instructor"
        className="w-full sm:w-52"
        selectClassName="h-8 py-1 text-sm"
        value={instructorId}
        onChange={(e) => setInstructorId(e.target.value)}
      >
        <option value="" disabled>
          Assign to…
        </option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} · {i.email}
          </option>
        ))}
      </Select>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={busy || !instructorId}
      >
        {busy ? "Assigning…" : "Assign"}
      </Button>
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : null}
    </form>
  );
}
