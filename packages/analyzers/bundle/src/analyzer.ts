import type { Analyzer } from "@rn-devtools/core";
import type { Finding } from "@rn-devtools/shared";
import type { BundleStats } from "./types.js";

export interface BundleAnalyzerOptions {
  readonly largeBundleBytes?: number;
  readonly topModulesLimit?: number;
  /** A single module contributing at/above this fraction of the total bundle is flagged. */
  readonly heavyModuleShare?: number;
}

const DEFAULT_OPTIONS: Required<BundleAnalyzerOptions> = {
  largeBundleBytes: 10 * 1024 * 1024,
  topModulesLimit: 10,
  heavyModuleShare: 0.1,
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

/** Analyzes a bundle's module composition: overall size, largest modules, disproportionate contributors, duplicates. */
export class BundleAnalyzer implements Analyzer<BundleStats> {
  readonly id = "bundle";

  private readonly options: Required<BundleAnalyzerOptions>;

  constructor(options: BundleAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(stats: BundleStats): Finding[] {
    const findings: Finding[] = [];

    if (stats.totalSize >= this.options.largeBundleBytes) {
      findings.push({
        id: "bundle.large-bundle",
        severity: stats.totalSize >= this.options.largeBundleBytes * 2 ? "critical" : "warning",
        category: "bundle",
        title: "Large bundle size",
        message: `Total bundle size is ${formatBytes(stats.totalSize)}, above the ${formatBytes(this.options.largeBundleBytes)} threshold.`,
        evidence: { totalSize: stats.totalSize },
      });
    }

    const sortedModules = [...stats.modules].sort((a, b) => b.size - a.size);
    for (const module of sortedModules.slice(0, this.options.topModulesLimit)) {
      const share = stats.totalSize > 0 ? module.size / stats.totalSize : 0;
      if (share >= this.options.heavyModuleShare) {
        findings.push({
          id: `bundle.heavy-module.${module.path}`,
          severity: "warning",
          category: "bundle",
          title: `Disproportionately large module: ${module.path}`,
          message: `"${module.path}" is ${formatBytes(module.size)} — ${(share * 100).toFixed(1)}% of the total bundle.`,
          location: module.path,
          evidence: { path: module.path, size: module.size, share },
        });
      } else {
        findings.push({
          id: `bundle.large-module.${module.path}`,
          severity: "info",
          category: "bundle",
          title: `Large module: ${module.path}`,
          message: `"${module.path}" is ${formatBytes(module.size)} (${(share * 100).toFixed(1)}% of total).`,
          location: module.path,
          evidence: { path: module.path, size: module.size, share },
        });
      }
    }

    const pathCounts = new Map<string, number>();
    for (const module of stats.modules) {
      pathCounts.set(module.path, (pathCounts.get(module.path) ?? 0) + 1);
    }
    for (const [path, count] of pathCounts) {
      if (count > 1) {
        findings.push({
          id: `bundle.duplicate-module.${path}`,
          severity: "warning",
          category: "bundle",
          title: `Duplicate module entry: ${path}`,
          message: `"${path}" appears ${count} times in the bundle's module list — check for duplicate package installs (mismatched versions across the dependency tree).`,
          location: path,
          evidence: { path, count },
        });
      }
    }

    return findings;
  }
}
