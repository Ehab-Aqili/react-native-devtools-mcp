import type { Collector } from "@rn-devtools/core";
import { listSimulators } from "./simctl.js";
import type { IosCaptureParams, IosCaptureResult, IosConnectOptions } from "./types.js";
import { recordInstrumentsTrace } from "./xctrace.js";

const DEFAULT_DATA_DIR = ".rn-devtools";

/** Talks to an iOS Simulator or physical device: simctl discovery, Instruments traces via xctrace. */
export class IosCollector implements Collector<IosConnectOptions, IosCaptureResult> {
  readonly id = "ios";
  readonly platform = "ios" as const;

  private deviceUdid = "";
  private dataDir = DEFAULT_DATA_DIR;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: IosConnectOptions): Promise<void> {
    this.deviceUdid = options.deviceUdid;
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    this.connected = true;
  }

  async capture(params: IosCaptureParams): Promise<IosCaptureResult> {
    switch (params.action) {
      case "list_simulators":
        return { action: "list_simulators", simulators: await listSimulators() };
      case "record_trace":
        return {
          action: "record_trace",
          ...(await recordInstrumentsTrace({
            deviceUdid: this.deviceUdid,
            processName: params.processName,
            dataDir: this.dataDir,
            ...(params.template !== undefined && { template: params.template }),
            ...(params.durationMs !== undefined && { durationMs: params.durationMs }),
          })),
        };
    }
  }

  async dispose(): Promise<void> {
    this.connected = false;
  }
}
