"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@/app/ui";

export default function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: string; // yyyy-mm-dd for the <input type="date">
    school: string;
    designation: string;
    course: string;
    year: string;
    schoolYear: string;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [middleName, setMiddleName] = useState(initial.middleName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [school, setSchool] = useState(initial.school);
  const [designation, setDesignation] = useState(initial.designation);
  const [course, setCourse] = useState(initial.course);
  const [year, setYear] = useState(initial.year);
  const [schoolYear, setSchoolYear] = useState(initial.schoolYear);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          school: school.trim(),
          designation: designation.trim(),
          course: course.trim(),
          year: year.trim(),
          schoolYear: schoolYear.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save your profile.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Profile saved.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="profile-first-name"
          label="First name"
          type="text"
          required
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          id="profile-last-name"
          label="Last name"
          type="text"
          required
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <Input
        id="profile-middle-name"
        label="Middle name (optional)"
        type="text"
        autoComplete="additional-name"
        value={middleName}
        onChange={(e) => setMiddleName(e.target.value)}
      />
      <Input
        id="profile-dob"
        label="Date of birth (optional)"
        type="date"
        autoComplete="bday"
        value={dateOfBirth}
        onChange={(e) => setDateOfBirth(e.target.value)}
      />
      <Input
        id="profile-school"
        label="School (optional)"
        type="text"
        autoComplete="organization"
        placeholder="e.g. Springfield High"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      />
      <Input
        id="profile-designation"
        label="Position / Designation (optional)"
        type="text"
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
      />
      <Input
        id="profile-course"
        label="Course / Program (optional)"
        type="text"
        value={course}
        onChange={(e) => setCourse(e.target.value)}
      />
      <Input
        id="profile-year"
        label="Year / Grade (optional)"
        type="text"
        value={year}
        onChange={(e) => setYear(e.target.value)}
      />
      <Input
        id="profile-school-year"
        label="School Year (optional)"
        type="text"
        placeholder="e.g. 2024-2025"
        value={schoolYear}
        onChange={(e) => setSchoolYear(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </Button>
    </Card>
  );
}
