import type { Finding, Severity } from "@rn-devtools/shared";
import type { ReportInput, ReportSection } from "./types.js";

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity]);
}

function summarize(findings: Finding[]): string {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;
  return `${critical} critical, ${warning} warning, ${info} info`;
}

export interface BuildReportOptions {
  readonly subtitle?: string;
  /** Groups findings into one section per `category` instead of a single section. */
  readonly groupByCategory?: boolean;
  readonly generatedAt?: string;
}

/** Builds a `ReportInput` from a flat list of findings — the common case for analyzer/tool output. */
export function buildReportFromFindings(
  title: string,
  findings: Finding[],
  options: BuildReportOptions = {},
): ReportInput {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  let sections: ReportSection[];

  if (options.groupByCategory) {
    const byCategory = new Map<string, Finding[]>();
    for (const finding of findings) {
      const bucket = byCategory.get(finding.category) ?? [];
      bucket.push(finding);
      byCategory.set(finding.category, bucket);
    }
    sections = [...byCategory.entries()].map(([category, categoryFindings]) => ({
      title: category,
      summary: summarize(categoryFindings),
      findings: sortFindings(categoryFindings),
    }));
  } else {
    sections = [
      {
        title: "Findings",
        summary: summarize(findings),
        findings: sortFindings(findings),
      },
    ];
  }

  return {
    title,
    generatedAt,
    ...(options.subtitle !== undefined && { subtitle: options.subtitle }),
    sections,
  };
}
