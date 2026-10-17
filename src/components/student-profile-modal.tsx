"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, Badge, Button } from "@/app/ui";

interface StudentProfileData {
  id: number;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  avatarData: string | null;
  course: string | null;
  year: string | null;
  schoolYear: string | null;
  email: string;
  gender: string | null;
  dateOfBirth: string | null;
  school: string | null;
  age: number | null;
  createdAt: string;
  subjects: string[];
}

export default function StudentProfileModal({
  studentId,
  onClose,
}: {
  studentId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<StudentProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/students/${studentId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load profile.");
          return;
        }
        if (!cancelled) setData(json as StudentProfileData);
      } catch {
        if (!cancelled) setError("Could not load profile.");
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-profile-modal-title"
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:max-w-md sm:p-6"
      >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            ×
          </button>

          {error ? (
            <div>
              <h2 id="student-profile-modal-title" className="text-lg font-semibold tracking-tight text-slate-900">
                Student profile
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
          ) : (
            <>
              <div className="pr-8 flex items-center gap-2 sm:gap-3">
                <Avatar
                  name={data.name}
                  firstName={data.firstName}
                  lastName={data.lastName}
                  src={data.avatarData}
                  size="lg"
                  className="h-10 w-10 text-xs sm:h-12 sm:w-12 sm:text-sm"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Student profile
                  </p>
                  <h2 id="student-profile-modal-title" className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                    {data.name}
                  </h2>
                  <p className="truncate text-xs text-slate-500 sm:text-sm">{data.email}</p>
                </div>
              </div>

              <dl className="mt-3 grid gap-x-4 gap-y-2 sm:mt-4 sm:gap-x-6 sm:gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Gender
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {data.gender === "MALE" ? (
                      <span className="badge bg-sky-50 text-sky-700">Male</span>
                    ) : data.gender === "FEMALE" ? (
                      <span className="badge bg-pink-50 text-pink-700">Female</span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Age
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {data.age === null
                      ? "—"
                      : `${data.age} year${data.age === 1 ? "" : "s"} old`}
                  </dd>
                </div>
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
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Registered
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {new Date(data.createdAt).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 border-t border-slate-100 pt-2 sm:mt-4 sm:pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Enrolled subjects
                </p>
                {data.subjects.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Not enrolled in any subjects yet.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.subjects.map((s) => (
                      <Badge key={s} variant="slate">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <Button variant="secondary" onClick={onClose}>
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
