import type { Analyzer } from "@rn-devtools/core";
import type {
  CommitProfileResult,
  FiberNode,
  FiberTreeResult,
} from "@rn-devtools/collector-react-devtools";
import type { Finding } from "@rn-devtools/shared";

export interface RenderAnalyzerOptions {
  /** A single component render at or above this duration (ms) is flagged. */
  readonly slowRenderThresholdMs?: number;
  /** How many slow-render findings to report at most, worst first. */
  readonly maxFindings?: number;
}

const DEFAULT_OPTIONS: Required<RenderAnalyzerOptions> = {
  slowRenderThresholdMs: 16, // 60fps frame budget
  maxFindings: 15,
};

interface SlowNode {
  readonly name: string;
  readonly key: string | null;
  readonly actualDuration: number;
  readonly path: string;
}

function collectSlowNodes(
  node: FiberNode | null,
  path: string,
  threshold: number,
  out: SlowNode[],
): void {
  if (!node) {
    return;
  }
  const currentPath = path ? `${path} > ${node.name}` : node.name;
  if ((node.actualDuration ?? 0) >= threshold) {
    out.push({
      name: node.name,
      key: node.key,
      actualDuration: node.actualDuration ?? 0,
      path: currentPath,
    });
  }
  for (const child of node.children) {
    collectSlowNodes(child, currentPath, threshold, out);
  }
}

/**
 * Flags individual component renders that exceed the frame budget within a
 * single fiber tree snapshot. Detecting *wasted* renders (same props,
 * re-rendered anyway) needs two snapshots taken across a commit boundary —
 * out of scope for a single-tree analyzer; this only flags renders that were
 * simply slow.
 */
export class RenderTreeAnalyzer implements Analyzer<FiberTreeResult> {
  readonly id = "render-tree";

  private readonly options: Required<RenderAnalyzerOptions>;

  constructor(options: RenderAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(result: FiberTreeResult): Finding[] {
    const findings: Finding[] = [];

    if (result.truncated) {
      findings.push({
        id: "render.tree-truncated",
        severity: "info",
        category: "render",
        title: "Fiber tree truncated",
        message: `Only ${result.nodeCount} nodes were walked before hitting the capture cap — some components may be missing from this analysis.`,
        evidence: { nodeCount: result.nodeCount },
      });
    }

    for (const tree of result.trees) {
      const slowNodes: SlowNode[] = [];
      collectSlowNodes(tree, "", this.options.slowRenderThresholdMs, slowNodes);
      slowNodes.sort((a, b) => b.actualDuration - a.actualDuration);

      for (const node of slowNodes.slice(0, this.options.maxFindings)) {
        findings.push({
          id: `render.slow-render.${node.path}`,
          severity:
            node.actualDuration >= this.options.slowRenderThresholdMs * 2 ? "warning" : "info",
          category: "render",
          title: `Slow render: ${node.name}`,
          message: `"${node.name}" took ${node.actualDuration.toFixed(2)}ms to render, above the ${this.options.slowRenderThresholdMs}ms budget.`,
          location: node.path,
          evidence: { name: node.name, key: node.key, actualDurationMs: node.actualDuration },
        });
      }
    }

    return findings;
  }
}

export interface CommitProfileAnalyzerOptions {
  readonly slowComponentThresholdMs?: number;
}

const DEFAULT_COMMIT_OPTIONS: Required<CommitProfileAnalyzerOptions> = {
  slowComponentThresholdMs: 16,
};

/** Lighter-weight counterpart consuming the `commit_profile` capture's flat "slowest components" list. */
export class CommitProfileAnalyzer implements Analyzer<CommitProfileResult> {
  readonly id = "render-commit";

  private readonly options: Required<CommitProfileAnalyzerOptions>;

  constructor(options: CommitProfileAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_COMMIT_OPTIONS, ...options };
  }

  analyze(result: CommitProfileResult): Finding[] {
    const findings: Finding[] = [];

    for (const root of result.roots) {
      if (root.rootActualDuration >= this.options.slowComponentThresholdMs) {
        findings.push({
          id: `render.slow-commit.${root.rootActualDuration}`,
          severity: "warning",
          category: "render",
          title: "Slow commit",
          message: `This commit's root render took ${root.rootActualDuration.toFixed(2)}ms across ${root.nodeCount} components.`,
          evidence: { rootActualDurationMs: root.rootActualDuration, nodeCount: root.nodeCount },
        });
      }

      for (const component of root.slowestComponents) {
        if (component.actualDuration >= this.options.slowComponentThresholdMs) {
          findings.push({
            id: `render.slow-component.${component.name}`,
            severity: "info",
            category: "render",
            title: `Slow component: ${component.name}`,
            message: `"${component.name}" self-rendered for ${component.actualDuration.toFixed(2)}ms in this commit.`,
            evidence: { name: component.name, actualDurationMs: component.actualDuration },
          });
        }
      }
    }

    return findings;
  }
}
