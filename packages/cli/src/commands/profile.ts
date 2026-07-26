import { parseArgs } from "node:util";
import { loadConfig } from "@rn-devtools/core";
import { HermesCollector } from "@rn-devtools/collector-hermes";
import { loadHeapSnapshot, MemoryAnalyzer } from "@rn-devtools/analyzer-memory";
import { printCheck, printError, printFinding, printHeader } from "../output.js";

export interface ProfileOptions {
  readonly webSocketDebuggerUrl: string;
  readonly type: "cpu" | "heap";
  readonly durationMs: number;
}

export function parseProfileArgs(argv: string[]): ProfileOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      ws: { type: "string" },
      type: { type: "string", default: "cpu" },
      duration: { type: "string", default: "3000" },
    },
    strict: true,
    allowPositionals: false,
  });

  if (!values.ws) {
    throw new Error(
      "--ws <webSocketDebuggerUrl> is required (see the device's Metro /json/list entry)",
    );
  }
  if (values.type !== "cpu" && values.type !== "heap") {
    throw new Error(`--type must be "cpu" or "heap", got "${values.type}"`);
  }

  return {
    webSocketDebuggerUrl: values.ws,
    type: values.type,
    durationMs: Number(values.duration),
  };
}

export async function runProfile(options: ProfileOptions): Promise<number> {
  const config = loadConfig();
  const collector = new HermesCollector();

  try {
    await collector.connect({
      webSocketDebuggerUrl: options.webSocketDebuggerUrl,
      dataDir: config.dataDir,
    });

    if (options.type === "cpu") {
      printHeader(`CPU profile (${options.durationMs}ms)`);
      const result = await collector.capture({
        action: "cpu_profile",
        durationMs: options.durationMs,
      });
      if (result.action !== "cpu_profile") {
        throw new Error(`Unexpected capture result action: ${result.action}`);
      }
      printCheck("pass", `${result.sampleCount} samples captured`, result.filePath);
      process.stdout.write("\nTop functions by self time:\n");
      for (const fn of result.topFunctions) {
        process.stdout.write(
          `  ${fn.selfTimeMs.toFixed(2)}ms (${fn.selfTimePercent.toFixed(1)}%)  ${fn.functionName}  ${fn.url}:${fn.lineNumber}\n`,
        );
      }
      return 0;
    }

    printHeader("Heap snapshot");
    const capture = await collector.capture({ action: "heap_snapshot" });
    if (capture.action !== "heap_snapshot") {
      throw new Error(`Unexpected capture result action: ${capture.action}`);
    }
    printCheck("pass", `${capture.byteSize} bytes captured`, capture.filePath);
    const snapshot = await loadHeapSnapshot(capture.filePath);
    const findings = new MemoryAnalyzer().analyze(snapshot);
    process.stdout.write(`\n${snapshot.nodeCount} nodes analyzed — ${findings.length} findings:\n`);
    for (const finding of findings) {
      printFinding(finding.severity, finding.title, finding.message);
    }
    return 0;
  } catch (caught) {
    printError((caught as Error).message);
    return 1;
  } finally {
    await collector.dispose();
  }
}
