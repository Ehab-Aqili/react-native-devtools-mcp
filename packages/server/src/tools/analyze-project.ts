import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReactDevtoolsCollector } from "@rn-devtools/collector-react-devtools";
import { AndroidCollector } from "@rn-devtools/collector-android";
import type { RenderTreeAnalyzer, CommitProfileAnalyzer } from "@rn-devtools/analyzer-render";
import type { FpsAnalyzer } from "@rn-devtools/analyzer-fps";
import { ok, type Finding } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerAnalyzeProjectTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "analyze_project",
    title: "Run a broad performance check",
    description:
      "A one-call sweep across the available analyzers for a connected app: render timing (fiber tree + commit profile) and, if an Android serial + packageName are given, frame/jank stats. Returns every finding tagged with its category — good as a first pass before drilling into a specific tool (capture_heap, inspect_component, etc.) based on what shows up.",
    inputSchema: {
      webSocketDebuggerUrl: z.string(),
      androidSerial: z.string().optional(),
      androidPackageName: z.string().optional(),
    },
    handler: async (args) => {
      const findings: Finding[] = [];
      const ranAnalyzers: string[] = [];

      const rdt = new ReactDevtoolsCollector();
      try {
        await rdt.connect({ webSocketDebuggerUrl: args.webSocketDebuggerUrl });

        const treeResult = await rdt.capture({ action: "fiber_tree", detail: "normal" });
        if (treeResult.action !== "fiber_tree") {
          throw new Error(`Unexpected capture result action: ${treeResult.action}`);
        }
        const treeAnalyzer = ctx.registry.getAnalyzer<RenderTreeAnalyzer>("render-tree");
        findings.push(...treeAnalyzer.analyze(treeResult));
        ranAnalyzers.push("render-tree");

        const commitResult = await rdt.capture({ action: "commit_profile" });
        if (commitResult.action !== "commit_profile") {
          throw new Error(`Unexpected capture result action: ${commitResult.action}`);
        }
        const commitAnalyzer = ctx.registry.getAnalyzer<CommitProfileAnalyzer>("render-commit");
        findings.push(...commitAnalyzer.analyze(commitResult));
        ranAnalyzers.push("render-commit");
      } finally {
        await rdt.dispose();
      }

      if (args.androidSerial && args.androidPackageName) {
        const android = new AndroidCollector();
        try {
          await android.connect({ serial: args.androidSerial, dataDir: ctx.config.dataDir });
          const gfxinfo = await android.capture({
            action: "gfxinfo",
            packageName: args.androidPackageName,
          });
          if (gfxinfo.action !== "gfxinfo") {
            throw new Error(`Unexpected capture result action: ${gfxinfo.action}`);
          }
          const fpsAnalyzer = ctx.registry.getAnalyzer<FpsAnalyzer>("fps");
          findings.push(...fpsAnalyzer.analyze(gfxinfo));
          ranAnalyzers.push("fps");
        } finally {
          await android.dispose();
        }
      }

      const bySeverity = {
        critical: findings.filter((f) => f.severity === "critical").length,
        warning: findings.filter((f) => f.severity === "warning").length,
        info: findings.filter((f) => f.severity === "info").length,
      };

      return ok({ ranAnalyzers, summary: bySeverity, findings });
    },
  });
}
