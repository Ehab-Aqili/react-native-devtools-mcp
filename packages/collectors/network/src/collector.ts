import type { Collector } from "@rn-devtools/core";
import { NetworkClient } from "./network-client.js";
import type { NetworkCaptureParams, NetworkConnectOptions, NetworkRequestRecord } from "./types.js";

/**
 * Observes network requests (fetch/XHR) made by the app via Hermes's CDP
 * `Network` domain — a real native reporting pipeline (RCTNetworking →
 * NetworkReporter → NetworkHandler), not a JS-side interception hack. Starts
 * observing at `connect()` time; `capture()` returns everything seen so far.
 */
export class NetworkCollector implements Collector<NetworkConnectOptions, NetworkRequestRecord[]> {
  readonly id = "network";
  readonly platform = "any" as const;

  private readonly client = new NetworkClient();
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: NetworkConnectOptions): Promise<void> {
    await this.client.connect(options.webSocketDebuggerUrl);
    this.connected = true;
  }

  async capture(params: NetworkCaptureParams = {}): Promise<NetworkRequestRecord[]> {
    if (params.detail === "full") {
      return this.client.snapshotWithBodies();
    }
    return this.client.snapshot();
  }

  async dispose(): Promise<void> {
    this.client.close();
    this.connected = false;
  }
}
