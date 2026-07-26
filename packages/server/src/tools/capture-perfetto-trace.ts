import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AndroidCollector } from "@rn-devtools/collector-android";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCapturePerfettoTraceTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "capture_perfetto_trace",
    title: "Capture a Perfetto system trace",
    description:
      "Captures a short system-wide Perfetto trace on a connected Android device and pulls it to disk. Returns a handleId and byte size — the trace itself is a binary protobuf, not analyzed here; open it in the Perfetto UI (ui.perfetto.dev) for deep analysis.",
    inputSchema: {
      serial: z.string(),
      durationMs: z.number().int().positive().max(30_000).optional(),
    },
    handler: async (args) => {
      const collector = new AndroidCollector();
      try {
        await collector.connect({ serial: args.serial, dataDir: ctx.config.dataDir });
        const result = await collector.capture({
          action: "perfetto_trace",
          ...(args.durationMs !== undefined && { durationMs: args.durationMs }),
        });
        return ok(result);
      } finally {
        await collector.dispose();
      }
    },
  });
}
