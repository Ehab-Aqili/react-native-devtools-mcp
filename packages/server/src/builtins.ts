import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DetailLevelSchema, ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "./context.js";
import { registerJsonResource } from "./resources.js";
import { registerPrompt } from "./prompts.js";
import { registerTool } from "./tools.js";

export const SERVER_NAME = "rn-devtools-mcp";
export const SERVER_VERSION = "0.0.1";

function registerServerInfoTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "server_info",
    title: "Server info",
    description:
      "Reports server identity, active configuration, and which collectors/analyzers are registered.",
    inputSchema: { detail: DetailLevelSchema.optional() },
    handler: (args) => {
      const detail = args.detail ?? ctx.config.defaultDetail;
      const base = {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        collectors: ctx.registry.listCollectors().map((c) => c.id),
        analyzers: ctx.registry.listAnalyzers().map((a) => a.id),
      };
      if (detail === "summary") {
        return ok({
          ...base,
          logLevel: ctx.config.logLevel,
        });
      }
      return ok({ ...base, config: ctx.config });
    },
  });
}

function registerConfigResource(server: McpServer, ctx: ServerContext): void {
  registerJsonResource(server, ctx, {
    name: "config",
    uri: "config://active",
    title: "Active configuration",
    description: "The fully-resolved server configuration (defaults + file + env + overrides).",
    read: (c) => c.config,
  });
}

function registerTriagePrompt(server: McpServer, ctx: ServerContext): void {
  registerPrompt(server, ctx, {
    name: "triage_performance",
    title: "Triage a performance issue",
    description:
      "Guides an investigation of a React Native performance report using the available collectors and analyzers.",
    argsSchema: { symptom: z.string() },
    handler: (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `A user reports the following React Native performance symptom: "${args.symptom}".`,
              "",
              "Investigate using the smallest number of tool calls that yields a confident",
              "diagnosis. Prefer summary-detail results first; only request normal/full detail",
              "once you know which artifact (heap snapshot, CPU profile, fiber tree, native trace)",
              "is relevant. Call server_info first if you are unsure which collectors are available.",
            ].join("\n"),
          },
        },
      ],
    }),
  });
}

export function registerBuiltins(server: McpServer, ctx: ServerContext): void {
  registerServerInfoTool(server, ctx);
  registerConfigResource(server, ctx);
  registerTriagePrompt(server, ctx);
}
