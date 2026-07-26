import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NetworkAnalyzer } from "@rn-devtools/analyzer-network";
import { DetailLevelSchema, ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerStopNetworkCaptureTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "stop_network_capture",
    title: "Stop capturing and analyze",
    description:
      'Ends a start_network_capture session and returns every request observed, plus findings from the network analyzer (failures, slow requests, large payloads, duplicates). detail: "full" additionally fetches each completed request\'s response body (capped, best-effort). The session and its CDP connection are freed after this call — sessionId cannot be reused.',
    inputSchema: {
      sessionId: z.string(),
      detail: DetailLevelSchema.optional(),
    },
    handler: async (args) => {
      const requests = await ctx.networkSessions.stopCapture(args.sessionId, args.detail);
      const analyzer = ctx.registry.getAnalyzer<NetworkAnalyzer>("network");
      const findings = analyzer.analyze(requests);
      return ok({ requests, findings });
    },
  });
}
