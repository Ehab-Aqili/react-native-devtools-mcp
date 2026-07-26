import type { Collector } from "@rn-devtools/core";
import { CdpClient } from "./cdp-client.js";
import { captureCpuProfile } from "./cpu-profile.js";
import { captureHeapSnapshot } from "./heap-snapshot.js";
import type {
  CollectGarbageResult,
  EvaluateResult,
  HermesCaptureParams,
  HermesCaptureResult,
  HermesConnectOptions,
} from "./types.js";

interface RemoteObject {
  readonly type: string;
  readonly value?: unknown;
}

interface ExceptionDetails {
  readonly text: string;
  readonly exception?: RemoteObject;
}

interface EvaluateResponse {
  readonly result: RemoteObject;
  readonly exceptionDetails?: ExceptionDetails;
}

const DEFAULT_DATA_DIR = ".rn-devtools";

/**
 * Connects directly to a Hermes runtime's CDP debugger websocket (the
 * `webSocketDebuggerUrl` from Metro's `/json/list`) for heap snapshots, CPU
 * profiles, runtime evaluation, and forced GC.
 */
export class HermesCollector implements Collector<HermesConnectOptions, HermesCaptureResult> {
  readonly id = "hermes";
  readonly platform = "any" as const;

  private readonly cdp = new CdpClient();
  private dataDir = DEFAULT_DATA_DIR;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: HermesConnectOptions): Promise<void> {
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    await this.cdp.connect(options.webSocketDebuggerUrl);
    this.connected = true;
  }

  async capture(params: HermesCaptureParams): Promise<HermesCaptureResult> {
    switch (params.action) {
      case "heap_snapshot":
        return captureHeapSnapshot(this.cdp, this.dataDir);
      case "cpu_profile":
        return captureCpuProfile(this.cdp, this.dataDir, params.durationMs);
      case "evaluate":
        return this.evaluate(params.expression);
      case "collect_garbage":
        return this.collectGarbage();
    }
  }

  private async evaluate(expression: string): Promise<EvaluateResult> {
    await this.cdp.send("Runtime.enable");
    const response = await this.cdp.send<EvaluateResponse>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      generatePreview: false,
    });

    if (response.exceptionDetails) {
      return {
        action: "evaluate",
        resultType: "error",
        exception: response.exceptionDetails.text,
      };
    }
    return {
      action: "evaluate",
      resultType: response.result.type,
      value: response.result.value,
    };
  }

  private async collectGarbage(): Promise<CollectGarbageResult> {
    const start = Date.now();
    // Hermes's inspector does not implement "HeapProfiler.enable" (unlike
    // Runtime.enable) — collectGarbage works directly without it.
    await this.cdp.send("HeapProfiler.collectGarbage");
    return { action: "collect_garbage", ok: true, durationMs: Date.now() - start };
  }

  async dispose(): Promise<void> {
    this.cdp.close();
    this.connected = false;
  }
}
