import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerStartNetworkCaptureTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "start_network_capture",
    title: "Start capturing network requests",
    description:
      "Begins observing fetch/XHR requests on the given CDP target and returns immediately with a sessionId — it does not wait or block. Use this before asking the person to reproduce a bug, since a single bounded tool call can't span however long that takes. Follow up with get_network_requests to check progress, or stop_network_capture once the bug has been reproduced to get the final results and end the session.",
    inputSchema: { webSocketDebuggerUrl: z.string() },
    handler: async (args) => {
      const sessionId = await ctx.networkSessions.startCapture(args.webSocketDebuggerUrl);
      return ok({ sessionId });
    },
  });
}
