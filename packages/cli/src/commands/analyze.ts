import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig } from "@rn-devtools/core";
import { ReactDevtoolsCollector } from "@rn-devtools/collector-react-devtools";
import { AndroidCollector } from "@rn-devtools/collector-android";
import { RenderTreeAnalyzer, CommitProfileAnalyzer } from "@rn-devtools/analyzer-render";
import { FpsAnalyzer } from "@rn-devtools/analyzer-fps";
import { buildReportFromFindings, generateReport, type ReportFormat } from "@rn-devtools/reports";
import type { Finding } from "@rn-devtools/shared";
import { printError, printFinding, printHeader } from "../output.js";

export interface AnalyzeOptions {
  readonly webSocketDebuggerUrl: string;
  readonly androidSerial?: string;
  readonly androidPackageName?: string;
  readonly reportPath?: string;
  readonly reportFormat: ReportFormat;
}

export function parseAnalyzeArgs(argv: string[]): AnalyzeOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      ws: { type: "string" },
      "android-serial": { type: "string" },
      package: { type: "string" },
      report: { type: "string" },
      format: { type: "string", default: "json" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.ws) {
    throw new Error(
      "--ws <webSocketDebuggerUrl> is required (see the device's Metro /json/list entry)",
    );
  }
  if (
    (values["android-serial"] && !values.package) ||
    (!values["android-serial"] && values.package)
  ) {
    throw new Error("--android-serial and --package must be given together");
  }
  if (values.format !== "json" && values.format !== "markdown" && values.format !== "html") {
    throw new Error(`--format must be "json", "markdown", or "html", got "${values.format}"`);
  }

  return {
    webSocketDebuggerUrl: values.ws,
    ...(values["android-serial"] !== undefined && { androidSerial: values["android-serial"] }),
    ...(values.package !== undefined && { androidPackageName: values.package }),
    ...(values.report !== undefined && { reportPath: values.report }),
    reportFormat: values.format,
  };
}

export async function runAnalyze(options: AnalyzeOptions): Promise<number> {
  const config = loadConfig();
  const findings: Finding[] = [];
  const ranAnalyzers: string[] = [];

  const rdt = new ReactDevtoolsCollector();
  try {
    printHeader("Render analysis");
    await rdt.connect({ webSocketDebuggerUrl: options.webSocketDebuggerUrl });

    const treeResult = await rdt.capture({ action: "fiber_tree", detail: "normal" });
    if (treeResult.action !== "fiber_tree") {
      throw new Error(`Unexpected capture result action: ${treeResult.action}`);
    }
    findings.push(...new RenderTreeAnalyzer().analyze(treeResult));
    ranAnalyzers.push("render-tree");

    const commitResult = await rdt.capture({ action: "commit_profile" });
    if (commitResult.action !== "commit_profile") {
      throw new Error(`Unexpected capture result action: ${commitResult.action}`);
    }
    findings.push(...new CommitProfileAnalyzer().analyze(commitResult));
    ranAnalyzers.push("render-commit");
  } catch (caught) {
    printError((caught as Error).message);
    return 1;
  } finally {
    await rdt.dispose();
  }

  if (options.androidSerial && options.androidPackageName) {
    const android = new AndroidCollector();
    try {
      printHeader("Android FPS analysis");
      await android.connect({ serial: options.androidSerial, dataDir: config.dataDir });
      const gfxinfo = await android.capture({
        action: "gfxinfo",
        packageName: options.androidPackageName,
      });
      if (gfxinfo.action !== "gfxinfo") {
        throw new Error(`Unexpected capture result action: ${gfxinfo.action}`);
      }
      findings.push(...new FpsAnalyzer().analyze(gfxinfo));
      ranAnalyzers.push("fps");
    } catch (caught) {
      printError((caught as Error).message);
      return 1;
    } finally {
      await android.dispose();
    }
  }

  printHeader(`Findings (${findings.length})`);
  for (const finding of findings) {
    printFinding(finding.severity, finding.title, finding.message);
  }

  if (options.reportPath) {
    const input = buildReportFromFindings("Project analysis", findings, { groupByCategory: true });
    const content = generateReport(input, options.reportFormat);
    await mkdir(dirname(options.reportPath), { recursive: true });
    await writeFile(options.reportPath, content, "utf8");
    process.stdout.write(`\nReport written to ${options.reportPath}\n`);
  }

  return 0;
}
