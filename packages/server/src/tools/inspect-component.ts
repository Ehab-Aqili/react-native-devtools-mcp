import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReactDevtoolsCollector, type FiberNode } from "@rn-devtools/collector-react-devtools";
import { DetailLevelSchema, ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

interface FoundComponent {
  readonly path: string;
  readonly node: FiberNode;
}

function findByName(
  node: FiberNode | null,
  name: string,
  path: string,
): FoundComponent | undefined {
  if (!node) {
    return undefined;
  }
  const currentPath = path ? `${path} > ${node.name}` : node.name;
  if (node.name === name) {
    return { path: currentPath, node };
  }
  for (const child of node.children) {
    const found = findByName(child, name, currentPath);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function registerInspectComponentTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "inspect_component",
    title: "Inspect the React component tree",
    description:
      "Reads the live React fiber tree (component names, props, hooks, class state, render timings) via the React DevTools global hook. Without componentName, returns the whole tree (respecting detail level). With componentName, returns just that component's subtree plus its ancestor path — use this once you know what you're looking for, to avoid paying for the full tree's tokens.",
    inputSchema: {
      webSocketDebuggerUrl: z.string(),
      detail: DetailLevelSchema.optional(),
      componentName: z.string().optional(),
    },
    handler: async (args) => {
      const collector = new ReactDevtoolsCollector();
      try {
        await collector.connect({ webSocketDebuggerUrl: args.webSocketDebuggerUrl });
        const result = await collector.capture({
          action: "fiber_tree",
          detail: args.componentName ? "full" : (args.detail ?? ctx.config.defaultDetail),
        });
        if (result.action !== "fiber_tree") {
          throw new Error(`Unexpected capture result action: ${result.action}`);
        }

        if (!args.componentName) {
          return ok(result);
        }

        for (const tree of result.trees) {
          const found = findByName(tree, args.componentName, "");
          if (found) {
            return ok({ rendererId: result.rendererId, path: found.path, component: found.node });
          }
        }
        return ok({
          rendererId: result.rendererId,
          found: false,
          message: `No component named "${args.componentName}" found in the current tree (${result.nodeCount} nodes walked).`,
        });
      } finally {
        await collector.dispose();
      }
    },
  });
}
