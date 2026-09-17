import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Webcam snapshot proctoring.
 *
 * Images are stored on the filesystem under a data root (VERITAS_DATA_DIR or
 * ./data) as `snapshots/<attemptId>/<capturedAt>-<rand>.jpg`, and only a
 * relative `path` is persisted in SQLite so the DB stays small. Files are never
 * served from `public/` — admins read them through an authenticated API route.
 */

export const SNAPSHOT_INTERVAL_MS = 10_000;
export const SNAPSHOT_MAX_BATCH = 6;
export const SNAPSHOT_MAX_BYTES = 512 * 1024;
export const SNAPSHOT_MIN_GAP_MS = 3_000;

export function snapshotRoot(): string {
  return path.join(
    process.env.VERITAS_DATA_DIR ??
      path.join(process.cwd(), "data"),
    "snapshots"
  );
}

/**
 * Resolves a stored relative path to an absolute path, refusing anything that
 * escapes the snapshots root (path traversal guard).
 */
export function snapshotPath(relativePath: string): string {
  const child = path.normalize(relativePath);
  const root = path.normalize(snapshotRoot());
  const joined = path.join(root, child);
  if (joined !== root && !joined.startsWith(root + path.sep)) {
    throw new Error("Invalid snapshot path");
  }
  return joined;
}

export async function saveSnapshot(
  attemptId: number,
  buffer: Buffer,
  capturedAt: Date
): Promise<string> {
  const dir = path.join(snapshotRoot(), String(attemptId));
  await fs.promises.mkdir(dir, { recursive: true });
  const stamp = Math.max(0, capturedAt.getTime());
  const fileName = `${stamp}-${crypto.randomBytes(4).toString("hex")}.jpg`;
  const absolute = path.join(dir, fileName);
  await fs.promises.writeFile(absolute, buffer);
  return path.relative(snapshotRoot(), absolute).split("\\").join("/");
}

export function isSnapshotFile(fileName: string): boolean {
  return /\.(jpe?g)$/i.test(fileName);
}

export async function deleteSnapshotFiles(paths: string[]): Promise<void> {
  await Promise.allSettled(
    paths.map(async (relative) => {
      try {
        await fs.promises.unlink(snapshotPath(relative));
      } catch {
        // missing files are fine — the row is gone either way
      }
    })
  );
  for (const relative of paths) {
    try {
      const dir = path.dirname(snapshotPath(relative));
      if (dir !== path.normalize(snapshotRoot())) {
        await fs.promises.rmdir(dir).catch(() => {});
      }
    } catch {
      // best-effort directory cleanup
    }
  }
}

/**
 * Removes every stored file for an attempt by listing the DB rows and also
 * removing the attempt folder wholesale (covers orphaned files too).
 */
export async function deleteAttemptSnapshots(attemptId: number): Promise<void> {
  const dir = path.join(snapshotRoot(), String(attemptId));
  await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
}