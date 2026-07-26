import type { Collector } from "@rn-devtools/core";
import { listAndroidDevices } from "./adb.js";
import { captureGfxInfo } from "./gfxinfo.js";
import { captureMemInfo } from "./meminfo.js";
import { capturePerfettoTrace } from "./perfetto.js";
import type { AndroidCaptureParams, AndroidCaptureResult, AndroidConnectOptions } from "./types.js";

const DEFAULT_DATA_DIR = ".rn-devtools";

/** Talks to a connected Android device over `adb`: gfxinfo, meminfo, Perfetto traces. */
export class AndroidCollector implements Collector<AndroidConnectOptions, AndroidCaptureResult> {
  readonly id = "android";
  readonly platform = "android" as const;

  private serial = "";
  private dataDir = DEFAULT_DATA_DIR;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: AndroidConnectOptions): Promise<void> {
    const devices = await listAndroidDevices();
    const match = devices.find((device) => device.serial === options.serial);
    if (!match) {
      throw new Error(`No adb device with serial "${options.serial}" is connected`);
    }
    if (match.state !== "device") {
      throw new Error(`Device "${options.serial}" is not ready (state: ${match.state})`);
    }
    this.serial = options.serial;
    this.dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
    this.connected = true;
  }

  async capture(params: AndroidCaptureParams): Promise<AndroidCaptureResult> {
    switch (params.action) {
      case "list_devices":
        return { action: "list_devices", devices: await listAndroidDevices() };
      case "gfxinfo":
        return {
          action: "gfxinfo",
          ...(await captureGfxInfo(this.serial, params.packageName)),
        };
      case "meminfo":
        return {
          action: "meminfo",
          ...(await captureMemInfo(this.serial, params.packageName)),
        };
      case "perfetto_trace":
        return {
          action: "perfetto_trace",
          ...(await capturePerfettoTrace(this.serial, this.dataDir, params.durationMs)),
        };
    }
  }

  async dispose(): Promise<void> {
    this.connected = false;
  }
}
