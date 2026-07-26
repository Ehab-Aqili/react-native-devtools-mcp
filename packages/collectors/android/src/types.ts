import type { AndroidDevice } from "./adb.js";

export interface AndroidConnectOptions {
  readonly serial: string;
  readonly dataDir?: string;
}

export type AndroidCaptureParams =
  | { readonly action: "list_devices" }
  | { readonly action: "gfxinfo"; readonly packageName: string }
  | { readonly action: "meminfo"; readonly packageName: string }
  | { readonly action: "perfetto_trace"; readonly durationMs?: number };

export interface ListDevicesResult {
  readonly action: "list_devices";
  readonly devices: AndroidDevice[];
}

export interface GfxInfoResult {
  readonly packageName: string;
  readonly totalFrames: number;
  readonly jankyFrameCount: number;
  readonly jankyFramePercent: number;
  readonly missedVsyncCount: number;
  readonly highInputLatencyCount: number;
  readonly slowUiThreadCount: number;
  readonly frameDeadlineMissedCount: number;
  readonly percentileFrameTimesMs: Record<string, number>;
}

export interface MemInfoResult {
  readonly packageName: string;
  readonly javaHeapPssKb: number;
  readonly nativeHeapPssKb: number;
  readonly codePssKb: number;
  readonly stackPssKb: number;
  readonly graphicsPssKb: number;
  readonly privateOtherPssKb: number;
  readonly systemPssKb: number;
  readonly totalPssKb: number;
  readonly totalRssKb: number;
  readonly totalSwapPssKb: number;
}

export interface PerfettoTraceResult {
  readonly handleId: string;
  readonly filePath: string;
  readonly byteSize: number;
  readonly durationMs: number;
}

export type AndroidCaptureResult =
  | ListDevicesResult
  | ({ readonly action: "gfxinfo" } & GfxInfoResult)
  | ({ readonly action: "meminfo" } & MemInfoResult)
  | ({ readonly action: "perfetto_trace" } & PerfettoTraceResult);
