import type { McpServer, ResourceMetadata } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "./context.js";

export interface JsonResourceDefinition {
  readonly name: string;
  readonly uri: string;
  readonly title?: string;
  readonly description: string;
  readonly read: (ctx: ServerContext) => unknown | Promise<unknown>;
}

/** Registers a read-only resource that serves a JSON snapshot at a fixed URI. */
export function registerJsonResource(
  server: McpServer,
  ctx: ServerContext,
  def: JsonResourceDefinition,
): void {
  const metadata: ResourceMetadata = {
    description: def.description,
    mimeType: "application/json",
    ...(def.title !== undefined && { title: def.title }),
  };

  server.registerResource(def.name, def.uri, metadata, async (uri): Promise<ReadResourceResult> => {
    const data = await def.read(ctx);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  });
}
