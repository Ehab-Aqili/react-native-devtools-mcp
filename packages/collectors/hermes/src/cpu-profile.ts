import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CdpClient } from "./cdp-client.js";
import type { CpuProfileResult, CpuProfileTopFunction, RawCpuProfile } from "./types.js";

const DEFAULT_DURATION_MS = 3000;
const TOP_FUNCTIONS_LIMIT = 10;

/** Aggregates per-sample time deltas by node id to approximate self time. */
export function summarizeCpuProfile(profile: RawCpuProfile): {
  sampleCount: number;
  topFunctions: CpuProfileTopFunction[];
} {
  const nodeById = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfTimeByNode = new Map<number, number>();

  for (let i = 0; i < profile.samples.length; i++) {
    const nodeId = profile.samples[i];
    if (nodeId === undefined) {
      continue;
    }
    const deltaUs = profile.timeDeltas[i] ?? 0;
    selfTimeByNode.set(nodeId, (selfTimeByNode.get(nodeId) ?? 0) + deltaUs);
  }

  const totalDurationUs = profile.endTime - profile.startTime;
  const topFunctions = [...selfTimeByNode.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_FUNCTIONS_LIMIT)
    .map(([nodeId, selfTimeUs]) => {
      const node = nodeById.get(nodeId);
      return {
        functionName: node?.callFrame.functionName || "(anonymous)",
        url: node?.callFrame.url ?? "",
        lineNumber: node?.callFrame.lineNumber ?? -1,
        selfTimeMs: selfTimeUs / 1000,
        selfTimePercent: totalDurationUs > 0 ? (selfTimeUs / totalDurationUs) * 100 : 0,
      };
    });

  return { sampleCount: profile.samples.length, topFunctions };
}

export async function captureCpuProfile(
  cdp: CdpClient,
  dataDir: string,
  durationMs: number = DEFAULT_DURATION_MS,
): Promise<CpuProfileResult> {
  const dir = join(dataDir, "cpu-profiles");
  await mkdir(dir, { recursive: true });

  // Hermes's inspector does not implement "Profiler.enable" — start/stop
  // work directly without it.
  await cdp.send("Profiler.start");
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const { profile } = await cdp.send<{ profile: RawCpuProfile }>("Profiler.stop");

  const handleId = `cpu-${Date.now()}`;
  const filePath = join(dir, `${handleId}.cpuprofile`);
  await writeFile(filePath, JSON.stringify(profile), "utf8");

  const { sampleCount, topFunctions } = summarizeCpuProfile(profile);

  return {
    action: "cpu_profile",
    handleId,
    filePath,
    durationMs,
    sampleCount,
    topFunctions,
  };
}
