import { adbShell } from "./adb.js";
import type { GfxInfoResult } from "./types.js";

const NUMBER_FIELDS: Record<string, keyof GfxInfoResult> = {
  "Total frames rendered": "totalFrames",
  "Number Missed Vsync": "missedVsyncCount",
  "Number High input latency": "highInputLatencyCount",
  "Number Slow UI thread": "slowUiThreadCount",
  "Number Frame deadline missed": "frameDeadlineMissedCount",
};

function parseIntSafe(text: string): number {
  const match = /(-?\d+)/.exec(text.replace(/,/g, ""));
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

function parseJankyLine(line: string): { count: number; percent: number } | undefined {
  // "Janky frames: 5 (4.24%)"
  const match = /Janky frames:\s*(\d+)\s*\(([\d.]+)%\)/.exec(line);
  if (!match || !match[1] || !match[2]) {
    return undefined;
  }
  return { count: parseInt(match[1], 10), percent: parseFloat(match[2]) };
}

function parsePercentileLine(line: string): { label: string; ms: number } | undefined {
  // "50th percentile: 9ms"
  const match = /^(\d+(?:st|nd|rd|th) percentile):\s*(\d+)ms/.exec(line.trim());
  if (!match || !match[1] || !match[2]) {
    return undefined;
  }
  return { label: match[1], ms: parseInt(match[2], 10) };
}

/**
 * Captures and parses `dumpsys gfxinfo <package>` — Android's built-in
 * per-app frame timing stats (jank %, percentile frame times, missed vsync).
 */
export async function captureGfxInfo(serial: string, packageName: string): Promise<GfxInfoResult> {
  const output = await adbShell(serial, ["dumpsys", "gfxinfo", packageName]);
  const lines = output.split("\n");

  const numberFields: Record<string, number> = {};
  const percentiles: Record<string, number> = {};
  let jankyFrameCount = 0;
  let jankyFramePercent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const janky = parseJankyLine(line);
    if (janky) {
      jankyFrameCount = janky.count;
      jankyFramePercent = janky.percent;
      continue;
    }
    const percentile = parsePercentileLine(line);
    if (percentile) {
      percentiles[percentile.label] = percentile.ms;
      continue;
    }
    for (const [prefix, field] of Object.entries(NUMBER_FIELDS)) {
      // Exact match only — several of these have a "(legacy)" sibling line
      // sharing the same prefix (e.g. "Number Frame deadline missed" vs
      // "Number Frame deadline missed (legacy)"), which a plain
      // `startsWith` would conflate.
      if (line.startsWith(`${prefix}:`)) {
        numberFields[field] = parseIntSafe(line.slice(prefix.length));
      }
    }
  }

  return {
    packageName,
    totalFrames: numberFields.totalFrames ?? 0,
    jankyFrameCount,
    jankyFramePercent,
    missedVsyncCount: numberFields.missedVsyncCount ?? 0,
    highInputLatencyCount: numberFields.highInputLatencyCount ?? 0,
    slowUiThreadCount: numberFields.slowUiThreadCount ?? 0,
    frameDeadlineMissedCount: numberFields.frameDeadlineMissedCount ?? 0,
    percentileFrameTimesMs: percentiles,
  };
}
