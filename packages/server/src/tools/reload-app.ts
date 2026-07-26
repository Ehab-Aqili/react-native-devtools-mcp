import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { triggerReload } from "@rn-devtools/collector-metro";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerReloadAppTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "reload_app",
    title: "Reload the app",
    description:
      "Triggers a full reload of every app currently connected to Metro (via /reload). This restarts the running app on-device/simulator immediately — use only when you actually intend to reload, not as a passive check.",
    inputSchema: {
      metroHost: z.string().optional(),
      metroPort: z.number().int().positive().optional(),
    },
    annotations: { destructiveHint: true },
    handler: async (args) => {
      const host = args.metroHost ?? ctx.config.metro.host;
      const port = args.metroPort ?? ctx.config.metro.port;
      await triggerReload(host, port);
      return ok({ reloaded: true, host, port });
    },
  });
}
