import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerContext } from "../context.js";
import { registerListDevicesTool } from "./list-devices.js";
import { registerReloadAppTool } from "./reload-app.js";
import { registerCaptureHeapTool } from "./capture-heap.js";
import { registerCompareHeapsTool } from "./compare-heaps.js";
import { registerCaptureCpuProfileTool } from "./capture-cpu-profile.js";
import { registerEvaluateExpressionTool } from "./evaluate-expression.js";
import { registerCollectGarbageTool } from "./collect-garbage.js";
import { registerInspectComponentTool } from "./inspect-component.js";
import { registerCaptureAndroidPerfTool } from "./capture-android-perf.js";
import { registerCapturePerfettoTraceTool } from "./capture-perfetto-trace.js";
import { registerRecordIosTraceTool } from "./record-ios-trace.js";
import { registerAnalyzeProjectTool } from "./analyze-project.js";

export function registerDomainTools(server: McpServer, ctx: ServerContext): void {
  registerListDevicesTool(server, ctx);
  registerReloadAppTool(server, ctx);
  registerCaptureHeapTool(server, ctx);
  registerCompareHeapsTool(server, ctx);
  registerCaptureCpuProfileTool(server, ctx);
  registerEvaluateExpressionTool(server, ctx);
  registerCollectGarbageTool(server, ctx);
  registerInspectComponentTool(server, ctx);
  registerCaptureAndroidPerfTool(server, ctx);
  registerCapturePerfettoTraceTool(server, ctx);
  registerRecordIosTraceTool(server, ctx);
  registerAnalyzeProjectTool(server, ctx);
}
