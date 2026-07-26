import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HermesCollector } from "@rn-devtools/collector-hermes";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerEvaluateExpressionTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "evaluate_expression",
    title: "Evaluate a JS expression",
    description:
      "Evaluates a JavaScript expression directly in the Hermes runtime (Runtime.evaluate) and returns its value. A throwing expression returns its error message rather than failing the tool call. Also useful for forcing GC (HermesInternal or global.gc if exposed) or ad-hoc runtime introspection.",
    inputSchema: {
      webSocketDebuggerUrl: z.string(),
      expression: z.string(),
    },
    handler: async (args) => {
      const collector = new HermesCollector();
      try {
        await collector.connect({
          webSocketDebuggerUrl: args.webSocketDebuggerUrl,
          dataDir: ctx.config.dataDir,
        });
        const result = await collector.capture({
          action: "evaluate",
          expression: args.expression,
        });
        return ok(result);
      } finally {
        await collector.dispose();
      }
    },
  });
}
