import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AndroidCollector } from "@rn-devtools/collector-android";
import type { FpsAnalyzer } from "@rn-devtools/analyzer-fps";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerCaptureAndroidPerfTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "capture_android_perf",
    title: "Capture Android rendering + memory stats",
    description:
      "Captures dumpsys gfxinfo (frame timing/jank) and meminfo (memory breakdown) for a package on a connected Android device (see list_devices for the adb serial), plus jank/frame-budget findings from the FPS analyzer.",
    inputSchema: {
      serial: z.string(),
      packageName: z.string(),
    },
    handler: async (args) => {
      const collector = new AndroidCollector();
      try {
        await collector.connect({ serial: args.serial, dataDir: ctx.config.dataDir });
        const [gfxinfo, meminfo] = await Promise.all([
          collector.capture({ action: "gfxinfo", packageName: args.packageName }),
          collector.capture({ action: "meminfo", packageName: args.packageName }),
        ]);
        if (gfxinfo.action !== "gfxinfo" || meminfo.action !== "meminfo") {
          throw new Error("Unexpected capture result action");
        }
        const fpsAnalyzer = ctx.registry.getAnalyzer<FpsAnalyzer>("fps");
        const findings = fpsAnalyzer.analyze(gfxinfo);

        return ok({ gfxinfo, meminfo, findings });
      } finally {
        await collector.dispose();
      }
    },
  });
}
