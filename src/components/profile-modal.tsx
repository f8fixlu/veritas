"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, Button, Input } from "@/app/ui";

interface ProfileData {
  name: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string | null;
  school: string;
  avatarData: string | null;
  designation: string;
  course: string;
  year: string;
  schoolYear: string;
  studentCode: string | null;
}

export default function ProfileModal({ role, onClose }: { role: string; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [school, setSchool] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, saving]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/profile");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load profile.");
          return;
        }
        if (!cancelled) {
          const d = json as ProfileData;
          setData(d);
          setFirstName(d.firstName);
          setMiddleName(d.middleName);
          setLastName(d.lastName);
          setDateOfBirth(d.dateOfBirth ? d.dateOfBirth.slice(0, 10) : "");
          setSchool(d.school);
          setAvatarData(d.avatarData);
          setDesignation(d.designation);
          setCourse(d.course);
          setYear(d.year);
          setSchoolYear(d.schoolYear);
          setStudentCode(d.studentCode);
        }
      } catch {
        if (!cancelled) setError("Could not load profile.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function copyCode() {
    if (!studentCode) return;
    try {
      await navigator.clipboard.writeText(studentCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      setCodeError("Could not copy — copy the code below manually.");
    }
  }

  async function regenerateCode() {
    setCodeBusy(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/admin/me/student-code", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCodeError(data.error ?? "Could not regenerate your code.");
        return;
      }
      setStudentCode(data.studentCode ?? studentCode);
      router.refresh();
    } finally {
      setCodeBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
          avatarData,
          designation: designation.trim(),
          course: course.trim(),
          year: year.trim(),
          schoolYear: schoolYear.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save profile.");
        return;
      }
      setEditing(false);
      // Refresh data
      const refreshRes = await fetch("/api/account/profile");
      const refreshJson = await refreshRes.json().catch(() => ({}));
      if (refreshRes.ok) {
        const d = refreshJson as ProfileData;
        setData(d);
        setFirstName(d.firstName);
        setMiddleName(d.middleName);
        setLastName(d.lastName);
        setDateOfBirth(d.dateOfBirth ? d.dateOfBirth.slice(0, 10) : "");
        setSchool(d.school);
        setAvatarData(d.avatarData);
        setDesignation(d.designation);
        setCourse(d.course);
        setYear(d.year);
        setSchoolYear(d.schoolYear);
        setStudentCode(d.studentCode);
      }
      // Close the modal and refresh the navbar avatar.
      onClose();
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = [firstName, middleName, lastName].filter(Boolean).join(" ") || "User";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => { if (!saving) onClose(); }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:max-w-2xl sm:p-6"
      >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>

          {error ? (
            <div>
              <h2 id="profile-modal-title" className="text-lg font-semibold tracking-tight text-slate-900">
                {role === "STUDENT" ? "Student Profile" : role === "INSTRUCTOR" ? "Instructor Profile" : "Admin Profile"}
              </h2>
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
              <div className="mt-5 flex justify-end">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
          ) : editing ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="pr-8 flex items-center gap-3">
                <div className="relative">
                  <label className="cursor-pointer group relative">
                    <Avatar
                      name={displayName}
                      firstName={firstName}
                      lastName={lastName}
                      src={avatarData}
                      size="lg"
                      className="h-12 w-12 text-sm"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          setError("Image must be under 2 MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setAvatarData(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {avatarData ? (
                    <button
                      type="button"
                      aria-label="Remove photo"
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
                      onClick={() => setAvatarData(null)}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Edit profile
                  </p>
                  <h2 id="profile-modal-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                    {displayName}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="modal-first-name"
                  label="First name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  id="modal-last-name"
                  label="Last name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                id="modal-middle-name"
                label="Middle name (optional)"
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
              <Input
                id="modal-dob"
                label="Date of birth (optional)"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              <Input
                id="modal-school"
                label="School (optional)"
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
              {role === "INSTRUCTOR" || role === "ADMIN" ? (
                <Input
                  id="modal-designation"
                  label="Position / Designation (optional)"
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              ) : null}
              {role === "STUDENT" ? (
                <>
                  <Input
                    id="modal-course"
                    label="Course / Program (optional)"
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  />
                  <Input
                    id="modal-year"
                    label="Year / Grade (optional)"
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                  <Input
                    id="modal-school-year"
                    label="School Year (optional)"
                    type="text"
                    placeholder="e.g. 2024-2025"
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(e.target.value)}
                  />
                </>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="pr-8 flex items-center gap-3">
                <Avatar
                  name={data.name}
                  firstName={data.firstName}
                  lastName={data.lastName}
                  src={data.avatarData}
                  size="lg"
                  className="h-12 w-12 text-sm"
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {role === "STUDENT" ? "Student Profile" : role === "INSTRUCTOR" ? "Instructor Profile" : "Admin Profile"}
                  </p>
                  <h2 id="profile-modal-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                    {data.name}
                  </h2>
                  <p className="text-sm text-slate-500">{data.email ?? ""}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Date of birth
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {data.dateOfBirth
                      ? new Date(data.dateOfBirth).toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    School
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {data.school || "—"}
                  </dd>
                </div>
                {role === "INSTRUCTOR" || role === "ADMIN" ? (
                  <>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Position / Designation
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {designation || "—"}
                      </dd>
                    </div>
                    {studentCode ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Instructor Code
                        </dt>
                        <dd className="mt-2 flex items-center gap-3">
                          <span className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-lg font-bold tracking-[0.3em] text-slate-800">
                            {studentCode}
                          </span>
                          <Button variant="secondary" size="sm" onClick={copyCode}>
                            {codeCopied ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={codeBusy}
                            onClick={regenerateCode}
                          >
                            {codeBusy ? "Regenerating…" : "Regenerate"}
                          </Button>
                        </dd>
                        {codeError ? (
                          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                            {codeError}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          Students enter this code at registration to link their account to you.
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {role === "STUDENT" ? (
                  <>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Course / Program
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {data.course || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Year / Grade
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {data.year || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        School Year
                      </dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {data.schoolYear || "—"}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
    </div>,
    document.body
  );
}
