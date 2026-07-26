import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkStatus, listDevices as listMetroDevices } from "@rn-devtools/collector-metro";
import { listAndroidDevices } from "@rn-devtools/collector-android";
import { listSimulators, listXctraceDevices } from "@rn-devtools/collector-ios";
import { ok } from "@rn-devtools/shared";
import { z } from "zod";
import type { ServerContext } from "../context.js";
import { registerTool } from "../tools.js";

export function registerListDevicesTool(server: McpServer, ctx: ServerContext): void {
  registerTool(server, ctx, {
    name: "list_devices",
    title: "List connected devices",
    description:
      "Discovers everything available to attach to: Metro's JS debugging targets (with the webSocketDebuggerUrl needed by capture_heap/inspect_component/evaluate_expression tools), connected Android devices (adb), and iOS simulators/physical devices. Correlate a Metro target with an Android/iOS entry by matching device names.",
    inputSchema: {
      metroHost: z.string().optional(),
      metroPort: z.number().int().positive().optional(),
    },
    handler: async (args) => {
      const host = args.metroHost ?? ctx.config.metro.host;
      const port = args.metroPort ?? ctx.config.metro.port;

      const [metroRunning, androidDevices, iosSimulators, iosDevices] = await Promise.all([
        checkStatus(host, port),
        listAndroidDevices().catch(() => []),
        listSimulators().catch(() => []),
        listXctraceDevices().catch(() => []),
      ]);

      const metroPages = metroRunning ? await listMetroDevices(host, port).catch(() => []) : [];

      return ok({
        metro: {
          host,
          port,
          running: metroRunning,
          pages: metroPages.map((page) => ({
            id: page.id,
            deviceName: page.deviceName,
            title: page.title,
            webSocketDebuggerUrl: page.webSocketDebuggerUrl,
          })),
        },
        android: androidDevices,
        ios: {
          simulators: iosSimulators.filter((sim) => sim.state === "Booted"),
          devices: iosDevices,
        },
      });
    },
  });
}
