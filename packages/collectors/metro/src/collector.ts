import type { Collector } from "@rn-devtools/core";
import { dedupeCount, truncateList, type DetailLevel } from "@rn-devtools/shared";
import { MetroEventsClient } from "./events-client.js";
import { MetroHmrClient } from "./hmr-client.js";
import { checkStatus, listDevices, triggerReload } from "./http.js";
import type {
  MetroBuildEvent,
  MetroConnectOptions,
  MetroDevicePage,
  MetroFastRefreshEvent,
  MetroLogEntry,
  MetroLogLevel,
} from "./types.js";

export interface MetroLogDigest {
  readonly level: MetroLogLevel;
  readonly message: string;
  readonly count: number;
  readonly firstSeen: number;
}

export interface MetroCapture {
  readonly status: "running" | "unreachable";
  readonly host: string;
  readonly port: number;
  readonly devices: MetroDevicePage[];
  readonly logs: MetroLogDigest[];
  readonly logsTruncatedCount: number;
  readonly buildEvents: MetroBuildEvent[];
  readonly buildEventsTruncatedCount: number;
  readonly fastRefresh: MetroFastRefreshEvent[];
  readonly fastRefreshTruncatedCount: number;
}

export interface MetroCaptureParams {
  readonly detail?: DetailLevel;
  readonly action?: "reload";
}

const DETAIL_CAPS: Record<DetailLevel, number> = {
  summary: 10,
  normal: 50,
  full: Number.POSITIVE_INFINITY,
};

/**
 * Connects to a running Metro dev server: device discovery (`/json/list`),
 * console/bundler logs and build events (`/events`), reload (`/reload`), and
 * optionally Fast Refresh observation (`/hot`, opt-in via `hmrEntryPoints`
 * since guessing a wrong bundle URL can trigger an unwanted full rebuild).
 */
export class MetroCollector implements Collector<MetroConnectOptions, MetroCapture> {
  readonly id = "metro";
  readonly platform = "any" as const;

  private host = "localhost";
  private port = 8081;
  private connected = false;
  private readonly eventsClient = new MetroEventsClient();
  private readonly hmrClient = new MetroHmrClient();

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: MetroConnectOptions & { hmrEntryPoints?: string[] } = {}): Promise<void> {
    this.host = options.host ?? "localhost";
    this.port = options.port ?? 8081;

    const running = await checkStatus(this.host, this.port);
    if (!running) {
      throw new Error(`Metro is not reachable at ${this.host}:${this.port}`);
    }

    this.eventsClient.connect(this.host, this.port);
    if (options.hmrEntryPoints && options.hmrEntryPoints.length > 0) {
      this.hmrClient.connect(this.host, this.port, options.hmrEntryPoints);
    }
    this.connected = true;
  }

  async capture(params: MetroCaptureParams = {}): Promise<MetroCapture> {
    if (params.action === "reload") {
      await triggerReload(this.host, this.port);
    }

    const detail = params.detail ?? "summary";
    const cap = DETAIL_CAPS[detail];

    const running = await checkStatus(this.host, this.port);
    const devices = running ? await listDevices(this.host, this.port) : [];

    const dedupedLogs = dedupeCount(
      this.eventsClient.snapshotLogs(),
      (entry: MetroLogEntry) => `${entry.level}:${entry.message}`,
    ).map(({ item, count }) => ({
      level: item.level,
      message: item.message,
      count,
      firstSeen: item.timestamp,
    }));
    const { items: logs, truncatedCount: logsTruncatedCount } = truncateList(dedupedLogs, cap);

    const { items: buildEvents, truncatedCount: buildEventsTruncatedCount } = truncateList(
      this.eventsClient.snapshotBuildEvents(),
      cap,
    );

    const { items: fastRefresh, truncatedCount: fastRefreshTruncatedCount } = truncateList(
      this.hmrClient.snapshot(),
      cap,
    );

    return {
      status: running ? "running" : "unreachable",
      host: this.host,
      port: this.port,
      devices,
      logs,
      logsTruncatedCount,
      buildEvents,
      buildEventsTruncatedCount,
      fastRefresh,
      fastRefreshTruncatedCount,
    };
  }

  async dispose(): Promise<void> {
    this.eventsClient.dispose();
    this.hmrClient.dispose();
    this.connected = false;
  }
}
