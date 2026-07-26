import { adbShell } from "./adb.js";
import type { MemInfoResult } from "./types.js";

const SUMMARY_LABELS = [
  "Java Heap",
  "Native Heap",
  "Code",
  "Stack",
  "Graphics",
  "Private Other",
  "System",
  "Unknown",
];

function parseAppSummary(lines: string[]): Record<string, number> {
  const startIndex = lines.findIndex((line) => line.trim() === "App Summary");
  if (startIndex === -1) {
    return {};
  }

  const summary: Record<string, number> = {};
  for (const label of SUMMARY_LABELS) {
    const line = lines
      .slice(startIndex)
      .find((candidate) => candidate.trim().startsWith(`${label}:`));
    if (!line) {
      continue;
    }
    const numbers = line
      .trim()
      .slice(label.length + 1)
      .trim()
      .split(/\s+/)
      .filter((token) => /^\d+$/.test(token));
    if (numbers[0]) {
      summary[label] = parseInt(numbers[0], 10);
    }
  }
  return summary;
}

function parseTotals(lines: string[]): {
  totalPssKb: number;
  totalRssKb: number;
  totalSwapPssKb: number;
} {
  const totalsLine = lines.find((line) => line.includes("TOTAL PSS:"));
  const match = totalsLine
    ? /TOTAL PSS:\s*(\d+)\s+TOTAL RSS:\s*(\d+)\s+TOTAL SWAP PSS:\s*(\d+)/.exec(totalsLine)
    : null;
  return {
    totalPssKb: match?.[1] ? parseInt(match[1], 10) : 0,
    totalRssKb: match?.[2] ? parseInt(match[2], 10) : 0,
    totalSwapPssKb: match?.[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Captures and parses `dumpsys meminfo <package>` — Android's per-app
 * memory breakdown (Java heap, native heap, graphics, code, totals).
 */
export async function captureMemInfo(serial: string, packageName: string): Promise<MemInfoResult> {
  const output = await adbShell(serial, ["dumpsys", "meminfo", packageName]);
  const lines = output.split("\n");
  const summary = parseAppSummary(lines);
  const totals = parseTotals(lines);

  return {
    packageName,
    javaHeapPssKb: summary["Java Heap"] ?? 0,
    nativeHeapPssKb: summary["Native Heap"] ?? 0,
    codePssKb: summary["Code"] ?? 0,
    stackPssKb: summary["Stack"] ?? 0,
    graphicsPssKb: summary["Graphics"] ?? 0,
    privateOtherPssKb: summary["Private Other"] ?? 0,
    systemPssKb: summary["System"] ?? 0,
    ...totals,
  };
}
