"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconDownload } from "@/components/icons";

export default function ExportButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const examId = params.id as string;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function exportCSV(type: "leaderboard" | "students") {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("page");
    const qs = sp.toString();
    const url = `/api/admin/exams/${examId}/report/export?type=${type}${qs ? `&${qs}` : ""}`;
    router.push(url);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative print:hidden">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export"
      >
        <IconDownload />
        <span className="hidden sm:inline">Export</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => exportCSV("leaderboard")}
          >
            Leaderboard (CSV)
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => exportCSV("students")}
          >
            Students (CSV)
          </button>
        </div>
      ) : null}
    </div>
  );
}
