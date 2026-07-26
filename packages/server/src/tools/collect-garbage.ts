import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HermesCollector } from "@rn-devtools/collector-hermes";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCollectGarbageTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "collect_garbage",
    title: "Force a GC pass",
    description:
      "Forces Hermes to run a garbage collection pass (HeapProfiler.collectGarbage). Useful right before capture_heap to get a clean baseline for comparison.",
    inputSchema: { webSocketDebuggerUrl: z.string() },
    handler: async (args) => {
      const collector = new HermesCollector();
      try {
        await collector.connect({
          webSocketDebuggerUrl: args.webSocketDebuggerUrl,
          dataDir: ctx.config.dataDir,
        });
        const result = await collector.capture({ action: "collect_garbage" });
        return ok(result);
      } finally {
        await collector.dispose();
      }
    },
  });
}
