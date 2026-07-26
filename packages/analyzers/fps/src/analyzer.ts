import type { Analyzer } from "@rn-devtools/core";
import type { GfxInfoResult } from "@rn-devtools/collector-android";
import type { Finding, Severity } from "@rn-devtools/shared";

export interface FpsAnalyzerOptions {
  /** Janky-frame percentage at/above which a warning fires (critical at 2x this). */
  readonly jankyPercentWarning?: number;
  /** Frame budget in ms (16.6 for 60fps, 11.1 for 90fps) used to judge percentile frame times. */
  readonly frameBudgetMs?: number;
  readonly missedVsyncWarning?: number;
  readonly highInputLatencyWarning?: number;
}

const DEFAULT_OPTIONS: Required<FpsAnalyzerOptions> = {
  jankyPercentWarning: 10,
  frameBudgetMs: 16.6,
  missedVsyncWarning: 1,
  highInputLatencyWarning: 1,
};

function severityForRatio(value: number, warningAt: number): Severity {
  if (value >= warningAt * 2) {
    return "critical";
  }
  if (value >= warningAt) {
    return "warning";
  }
  return "info";
}

/** Analyzes Android's `dumpsys gfxinfo` per-app frame stats for jank and rendering-budget breaches. */
export class FpsAnalyzer implements Analyzer<GfxInfoResult> {
  readonly id = "fps";

  private readonly options: Required<FpsAnalyzerOptions>;

  constructor(options: FpsAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(result: GfxInfoResult): Finding[] {
    const findings: Finding[] = [];

    if (result.totalFrames === 0) {
      findings.push({
        id: "fps.no-frames",
        severity: "info",
        category: "fps",
        title: "No frames rendered",
        message: `No frames were recorded for "${result.packageName}" in this window — the app may be idle or backgrounded.`,
        evidence: { packageName: result.packageName },
      });
      return findings;
    }

    if (result.jankyFramePercent >= this.options.jankyPercentWarning) {
      findings.push({
        id: "fps.janky-frames",
        severity: severityForRatio(result.jankyFramePercent, this.options.jankyPercentWarning),
        category: "fps",
        title: "Janky frames detected",
        message: `${result.jankyFrameCount} of ${result.totalFrames} frames (${result.jankyFramePercent.toFixed(1)}%) were janky — at or above the ${this.options.jankyPercentWarning}% threshold.`,
        evidence: {
          jankyFrameCount: result.jankyFrameCount,
          totalFrames: result.totalFrames,
          jankyFramePercent: result.jankyFramePercent,
        },
      });
    }

    for (const [label, ms] of Object.entries(result.percentileFrameTimesMs)) {
      if (ms > this.options.frameBudgetMs) {
        findings.push({
          id: `fps.percentile-over-budget.${label.replace(/\s+/g, "-")}`,
          severity: ms > this.options.frameBudgetMs * 2 ? "critical" : "warning",
          category: "fps",
          title: `${label} frame time over budget`,
          message: `${label} frame time is ${ms}ms, above the ${this.options.frameBudgetMs}ms frame budget.`,
          evidence: { percentile: label, ms, frameBudgetMs: this.options.frameBudgetMs },
        });
      }
    }

    if (result.missedVsyncCount >= this.options.missedVsyncWarning) {
      findings.push({
        id: "fps.missed-vsync",
        severity: "warning",
        category: "fps",
        title: "Missed vsync",
        message: `${result.missedVsyncCount} frame(s) missed vsync — the UI thread or render thread fell behind the display's refresh signal.`,
        evidence: { missedVsyncCount: result.missedVsyncCount },
      });
    }

    if (result.highInputLatencyCount >= this.options.highInputLatencyWarning) {
      findings.push({
        id: "fps.high-input-latency",
        severity: "warning",
        category: "fps",
        title: "High input latency",
        message: `${result.highInputLatencyCount} frame(s) had high input latency, which can make touch interactions feel sluggish.`,
        evidence: { highInputLatencyCount: result.highInputLatencyCount },
      });
    }

    return findings;
  }
}
