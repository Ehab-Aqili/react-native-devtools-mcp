import type { ReportFormat, ReportInput } from "./types.js";
import { renderJson } from "./render-json.js";
import { renderMarkdown } from "./render-markdown.js";
import { renderHtml } from "./render-html.js";

export function generateReport(input: ReportInput, format: ReportFormat): string {
  switch (format) {
    case "json":
      return renderJson(input);
    case "markdown":
      return renderMarkdown(input);
    case "html":
      return renderHtml(input);
  }
}
