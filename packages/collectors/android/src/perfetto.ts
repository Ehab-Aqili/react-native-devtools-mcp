import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { adbPull, adbShellRaw } from "./adb.js";
import type { PerfettoTraceResult } from "./types.js";

const PERFETTO_CATEGORIES = [
  "sched",
  "freq",
  "idle",
  "am",
  "wm",
  "gfx",
  "view",
  "binder_driver",
  "hal",
  "input",
  "res",
  "memory",
];

/**
 * Captures a short system-wide Perfetto trace on-device and pulls it to
 * disk. Like heap snapshots, only a handle + byte size is returned — the
 * trace itself is a binary protobuf, deferred to dedicated analysis.
 */
export async function capturePerfettoTrace(
  serial: string,
  dataDir: string,
  durationMs = 5000,
): Promise<PerfettoTraceResult> {
  const start = Date.now();
  const durationSec = Math.max(1, Math.round(durationMs / 1000));
  const remotePath = `/data/misc/perfetto-traces/rn-devtools-${start}.perfetto-trace`;

  await adbShellRaw(serial, [
    "perfetto",
    "-o",
    remotePath,
    "-t",
    `${durationSec}s`,
    ...PERFETTO_CATEGORIES,
  ]);

  const dir = join(dataDir, "perfetto-traces");
  await mkdir(dir, { recursive: true });
  const handleId = `perfetto-${start}`;
  const localPath = join(dir, `${handleId}.perfetto-trace`);
  await adbPull(serial, remotePath, localPath);
  await adbShellRaw(serial, ["rm", remotePath]);

  const stats = await stat(localPath);

  return {
    handleId,
    filePath: localPath,
    byteSize: stats.size,
    durationMs: Date.now() - start,
  };
}
