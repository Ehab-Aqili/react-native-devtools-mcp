import type { Finding } from "@rn-devtools/shared";
import { iterateNodes, type ParsedHeapSnapshot } from "./heap-snapshot-format.js";

export interface CompareHeapSnapshotsOptions {
  /** An object-name instance count growing by at least this many is flagged. */
  readonly minInstanceGrowth?: number;
  /** A node type's total size growing by at least this many bytes is flagged. */
  readonly minTypeSizeGrowthBytes?: number;
  readonly topGrowthLimit?: number;
}

const DEFAULT_OPTIONS: Required<CompareHeapSnapshotsOptions> = {
  minInstanceGrowth: 100,
  minTypeSizeGrowthBytes: 1024 * 1024,
  topGrowthLimit: 10,
};

function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? "-" : "+";
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) {
    return `${sign}${(abs / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (abs >= 1024) {
    return `${sign}${(abs / 1024).toFixed(1)}KB`;
  }
  return `${sign}${abs}B`;
}

function countByObjectName(snapshot: ParsedHeapSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of iterateNodes(snapshot)) {
    if (node.type === "object" && node.name) {
      counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
    }
  }
  return counts;
}

function totalSizeByType(snapshot: ParsedHeapSnapshot): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const node of iterateNodes(snapshot)) {
    sizes.set(node.type, (sizes.get(node.type) ?? 0) + node.selfSize);
  }
  return sizes;
}

/**
 * Compares two heap snapshots taken at different points in time — the
 * strongest signal for a real leak (an object count/size that keeps growing)
 * versus a single snapshot, which can only say "this is numerous right now".
 */
export function compareHeapSnapshots(
  before: ParsedHeapSnapshot,
  after: ParsedHeapSnapshot,
  options: CompareHeapSnapshotsOptions = {},
): Finding[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const findings: Finding[] = [];

  const beforeCounts = countByObjectName(before);
  const afterCounts = countByObjectName(after);
  const growth: Array<{ name: string; before: number; after: number; delta: number }> = [];

  for (const [name, afterCount] of afterCounts) {
    const beforeCount = beforeCounts.get(name) ?? 0;
    const delta = afterCount - beforeCount;
    if (delta >= opts.minInstanceGrowth) {
      growth.push({ name, before: beforeCount, after: afterCount, delta });
    }
  }
  growth.sort((a, b) => b.delta - a.delta);

  for (const entry of growth.slice(0, opts.topGrowthLimit)) {
    findings.push({
      id: `memory.instance-growth.${entry.name}`,
      severity: "warning",
      category: "memory",
      title: `Growing instance count: ${entry.name}`,
      message: `"${entry.name}" instances grew from ${entry.before} to ${entry.after} (+${entry.delta}) between the two snapshots — a strong leak signal if this keeps happening.`,
      evidence: { name: entry.name, before: entry.before, after: entry.after, delta: entry.delta },
    });
  }

  const beforeSizes = totalSizeByType(before);
  const afterSizes = totalSizeByType(after);
  for (const [type, afterSize] of afterSizes) {
    const beforeSize = beforeSizes.get(type) ?? 0;
    const delta = afterSize - beforeSize;
    if (delta >= opts.minTypeSizeGrowthBytes) {
      findings.push({
        id: `memory.type-size-growth.${type}`,
        severity: "info",
        category: "memory",
        title: `Growing "${type}" total size`,
        message: `Total self-size for "${type}" nodes grew by ${formatBytes(delta)} between the two snapshots.`,
        evidence: { type, beforeSize, afterSize, delta },
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: "memory.no-significant-growth",
      severity: "info",
      category: "memory",
      title: "No significant growth detected",
      message: "No object type or named instance grew enough between the two snapshots to flag.",
    });
  }

  return findings;
}
