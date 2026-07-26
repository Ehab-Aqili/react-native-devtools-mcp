import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ZodRawShapeCompat,
  ShapeOutput,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { err, type Result } from "@rn-devtools/shared";
import type { ServerContext } from "./context.js";
import { toErrorCodeAndMessage } from "./errors.js";

export interface ToolDefinition<Args extends ZodRawShapeCompat | undefined = undefined> {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Args;
  readonly annotations?: ToolAnnotations;
  readonly handler: (
    args: Args extends ZodRawShapeCompat ? ShapeOutput<Args> : Record<string, never>,
    ctx: ServerContext,
  ) => Promise<Result<unknown>> | Result<unknown>;
}

function toCallToolResult(result: Result<unknown>): CallToolResult {
  if (result.ok) {
    return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
  }
  return {
    content: [{ type: "text", text: `${result.error.code}: ${result.error.message}` }],
    isError: true,
  };
}

/**
 * Registers a tool whose handler returns a `Result<T>` envelope. Thrown
 * errors (including `ToolError`) are caught and converted into an error
 * result instead of crashing the server or leaking a raw stack trace to the
 * client.
 */
export function registerTool<Args extends ZodRawShapeCompat | undefined = undefined>(
  server: McpServer,
  ctx: ServerContext,
  def: ToolDefinition<Args>,
): void {
  const callback = (async (args: unknown, _extra: unknown) => {
    try {
      const result = await def.handler(
        args as Args extends ZodRawShapeCompat ? ShapeOutput<Args> : Record<string, never>,
        ctx,
      );
      return toCallToolResult(result);
    } catch (caught) {
      const { code, message } = toErrorCodeAndMessage(caught);
      ctx.logger.error(`tool "${def.name}" failed`, { code, message });
      return toCallToolResult(err(code, message));
    }
  }) as ToolCallback<Args>;

  server.registerTool(
    def.name,
    {
      ...(def.title !== undefined && { title: def.title }),
      description: def.description,
      ...(def.inputSchema !== undefined && { inputSchema: def.inputSchema }),
      ...(def.annotations !== undefined && { annotations: def.annotations }),
    },
    callback,
  );
}
