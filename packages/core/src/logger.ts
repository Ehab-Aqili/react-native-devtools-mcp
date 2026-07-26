export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly scope?: string;
}

/**
 * Structured logger that writes JSON lines to stderr only. The MCP stdio
 * transport owns stdout — anything written there corrupts the protocol
 * stream, so this logger must never touch it.
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly scope?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    if (options.scope !== undefined) {
      this.scope = options.scope;
    }
  }

  child(scope: string): Logger {
    return new Logger({
      level: this.level,
      scope: this.scope ? `${this.scope}:${scope}` : scope,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) {
      return;
    }
    const entry = {
      time: new Date().toISOString(),
      level,
      ...(this.scope !== undefined && { scope: this.scope }),
      message,
      ...(meta !== undefined && { meta }),
    };
    process.stderr.write(`${JSON.stringify(entry)}\n`);
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
