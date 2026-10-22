"use client";

import { useState } from "react";
import { CardHover } from "@/app/ui";
import { useSharedPoll } from "@/lib/use-shared-poll";
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
    <CardHover className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="text-indigo-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </CardHover>
  );
}

/**
 * Live report summary. Shares the exam-status poll (5s) with the roster's
 * start watchers so the Enrolled / Completed / In progress / Not started counts
 * update without a manual page refresh. Average and Best score are stable once
 * students finish and are kept server-rendered.
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

  useSharedPoll<Partial<Counts>>(
    `/api/admin/exams/${examId}/status`,
    5000,
    (data) => {
      setCounts((prev) => {
        const next: Counts = {
          enrolled: data.enrolled ?? prev.enrolled,
          completed: data.completed ?? prev.completed,
          inProgress: data.inProgress ?? prev.inProgress,
          notStarted: data.notStarted ?? prev.notStarted,
        };
        return prev.enrolled === next.enrolled &&
          prev.completed === next.completed &&
          prev.inProgress === next.inProgress &&
          prev.notStarted === next.notStarted
          ? prev
          : next;
      });
    }
  );

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Enrolled" value={String(counts.enrolled)} icon={<IconUsers size={24} />} />
      <StatCard label="Completed" value={String(counts.completed)} icon={<IconCircleCheck size={24} />} />
      <StatCard label="In progress" value={String(counts.inProgress)} icon={<IconCirclePlay size={24} />} />
      <StatCard label="Not started" value={String(counts.notStarted)} icon={<IconCircleSlash size={24} />} />
      <StatCard label="Average score" value={avgPct === null ? "—" : `${avgPct}%`} icon={<IconPercent size={24} />} />
      <StatCard label="Best score" value={bestPct === null ? "—" : `${bestPct}%`} icon={<IconTrophy size={24} />} />
    </div>
  );
}
