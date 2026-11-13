"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Select } from "@/app/ui";
import ConfirmModal from "@/components/confirm-modal";
import { HEI_TYPES, PH_REGIONS } from "@/lib/school-options";

type SchoolOption = {
  id: number;
  name: string;
  region: string | null;
  heiType: string | null;
  heiCode: string | null;
};
const SCHOOL_OPTIONS_EVENT = "veritas-school-options-updated";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [newSchool, setNewSchool] = useState("");
  const [region, setRegion] = useState("");
  const [heiType, setHeiType] = useState("");
  const [heiCode, setHeiCode] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolOption | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !deleteBusy && !schoolToDelete) onClose();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, busy, deleteBusy, schoolToDelete]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/schools", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load schools.");
        if (active) setSchools(data.schools ?? []);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load schools.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetForm() {
    setNewSchool("");
    setRegion("");
    setHeiType("");
    setHeiCode("");
    setEditingId(null);
  }

  async function saveSchool(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId === null ? {} : { id: editingId }),
          name: newSchool,
          region,
          heiType,
          heiCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add the school.");
      const school = data.school as SchoolOption;
      setSchools((current) => [...current.filter((item) => item.id !== school.id), school].sort((a, b) => a.name.localeCompare(b.name)));
      resetForm();
      window.dispatchEvent(new Event(SCHOOL_OPTIONS_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the school.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSchool() {
    if (!schoolToDelete || !deletePassword) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/schools", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: schoolToDelete.id, password: deletePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not remove the school.");
      setSchools((current) => current.filter((item) => item.id !== schoolToDelete.id));
      setSchoolToDelete(null);
      setDeletePassword("");
      window.dispatchEvent(new Event(SCHOOL_OPTIONS_EVENT));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not remove the school.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] overflow-y-auto">
      <button
        type="button"
        aria-label="Close settings"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => { if (!busy && !deleteBusy) onClose(); }}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 id="settings-title" className="text-lg font-semibold tracking-tight text-slate-900">Settings</h2>
              <p className="mt-1 text-sm text-slate-500">Manage shared school and HEI options.</p>
            </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy || deleteBusy}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                onClick={onClose}
              >
                ×
              </button>
          </header>

          <div className="border-b border-slate-100 px-6 pt-4">
            <div role="tablist" aria-label="Settings sections">
              <button
                type="button"
                id="settings-school-tab"
                role="tab"
                aria-selected="true"
                aria-controls="settings-school-panel"
                className="border-b-2 border-indigo-600 px-1 pb-3 text-sm font-medium text-indigo-700"
              >
                School / HEI
              </button>
            </div>
          </div>

          <div
            id="settings-school-panel"
            role="tabpanel"
            aria-labelledby="settings-school-tab"
            className="space-y-5 px-6 py-5"
          >
            <form onSubmit={saveSchool} className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900">{editingId === null ? "Add school / HEI" : "Edit school / HEI"}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="settings-school-region"
                  label="Region"
                  value={region}
                  required
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="" disabled>Select a region</option>
                  {PH_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
                <Input
                  id="settings-school-code"
                  label="HEI code"
                  value={heiCode}
                  maxLength={40}
                  required
                  onChange={(e) => setHeiCode(e.target.value)}
                  placeholder="Institution code"
                />
              </div>
              <Select
                id="settings-school-type"
                label="HEI type"
                value={heiType}
                required
                onChange={(e) => setHeiType(e.target.value)}
              >
                <option value="" disabled>Select an HEI type</option>
                {HEI_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Input
                id="settings-new-school"
                label="School / HEI name"
                value={newSchool}
                maxLength={120}
                required
                onChange={(e) => setNewSchool(e.target.value)}
                placeholder="Institution name"
              />
              <div className="mt-1 flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={busy || !newSchool.trim()}>
                  {busy ? "Saving…" : editingId === null ? "Add school / HEI" : "Save changes"}
                </Button>
                {editingId !== null ? <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>Cancel edit</Button> : null}
              </div>
            </form>

            {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">School / HEI list</h3>
              {loading ? (
                <p className="mt-3 text-sm text-slate-500">Loading schools…</p>
              ) : schools.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No schools / HEIs added yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {schools.map((school) => (
                    <li key={school.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{school.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[school.region, school.heiType, school.heiCode ? `Code: ${school.heiCode}` : null].filter(Boolean).join(" · ") || "Details not set"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => {
                          setEditingId(school.id);
                          setNewSchool(school.name);
                          setRegion(school.region ?? "");
                          setHeiType(school.heiType ?? "");
                          setHeiCode(school.heiCode ?? "");
                          setError(null);
                        }}>Edit HEI</Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => { setSchoolToDelete(school); setDeletePassword(""); setDeleteError(null); }}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
      {schoolToDelete ? (
        <ConfirmModal
          title="Remove school / HEI?"
          message={`Remove “${schoolToDelete.name}” from the selectable list? Existing instructor profiles will keep this value.`}
          confirmLabel="Remove"
          variant="danger"
          busy={deleteBusy}
          confirmDisabled={!deletePassword}
          error={deleteError}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          onConfirm={() => void deleteSchool()}
          onClose={() => { setSchoolToDelete(null); setDeletePassword(""); setDeleteError(null); }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
