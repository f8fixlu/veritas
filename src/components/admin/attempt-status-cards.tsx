"use client";

import { useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCirclePlay,
  IconCircleSlash,
  IconPercent,
  IconTrophy,
  IconUsers,
} from "@/components/icons";

type Counts = {
  enrolled: number;
  completed: number;
  inProgress: number;
  notStarted: number;
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="text-indigo-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Live report summary. Polls the exam status endpoint every 5s so the
 * Enrolled / Completed / In progress / Not started counts update without a
 * manual page refresh. Average and Best score are stable once students finish
 * and are kept server-rendered.
 */
export default function LiveStatusCards({
  examId,
  initial,
  avgPct,
  bestPct,
}: {
  examId: number;
  initial: Counts;
  avgPct: number | null;
  bestPct: number | null;
}) {
  const [counts, setCounts] = useState<Counts>(initial);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/admin/exams/${examId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCounts({
          enrolled: data.enrolled ?? initial.enrolled,
          completed: data.completed ?? initial.completed,
          inProgress: data.inProgress ?? initial.inProgress,
          notStarted: data.notStarted ?? initial.notStarted,
        });
      } catch {
        // transient network error — retry on the next tick
      }
    }

    poll();
    const timer = setInterval(poll, 5000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [examId, initial.enrolled, initial.completed, initial.inProgress, initial.notStarted]);

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Enrolled" value={String(counts.enrolled)} icon={<IconUsers size={14} />} />
      <StatCard label="Completed" value={String(counts.completed)} icon={<IconCircleCheck size={14} />} />
      <StatCard label="In progress" value={String(counts.inProgress)} icon={<IconCirclePlay size={14} />} />
      <StatCard label="Not started" value={String(counts.notStarted)} icon={<IconCircleSlash size={14} />} />
      <StatCard label="Average score" value={avgPct === null ? "—" : `${avgPct}%`} icon={<IconPercent size={14} />} />
      <StatCard label="Best score" value={bestPct === null ? "—" : `${bestPct}%`} icon={<IconTrophy size={14} />} />
    </div>
  );
}
