import type { Analyzer } from "@rn-devtools/core";
import type { Finding } from "@rn-devtools/shared";
import {
  iterateNodes,
  type HeapNodeView,
  type ParsedHeapSnapshot,
} from "./heap-snapshot-format.js";

export interface MemoryAnalyzerOptions {
  /** Individual objects at or above this self size (bytes) are flagged. */
  readonly largeObjectBytes?: number;
  /** How many of the largest individual objects to report. */
  readonly topNodesLimit?: number;
  /** Same-named "object" nodes at or above this count are flagged as numerous. */
  readonly highInstanceCountThreshold?: number;
  /** Total heap self-size (bytes) above which a general "large heap" finding fires. */
  readonly largeHeapBytes?: number;
}

const DEFAULT_OPTIONS: Required<MemoryAnalyzerOptions> = {
  largeObjectBytes: 100 * 1024,
  topNodesLimit: 10,
  highInstanceCountThreshold: 500,
  largeHeapBytes: 150 * 1024 * 1024,
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

function insertTopNode(top: HeapNodeView[], node: HeapNodeView, limit: number): void {
  if (top.length < limit) {
    top.push(node);
    top.sort((a, b) => b.selfSize - a.selfSize);
    return;
  }
  const smallest = top[top.length - 1];
  if (smallest && node.selfSize > smallest.selfSize) {
    top[top.length - 1] = node;
    top.sort((a, b) => b.selfSize - a.selfSize);
  }
}

/**
 * Analyzes a parsed Hermes/V8 heap snapshot. Scope is deliberately limited to
 * what a single snapshot can tell you without a dominator-tree / retained-size
 * computation: largest individual objects, per-type size breakdown, and
 * unusually numerous same-named object instances. Growth-over-time (the
 * strongest leak signal) requires comparing two snapshots — a separate
 * "compare heaps" capability, not single-snapshot analysis.
 */
export class MemoryAnalyzer implements Analyzer<ParsedHeapSnapshot> {
  readonly id = "memory";

  private readonly options: Required<MemoryAnalyzerOptions>;

  constructor(options: MemoryAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(snapshot: ParsedHeapSnapshot): Finding[] {
    const findings: Finding[] = [];
    const typeSizes = new Map<string, { count: number; totalSize: number }>();
    const objectNameCounts = new Map<string, number>();
    const topNodes: HeapNodeView[] = [];
    let totalSelfSize = 0;

    for (const node of iterateNodes(snapshot)) {
      totalSelfSize += node.selfSize;

      const typeEntry = typeSizes.get(node.type) ?? { count: 0, totalSize: 0 };
      typeEntry.count += 1;
      typeEntry.totalSize += node.selfSize;
      typeSizes.set(node.type, typeEntry);

      if (node.type === "object" && node.name) {
        objectNameCounts.set(node.name, (objectNameCounts.get(node.name) ?? 0) + 1);
      }

      if (node.selfSize >= this.options.largeObjectBytes) {
        insertTopNode(topNodes, node, this.options.topNodesLimit);
      }
    }

    findings.push(this.buildTypeBreakdownFinding(typeSizes, totalSelfSize));

    if (totalSelfSize >= this.options.largeHeapBytes) {
      findings.push({
        id: "memory.large-heap",
        severity: "warning",
        category: "memory",
        title: "Large heap size",
        message: `Total heap self-size is ${formatBytes(totalSelfSize)}, above the ${formatBytes(this.options.largeHeapBytes)} threshold.`,
        evidence: { totalSelfSize },
      });
    }

    for (const node of topNodes) {
      findings.push({
        id: `memory.large-object.${node.id}`,
        severity: "info",
        category: "memory",
        title: `Large ${node.type} object: ${node.name || "(unnamed)"}`,
        message: `A single ${node.type} node named "${node.name || "(unnamed)"}" retains ${formatBytes(node.selfSize)} of self size.`,
        evidence: { nodeId: node.id, type: node.type, name: node.name, selfSize: node.selfSize },
      });
    }

    for (const [name, count] of objectNameCounts) {
      if (count >= this.options.highInstanceCountThreshold) {
        findings.push({
          id: `memory.high-instance-count.${name}`,
          severity: "warning",
          category: "memory",
          title: `Numerous "${name}" instances`,
          message: `${count} object instances named "${name}" exist in this snapshot — worth checking for an accumulation/leak if this count keeps growing across snapshots.`,
          evidence: { name, count },
        });
      }
    }

    return findings;
  }

  private buildTypeBreakdownFinding(
    typeSizes: Map<string, { count: number; totalSize: number }>,
    totalSelfSize: number,
  ): Finding {
    const topTypes = [...typeSizes.entries()]
      .sort((a, b) => b[1].totalSize - a[1].totalSize)
      .slice(0, 5)
      .map(([type, stats]) => `${type}: ${formatBytes(stats.totalSize)} (${stats.count} nodes)`);

    return {
      id: "memory.type-breakdown",
      severity: "info",
      category: "memory",
      title: "Heap breakdown by node type",
      message: `Total self-size ${formatBytes(totalSelfSize)}. Largest contributors — ${topTypes.join("; ")}.`,
      evidence: {
        totalSelfSize,
        byType: Object.fromEntries([...typeSizes.entries()].map(([type, stats]) => [type, stats])),
      },
    };
  }
}
