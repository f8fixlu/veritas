"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, Button, Input, Select } from "@/app/ui";

type InstructorProfile = {
  id: number;
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  avatarData: string | null;
  dateOfBirth: string | null;
  school: string;
  designation: string;
  studentCode: string | null;
  createdAt: string;
};

export default function InstructorProfileButton({
  instructorId,
  name,
}: {
  instructorId: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="truncate text-left font-medium text-indigo-700 hover:text-indigo-500 hover:underline"
        onClick={() => setOpen(true)}
        aria-label={`View ${name}'s profile`}
      >
        {name}
      </button>
      {open ? (
        <InstructorProfileModal
          instructorId={instructorId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function InstructorProfileModal({
  instructorId,
  onClose,
}: {
  instructorId: number;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [school, setSchool] = useState("");
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [designation, setDesignation] = useState("");

  const setFormValues = useCallback((data: InstructorProfile) => {
    const nameParts = data.name.trim().split(/\s+/);
    setFirstName(data.firstName || nameParts[0] || "");
    setLastName(data.lastName || nameParts.slice(1).join(" "));
    setMiddleName(data.middleName);
    setEmail(data.email);
    setDateOfBirth(data.dateOfBirth?.slice(0, 10) ?? "");
    setSchool(data.school);
    setDesignation(data.designation);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/instructors/${instructorId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) setError(data.error ?? "Could not load instructor profile.");
          return;
        }
        if (!cancelled) {
          const nextProfile = data as InstructorProfile;
          setProfile(nextProfile);
          setFormValues(nextProfile);
        }
      } catch {
        if (!cancelled) setError("Could not load instructor profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instructorId, setFormValues]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/schools", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Could not load schools.");
        if (!cancelled) setSchools(data.schools ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load schools.");
      })
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/instructors/${instructorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          email,
          dateOfBirth,
          school,
          designation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save instructor profile.");
        return;
      }
      const nextProfile = data as InstructorProfile;
      setProfile(nextProfile);
      setFormValues(nextProfile);
      setEditing(false);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="Close instructor profile"
        className="fixed inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => !saving && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructor-profile-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Loading instructor profile…
          </p>
        ) : profile ? (
          <>
            <div className="flex items-center gap-3 pr-8">
              <Avatar
                name={profile.name}
                firstName={profile.firstName}
                lastName={profile.lastName}
                src={profile.avatarData}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Instructor profile
                </p>
                <h2
                  id="instructor-profile-title"
                  className="mt-0.5 truncate text-lg font-semibold tracking-tight text-slate-900"
                >
                  {profile.name}
                </h2>
                <p className="truncate text-sm text-slate-500">{profile.email}</p>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            {editing ? (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="instructor-profile-first-name"
                    label="First name"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                  <Input
                    id="instructor-profile-last-name"
                    label="Last name"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
                <Input
                  id="instructor-profile-middle-name"
                  label="Middle name (optional)"
                  value={middleName}
                  onChange={(event) => setMiddleName(event.target.value)}
                />
                <Input
                  id="instructor-profile-email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Input
                  id="instructor-profile-dob"
                  label="Date of birth (optional)"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
                <Select
                  id="instructor-profile-school"
                  label="School / HEI"
                  required
                  value={school}
                  disabled={schoolsLoading || schools.length === 0}
                  onChange={(event) => setSchool(event.target.value)}
                >
                  <option value="" disabled>{schoolsLoading ? "Loading schools…" : "Select a school / HEI"}</option>
                  {schools.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
                </Select>
                <Input
                  id="instructor-profile-designation"
                  label="Position / designation (optional)"
                  value={designation}
                  onChange={(event) => setDesignation(event.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      setFormValues(profile);
                      setEditing(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <dl className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <ProfileField label="Date of birth">
                    {profile.dateOfBirth
                      ? new Date(profile.dateOfBirth).toLocaleDateString("en-US", {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </ProfileField>
                  <ProfileField label="School">{profile.school || "—"}</ProfileField>
                  <ProfileField label="Position / designation">
                    {profile.designation || "—"}
                  </ProfileField>
                  <ProfileField label="Instructor code">
                    {profile.studentCode || "—"}
                  </ProfileField>
                </dl>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setError(null);
                      setEditing(true);
                    }}
                  >
                    Edit profile
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <h2 id="instructor-profile-title" className="font-semibold text-slate-900">
              Instructor profile
            </h2>
            <p className="mt-3 text-sm text-red-600">
              {error ?? "Could not load instructor profile."}
            </p>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
        <button
          type="button"
          aria-label="Close"
          disabled={saving}
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          ×
        </button>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function ProfileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}
