import { baseUrl } from "./http.js";
import type { MetroBuildEvent, MetroLogEntry, MetroLogLevel } from "./types.js";

const MAX_BUFFERED_LOGS = 500;
const MAX_BUFFERED_BUILD_EVENTS = 200;

interface RawReportableEvent {
  readonly type: string;
  readonly level?: MetroLogLevel;
  readonly data?: unknown[];
  readonly buildID?: string;
  readonly error?: unknown;
  readonly bundleDetails?: {
    readonly entryFile?: string;
    readonly platform?: string | null;
  };
}

function pushCapped<T>(buffer: T[], entry: T, max: number): void {
  buffer.push(entry);
  if (buffer.length > max) {
    buffer.splice(0, buffer.length - max);
  }
}

/**
 * Connects to Metro's `/events` websocket (the same channel Flipper/devtools
 * use), which relays both bundler reporter events and the connected app's
 * `console.*` calls (as `client_log`).
 */
export class MetroEventsClient {
  private socket: WebSocket | undefined;
  private readonly logs: MetroLogEntry[] = [];
  private readonly buildEvents: MetroBuildEvent[] = [];

  connect(host: string, port: number): void {
    const url = `${baseUrl(host, port).replace("http", "ws")}/events`;
    const socket = new WebSocket(url);
    socket.addEventListener("message", (event) => {
      this.handleMessage(String(event.data));
    });
    this.socket = socket;
  }

  private handleMessage(raw: string): void {
    let message: RawReportableEvent;
    try {
      message = JSON.parse(raw) as RawReportableEvent;
    } catch {
      return;
    }

    const timestamp = Date.now();

    if (message.type === "client_log" && message.level && message.data) {
      const text = message.data.map((item) => String(item)).join(" ");
      pushCapped(this.logs, { level: message.level, message: text, timestamp }, MAX_BUFFERED_LOGS);
      return;
    }

    if (
      message.type === "bundle_build_started" ||
      message.type === "bundle_build_done" ||
      message.type === "bundle_build_failed" ||
      message.type === "hmr_client_error"
    ) {
      const event: MetroBuildEvent = {
        type: message.type,
        timestamp,
        ...(message.buildID !== undefined && { buildId: message.buildID }),
        ...(message.bundleDetails?.entryFile !== undefined && {
          entryFile: message.bundleDetails.entryFile,
        }),
        ...(message.bundleDetails?.platform != null && {
          platform: message.bundleDetails.platform,
        }),
        ...(message.error !== undefined && { message: String(message.error) }),
      };
      pushCapped(this.buildEvents, event, MAX_BUFFERED_BUILD_EVENTS);
    }
  }

  snapshotLogs(): MetroLogEntry[] {
    return [...this.logs];
  }

  snapshotBuildEvents(): MetroBuildEvent[] {
    return [...this.buildEvents];
  }

  dispose(): void {
    this.socket?.close();
    this.socket = undefined;
    this.logs.length = 0;
    this.buildEvents.length = 0;
  }
}
