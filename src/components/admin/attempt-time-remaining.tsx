"use client";

import { Badge } from "@/app/ui";
import { useNow } from "@/lib/use-now";

const MINUTE_MS = 60 * 1000;

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Time left for an in-progress attempt, ticking off the shared clock
 * (`useNow`) so a full roster shares one interval. Renders nothing until the
 * client clock is available, which keeps hydration deterministic.
 */
export default function AttemptTimeRemaining({
  startedAt,
  durationMinutes,
}: {
  startedAt: Date | null;
  durationMinutes: number;
}) {
  const now = useNow();

  if (!startedAt || now === 0 || durationMinutes <= 0) return null;

  const remaining =
    new Date(startedAt).getTime() + durationMinutes * MINUTE_MS - now;

  if (remaining <= 0) {
    return <Badge variant="danger">Expired</Badge>;
  }
  return (
    <Badge variant={remaining <= MINUTE_MS ? "warning" : "slate"}>
      {formatTimeRemaining(remaining)}
      <span className="hidden sm:inline"> left</span>
    </Badge>
  );
}
