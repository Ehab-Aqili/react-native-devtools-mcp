import type { DetailLevel } from "@rn-devtools/shared";

export interface NetworkConnectOptions {
  readonly webSocketDebuggerUrl: string;
}

export interface NetworkCaptureParams {
  readonly detail?: DetailLevel;
}

/**
 * Matches `@rn-devtools/analyzer-network`'s `NetworkRequest` shape field for
 * field (kept as an independent type rather than an inter-package
 * dependency — collectors stay decoupled from analyzers). `responseBody` is
 * an addition the analyzer doesn't use but is harmless to carry along.
 */
export interface NetworkRequestRecord {
  readonly url: string;
  readonly method: string;
  readonly statusCode?: number;
  readonly startTime: number;
  readonly endTime?: number;
  readonly transferSize?: number;
  readonly failed?: boolean;
  readonly errorText?: string;
  readonly responseBody?: string;
}
