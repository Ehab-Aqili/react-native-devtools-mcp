import type { Platform } from "@rn-devtools/shared";

/**
 * Uniform lifecycle for anything that talks to a running app/device:
 * connect once, capture data any number of times, dispose when done.
 */
export interface Collector<TOptions = unknown, TRaw = unknown> {
  readonly id: string;
  /** Platform this collector is scoped to, or "any" if platform-independent. */
  readonly platform: Platform | "any";
  readonly isConnected: boolean;

  connect(options: TOptions): Promise<void>;
  capture(params?: unknown): Promise<TRaw>;
  dispose(): Promise<void>;
}
