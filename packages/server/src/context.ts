import type { Config, Logger, PluginRegistry } from "@rn-devtools/core";

/** Shared dependencies handed to every tool/resource/prompt handler. */
export interface ServerContext {
  readonly config: Config;
  readonly logger: Logger;
  readonly registry: PluginRegistry;
}
