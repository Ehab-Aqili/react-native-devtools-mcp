import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IosCollector } from "@rn-devtools/collector-ios";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerRecordIosTraceTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "record_ios_trace",
    title: "Record an iOS Instruments trace",
    description:
      "Records a short Instruments trace by attaching to a running process on an iOS simulator or physical device (see list_devices for the deviceUdid and processName). Returns a handleId, byte size, and a best-effort CPU/memory summary — the .trace bundle itself is proprietary binary data, not fully parsed here.",
    inputSchema: {
      deviceUdid: z.string(),
      processName: z.string(),
      template: z.string().optional(),
      durationMs: z.number().int().positive().max(30_000).optional(),
    },
    handler: async (args) => {
      const collector = new IosCollector();
      try {
        await collector.connect({ deviceUdid: args.deviceUdid, dataDir: ctx.config.dataDir });
        const result = await collector.capture({
          action: "record_trace",
          processName: args.processName,
          ...(args.template !== undefined && { template: args.template }),
          ...(args.durationMs !== undefined && { durationMs: args.durationMs }),
        });
        return ok(result);
      } finally {
        await collector.dispose();
      }
    },
  });
}
