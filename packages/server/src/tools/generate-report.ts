import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildReportFromFindings, generateReport } from "@rn-devtools/reports";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

const FindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  category: z.string(),
  title: z.string(),
  message: z.string(),
  location: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

const EXTENSION_BY_FORMAT = { json: "json", markdown: "md", html: "html" } as const;
const PREVIEW_LINES = 20;

export function registerGenerateReportTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "generate_report",
    title: "Generate a report",
    description:
      "Renders a findings list (from capture_heap, analyze_project, capture_android_perf, etc.) into a JSON, Markdown, or HTML report written to disk, plus a short preview. Use this to hand off a readable artifact instead of re-printing raw findings.",
    inputSchema: {
      title: z.string(),
      findings: z.array(FindingSchema),
      format: z.enum(["json", "markdown", "html"]),
      subtitle: z.string().optional(),
      groupByCategory: z.boolean().optional(),
    },
    handler: async (args) => {
      const findings = args.findings.map((finding) => ({
        id: finding.id,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        message: finding.message,
        ...(finding.location !== undefined && { location: finding.location }),
        ...(finding.evidence !== undefined && { evidence: finding.evidence }),
      }));
      const input = buildReportFromFindings(args.title, findings, {
        ...(args.subtitle !== undefined && { subtitle: args.subtitle }),
        ...(args.groupByCategory !== undefined && { groupByCategory: args.groupByCategory }),
      });
      const content = generateReport(input, args.format);

      const dir = join(ctx.config.dataDir, "reports");
      await mkdir(dir, { recursive: true });
      const handleId = `report-${Date.now()}`;
      const filePath = join(dir, `${handleId}.${EXTENSION_BY_FORMAT[args.format]}`);
      await writeFile(filePath, content, "utf8");

      const previewLines = content.split("\n").slice(0, PREVIEW_LINES);

      return ok({
        handleId,
        filePath,
        format: args.format,
        byteSize: Buffer.byteLength(content, "utf8"),
        preview: previewLines.join("\n"),
        previewTruncated: content.split("\n").length > PREVIEW_LINES,
      });
    },
  });
}
