import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HermesCollector } from "@rn-devtools/collector-hermes";
import { loadHeapSnapshot, type MemoryAnalyzer } from "@rn-devtools/analyzer-memory";
import { DetailLevelSchema, ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCaptureHeapTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "capture_heap",
    title: "Capture a heap snapshot",
    description:
      "Takes a Hermes heap snapshot from the given CDP target (webSocketDebuggerUrl from list_devices) and returns an analyzed digest — largest objects, per-type breakdown, and unusually numerous instances — plus a handleId. The raw snapshot (tens of MB) is written to disk, never returned inline; pass the handleId to compare_heaps for growth analysis across two captures.",
    inputSchema: {
      webSocketDebuggerUrl: z.string(),
      detail: DetailLevelSchema.optional(),
    },
    handler: async (args) => {
      const collector = new HermesCollector();
      try {
        await collector.connect({
          webSocketDebuggerUrl: args.webSocketDebuggerUrl,
          dataDir: ctx.config.dataDir,
        });
        const capture = await collector.capture({ action: "heap_snapshot" });
        if (capture.action !== "heap_snapshot") {
          throw new Error(`Unexpected capture result action: ${capture.action}`);
        }
        const snapshot = await loadHeapSnapshot(capture.filePath);
        const analyzer = ctx.registry.getAnalyzer<MemoryAnalyzer>("memory");
        const findings = analyzer.analyze(snapshot);

        const detail = args.detail ?? ctx.config.defaultDetail;
        const findingsOut = detail === "summary" ? findings.slice(0, 5) : findings;

        return ok({
          handleId: capture.handleId,
          filePath: capture.filePath,
          byteSize: capture.byteSize,
          nodeCount: snapshot.nodeCount,
          durationMs: capture.durationMs,
          findings: findingsOut,
          findingsTruncated: findingsOut.length < findings.length,
        });
      } finally {
        await collector.dispose();
      }
    },
  });
}
