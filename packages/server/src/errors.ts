/** Thrown by tool handlers to produce a specific error code instead of E_INTERNAL. */
export class ToolError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function toErrorCodeAndMessage(caught: unknown): { code: string; message: string } {
  if (caught instanceof ToolError) {
    return { code: caught.code, message: caught.message };
  }
  if (caught instanceof Error) {
    return { code: "E_INTERNAL", message: caught.message };
  }
  return { code: "E_INTERNAL", message: String(caught) };
}
