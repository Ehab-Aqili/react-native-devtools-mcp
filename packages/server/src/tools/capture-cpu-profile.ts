import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HermesCollector } from "@rn-devtools/collector-hermes";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCaptureCpuProfileTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "capture_cpu_profile",
    title: "Capture a CPU profile",
    description:
      "Records a Hermes CPU profile for the given duration and returns the top functions by self time, plus a handleId for the full raw profile written to disk.",
    inputSchema: {
      webSocketDebuggerUrl: z.string(),
      durationMs: z.number().int().positive().max(60_000).optional(),
    },
    handler: async (args) => {
      const collector = new HermesCollector();
      try {
        await collector.connect({
          webSocketDebuggerUrl: args.webSocketDebuggerUrl,
          dataDir: ctx.config.dataDir,
        });
        const capture = await collector.capture({
          action: "cpu_profile",
          ...(args.durationMs !== undefined && { durationMs: args.durationMs }),
        });
        return ok(capture);
      } finally {
        await collector.dispose();
      }
    },
  });
}
