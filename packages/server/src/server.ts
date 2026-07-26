import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger, loadConfig, PluginRegistry, type Config } from "@rn-devtools/core";
import { registerAnalyzers } from "./analyzers.js";
import { SERVER_NAME, SERVER_VERSION, registerBuiltins } from "./builtins.js";
import type { ServerContext } from "./context.js";
import { NetworkSessionManager } from "./network-sessions.js";
import { registerDomainTools } from "./tools/index.js";

export interface CreateServerOptions {
  readonly config?: Partial<Config>;
}

export interface CreatedServer {
  readonly server: McpServer;
  readonly ctx: ServerContext;
}

export function createServer(options: CreateServerOptions = {}): CreatedServer {
  const config = loadConfig(options.config ? { overrides: options.config } : {});
  const logger = createLogger({ level: config.logLevel, scope: SERVER_NAME });
  const registry = new PluginRegistry();
  registerAnalyzers(registry);
  const networkSessions = new NetworkSessionManager();
  const ctx: ServerContext = { config, logger, registry, networkSessions };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  registerBuiltins(server, ctx);
  registerDomainTools(server, ctx);

  return { server, ctx };
}
