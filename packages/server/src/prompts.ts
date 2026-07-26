import type { McpServer, PromptCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ZodRawShapeCompat,
  ShapeOutput,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "./context.js";

export interface PromptDefinition<Args extends ZodRawShapeCompat | undefined = undefined> {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly argsSchema?: Args;
  readonly handler: (
    args: Args extends ZodRawShapeCompat ? ShapeOutput<Args> : Record<string, never>,
    ctx: ServerContext,
  ) => GetPromptResult | Promise<GetPromptResult>;
}

export function registerPrompt<Args extends ZodRawShapeCompat | undefined = undefined>(
  server: McpServer,
  ctx: ServerContext,
  def: PromptDefinition<Args>,
): void {
  const callback = ((args: unknown, _extra: unknown) =>
    def.handler(
      args as Args extends ZodRawShapeCompat ? ShapeOutput<Args> : Record<string, never>,
      ctx,
    )) as PromptCallback<Args>;

  server.registerPrompt(
    def.name,
    {
      ...(def.title !== undefined && { title: def.title }),
      description: def.description,
      ...(def.argsSchema !== undefined && { argsSchema: def.argsSchema }),
    },
    callback,
  );
}
