import type { Finding } from "@rn-devtools/shared";
import type { ReportInput, ReportSection } from "./types.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFinding(finding: Finding): string {
  const location = finding.location
    ? `<div class="finding-location">${escapeHtml(finding.location)}</div>`
    : "";
  return `
    <div class="finding finding-${finding.severity}">
      <div class="finding-header">
        <span class="badge badge-${finding.severity}">${finding.severity}</span>
        <span class="finding-title">${escapeHtml(finding.title)}</span>
      </div>
      <div class="finding-message">${escapeHtml(finding.message)}</div>
      ${location}
    </div>`;
}

function renderDataTable(data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(
      ([key, value]) =>
        `<tr><td class="data-key">${escapeHtml(key)}</td><td class="data-value">${escapeHtml(JSON.stringify(value))}</td></tr>`,
    )
    .join("\n");
  return `<table class="data-table"><tbody>${rows}</tbody></table>`;
}

function renderSection(section: ReportSection): string {
  const summary = section.summary
    ? `<p class="section-summary">${escapeHtml(section.summary)}</p>`
    : "";
  const data = section.data ? renderDataTable(section.data) : "";
  const findings =
    section.findings && section.findings.length > 0
      ? section.findings.map(renderFinding).join("\n")
      : section.findings
        ? '<p class="no-findings">No findings.</p>'
        : "";

  return `
    <section class="report-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${summary}
      ${data}
      ${findings}
    </section>`;
}

const STYLE = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #6b7280;
    --border: #e5e7eb;
    --card-bg: #f9fafb;
    --critical: #dc2626;
    --warning: #d97706;
    --info: #2563eb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115;
      --fg: #e5e7eb;
      --muted: #9ca3af;
      --border: #262b36;
      --card-bg: #161a22;
      --critical: #f87171;
      --warning: #fbbf24;
      --info: #60a5fa;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2rem 1.5rem;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
  }
  .report { max-width: 860px; margin: 0 auto; }
  h1 { margin-bottom: 0.25rem; }
  .subtitle, .generated-at { color: var(--muted); margin: 0.25rem 0; }
  .report-section { margin-top: 2rem; }
  .section-summary { color: var(--muted); }
  .finding {
    border: 1px solid var(--border);
    background: var(--card-bg);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
  }
  .finding-header { display: flex; align-items: center; gap: 0.5rem; }
  .finding-title { font-weight: 600; }
  .finding-message { margin-top: 0.25rem; }
  .finding-location {
    margin-top: 0.25rem;
    font-family: ui-monospace, monospace;
    font-size: 0.85em;
    color: var(--muted);
    word-break: break-all;
  }
  .badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    color: #fff;
  }
  .badge-critical { background: var(--critical); }
  .badge-warning { background: var(--warning); }
  .badge-info { background: var(--info); }
  .finding-critical { border-left: 3px solid var(--critical); }
  .finding-warning { border-left: 3px solid var(--warning); }
  .finding-info { border-left: 3px solid var(--info); }
  .data-table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
  .data-table td { border: 1px solid var(--border); padding: 0.35rem 0.6rem; font-size: 0.9em; }
  .data-key { color: var(--muted); white-space: nowrap; }
  .no-findings { color: var(--muted); }
`;

/** Renders a self-contained HTML report — no external stylesheets, fonts, or scripts. */
export function renderHtml(input: ReportInput): string {
  const subtitle = input.subtitle ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>` : "";
  const sections = input.sections.map(renderSection).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>${STYLE}</style>
</head>
<body>
  <div class="report">
    <h1>${escapeHtml(input.title)}</h1>
    ${subtitle}
    <p class="generated-at">Generated ${escapeHtml(input.generatedAt)}</p>
    ${sections}
  </div>
</body>
</html>
`;
}
