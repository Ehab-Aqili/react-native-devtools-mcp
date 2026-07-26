import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CdpClient } from "./cdp-client.js";
import type { HeapSnapshotResult } from "./types.js";

const HEAP_SNAPSHOT_TIMEOUT_MS = 120_000;

/**
 * Streams `HeapProfiler.addHeapSnapshotChunk` events straight to disk as they
 * arrive rather than buffering the (often huge) snapshot in process memory.
 * Only a handle + byte size is returned — deep analysis reads the file later.
 */
export async function captureHeapSnapshot(
  cdp: CdpClient,
  dataDir: string,
): Promise<HeapSnapshotResult> {
  const dir = join(dataDir, "heap-snapshots");
  await mkdir(dir, { recursive: true });

  const handleId = `heap-${Date.now()}`;
  const filePath = join(dir, `${handleId}.heapsnapshot`);
  const stream = createWriteStream(filePath, { encoding: "utf8" });

  let chunkCount = 0;
  let byteSize = 0;

  const unsubscribe = cdp.on("HeapProfiler.addHeapSnapshotChunk", (params) => {
    const { chunk } = params as { chunk: string };
    chunkCount += 1;
    byteSize += Buffer.byteLength(chunk, "utf8");
    stream.write(chunk);
  });

  const start = Date.now();
  try {
    // Hermes's inspector does not implement "HeapProfiler.enable" — the
    // command works directly without it.
    await cdp.send(
      "HeapProfiler.takeHeapSnapshot",
      { reportProgress: false, captureNumericValue: false },
      HEAP_SNAPSHOT_TIMEOUT_MS,
    );
  } finally {
    unsubscribe();
    stream.end();
  }
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return {
    action: "heap_snapshot",
    handleId,
    filePath,
    byteSize,
    chunkCount,
    durationMs: Date.now() - start,
  };
}
