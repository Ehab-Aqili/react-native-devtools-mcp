import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DetailLevelSchema, ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerGetNetworkRequestsTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "get_network_requests",
    title: "Check requests captured so far",
    description:
      "Returns everything a start_network_capture session has observed so far, without ending it — call this any number of times while waiting for someone to reproduce a bug. Use stop_network_capture instead once you're done, to also get analyzer findings and free the connection.",
    inputSchema: {
      sessionId: z.string(),
      detail: DetailLevelSchema.optional(),
    },
    handler: async (args) => {
      const requests = await ctx.networkSessions.peek(args.sessionId, args.detail);
      return ok({ requests });
    },
  });
}
