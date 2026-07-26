import type { Finding } from "@rn-devtools/shared";
import type { ReportInput, ReportSection } from "./types.js";

function renderFinding(finding: Finding): string {
  const lines = [
    `- **[${finding.severity.toUpperCase()}] ${finding.title}**`,
    `  ${finding.message}`,
  ];
  if (finding.location) {
    lines.push(`  Location: \`${finding.location}\``);
  }
  return lines.join("\n");
}

function renderDataTable(data: Record<string, unknown>): string {
  const rows = Object.entries(data).map(([key, value]) => `| ${key} | ${JSON.stringify(value)} |`);
  return ["| Key | Value |", "| --- | --- |", ...rows].join("\n");
}

function renderSection(section: ReportSection): string {
  const parts = [`## ${section.title}`];
  if (section.summary) {
    parts.push(section.summary);
  }
  if (section.data) {
    parts.push(renderDataTable(section.data));
  }
  if (section.findings && section.findings.length > 0) {
    parts.push(section.findings.map(renderFinding).join("\n\n"));
  } else if (section.findings) {
    parts.push("_No findings._");
  }
  return parts.join("\n\n");
}

export function renderMarkdown(input: ReportInput): string {
  const parts = [`# ${input.title}`, `_Generated ${input.generatedAt}_`];
  if (input.subtitle) {
    parts.push(input.subtitle);
  }
  parts.push(...input.sections.map(renderSection));
  return `${parts.join("\n\n")}\n`;
}
