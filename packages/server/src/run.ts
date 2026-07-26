import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export async function run(): Promise<void> {
  const { server, ctx } = createServer();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    ctx.logger.info(`received ${signal}, shutting down`);
    void Promise.all([ctx.registry.disposeAll(), ctx.networkSessions.disposeAll(), server.close()])
      .catch((caught: unknown) => {
        ctx.logger.error("error during shutdown", { error: String(caught) });
      })
      .finally(() => {
        process.exit(0);
      });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.logger.info("server connected over stdio");
}
