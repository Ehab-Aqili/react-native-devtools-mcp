import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { InstrumentsTraceResult } from "./types.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_TEMPLATE = "Activity Monitor";

async function directorySize(path: string): Promise<number> {
  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
    } else if (entry.isFile()) {
      total += (await stat(entryPath)).size;
    }
  }
  return total;
}

function parseFmtNumbers(xml: string, tagName: string): number[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\bfmt="([\\d.]+)`, "g");
  const values: number[] = [];
  for (const match of xml.matchAll(pattern)) {
    if (match[1]) {
      values.push(parseFloat(match[1]));
    }
  }
  return values;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

interface CpuMemorySummary {
  readonly cpuPercentAvg: number;
  readonly cpuPercentMax: number;
  readonly memoryMiBAvg: number;
  readonly memoryMiBMax: number;
  readonly sampleCount: number;
}

/**
 * Best-effort summary from the "sysmon-process" table, which only the
 * "Activity Monitor" template records. Uses the trace's pre-formatted `fmt`
 * attributes (already human-readable, e.g. `fmt="2.5%"`) rather than fully
 * resolving the XML's id/ref value-sharing scheme — cheap and reliable
 * enough for a summary since deep trace analysis is out of scope here.
 */
async function summarizeSysmonProcess(tracePath: string): Promise<CpuMemorySummary | undefined> {
  let xml: string;
  try {
    const { stdout } = await execFileAsync(
      "xcrun",
      [
        "xctrace",
        "export",
        "--input",
        tracePath,
        "--xpath",
        '/trace-toc/run[@number="1"]/data/table[@schema="sysmon-process"]',
      ],
      { maxBuffer: MAX_BUFFER },
    );
    xml = stdout;
  } catch {
    return undefined;
  }

  const cpuValues = parseFmtNumbers(xml, "system-cpu-percent");
  const memoryValuesMiB = parseFmtNumbers(xml, "memory-physical-footprint");
  if (cpuValues.length === 0 && memoryValuesMiB.length === 0) {
    return undefined;
  }

  return {
    cpuPercentAvg: average(cpuValues),
    cpuPercentMax: cpuValues.length ? Math.max(...cpuValues) : 0,
    memoryMiBAvg: average(memoryValuesMiB),
    memoryMiBMax: memoryValuesMiB.length ? Math.max(...memoryValuesMiB) : 0,
    sampleCount: Math.max(cpuValues.length, memoryValuesMiB.length),
  };
}

export interface RecordTraceOptions {
  readonly deviceUdid: string;
  readonly processName: string;
  readonly dataDir?: string;
  readonly template?: string;
  readonly durationMs?: number;
}

/**
 * Records a short Instruments trace against a running process (simulator or
 * physical device) via `xctrace record --attach`. Only a handle + byte size
 * + best-effort CPU/memory summary is returned — the `.trace` bundle itself
 * is a directory of proprietary binary formats, not meant to be inlined.
 */
export async function recordInstrumentsTrace(
  options: RecordTraceOptions,
): Promise<InstrumentsTraceResult> {
  const template = options.template ?? DEFAULT_TEMPLATE;
  const durationMs = options.durationMs ?? 3000;
  const dataDir = options.dataDir ?? ".rn-devtools";

  const dir = join(dataDir, "ios-traces");
  await mkdir(dir, { recursive: true });
  const handleId = `ios-trace-${Date.now()}`;
  const outputPath = join(dir, `${handleId}.trace`);

  const start = Date.now();
  await execFileAsync(
    "xcrun",
    [
      "xctrace",
      "record",
      "--template",
      template,
      "--device",
      options.deviceUdid,
      "--attach",
      options.processName,
      "--time-limit",
      `${Math.max(1, Math.round(durationMs / 1000))}s`,
      "--output",
      outputPath,
      "--no-prompt",
    ],
    { maxBuffer: MAX_BUFFER },
  );
  const durationMsActual = Date.now() - start;

  const byteSize = await directorySize(outputPath);
  const summary = await summarizeSysmonProcess(outputPath);

  return {
    handleId,
    filePath: outputPath,
    byteSize,
    durationMs: durationMsActual,
    template,
    ...(summary !== undefined && { summary }),
  };
}
