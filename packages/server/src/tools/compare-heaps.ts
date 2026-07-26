import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { compareHeapSnapshots, loadHeapSnapshot } from "@rn-devtools/analyzer-memory";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCompareHeapsTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "compare_heaps",
    title: "Compare two heap snapshots",
    description:
      "Compares two heap snapshot files captured by capture_heap (earlier and later in time) and reports growth findings — object names whose instance count kept increasing, and node types whose total size grew. This is the strongest available leak signal, stronger than any single-snapshot analysis.",
    inputSchema: {
      beforeFilePath: z.string(),
      afterFilePath: z.string(),
    },
    handler: async (args) => {
      const [before, after] = await Promise.all([
        loadHeapSnapshot(args.beforeFilePath),
        loadHeapSnapshot(args.afterFilePath),
      ]);
      const findings = compareHeapSnapshots(before, after);
      return ok({
        beforeNodeCount: before.nodeCount,
        afterNodeCount: after.nodeCount,
        findings,
      });
    },
  });
}
