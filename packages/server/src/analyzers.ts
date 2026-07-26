import type { PluginRegistry } from "@rn-devtools/core";
import { MemoryAnalyzer } from "@rn-devtools/analyzer-memory";
import { RenderTreeAnalyzer, CommitProfileAnalyzer } from "@rn-devtools/analyzer-render";
import { FpsAnalyzer } from "@rn-devtools/analyzer-fps";
import { NetworkAnalyzer } from "@rn-devtools/analyzer-network";
import { BundleAnalyzer } from "@rn-devtools/analyzer-bundle";

/** Registers every analyzer so `server_info` reflects reality and tools can look them up by id. */
export function registerAnalyzers(registry: PluginRegistry): void {
  registry.registerAnalyzer(new MemoryAnalyzer());
  registry.registerAnalyzer(new RenderTreeAnalyzer());
  registry.registerAnalyzer(new CommitProfileAnalyzer());
  registry.registerAnalyzer(new FpsAnalyzer());
  registry.registerAnalyzer(new NetworkAnalyzer());
  registry.registerAnalyzer(new BundleAnalyzer());
}
