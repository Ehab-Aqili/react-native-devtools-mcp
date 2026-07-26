import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildReportFromFindings, generateReport, type ReportFormat } from "@rn-devtools/reports";
import type { Finding } from "@rn-devtools/shared";
import { printError } from "../output.js";

export interface ReportOptions {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly format: ReportFormat;
  readonly title: string;
  readonly groupByCategory: boolean;
}

export function parseReportArgs(argv: string[]): ReportOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      out: { type: "string" },
      format: { type: "string" },
      title: { type: "string", default: "Report" },
      "group-by-category": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.input) {
    throw new Error("--input <findings.json> is required");
  }
  if (!values.out) {
    throw new Error("--out <path> is required");
  }
  if (values.format !== "json" && values.format !== "markdown" && values.format !== "html") {
    throw new Error('--format is required and must be "json", "markdown", or "html"');
  }

  return {
    inputPath: values.input,
    outputPath: values.out,
    format: values.format,
    title: values.title,
    groupByCategory: values["group-by-category"],
  };
}

function extractFindings(parsed: unknown): Finding[] {
  if (Array.isArray(parsed)) {
    return parsed as Finding[];
  }
  if (parsed && typeof parsed === "object" && "findings" in parsed) {
    const findings = (parsed as { findings: unknown }).findings;
    if (Array.isArray(findings)) {
      return findings as Finding[];
    }
  }
  throw new Error(
    'Input JSON must be either a Finding[] array or an object with a "findings" array field',
  );
}

/** Renders a saved findings JSON file (from `analyze`, `profile`, or an MCP tool result) into a report. */
export async function runReport(options: ReportOptions): Promise<number> {
  try {
    const raw = await readFile(options.inputPath, "utf8");
    const findings = extractFindings(JSON.parse(raw));

    const input = buildReportFromFindings(options.title, findings, {
      groupByCategory: options.groupByCategory,
    });
    const content = generateReport(input, options.format);

    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, content, "utf8");
    process.stdout.write(`Report written to ${options.outputPath} (${findings.length} findings)\n`);
    return 0;
  } catch (caught) {
    printError((caught as Error).message);
    return 1;
  }
}
