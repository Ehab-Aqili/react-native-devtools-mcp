export interface MetroConnectOptions {
  readonly host?: string;
  readonly port?: number;
}

export interface MetroDeviceCapabilities {
  readonly nativePageReloads?: boolean;
  readonly nativeSourceCodeFetching?: boolean;
  readonly supportsMultipleDebuggers?: boolean;
}

/** One entry from Metro's `/json/list` — a connected app instance available for CDP debugging. */
export interface MetroDevicePage {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly appId?: string;
  readonly deviceName?: string;
  readonly webSocketDebuggerUrl: string;
  readonly devtoolsFrontendUrl?: string;
  readonly reactNative?: {
    readonly logicalDeviceId: string;
    readonly capabilities: MetroDeviceCapabilities;
  };
}

export type MetroLogLevel =
  "trace" | "info" | "warn" | "log" | "group" | "groupCollapsed" | "groupEnd" | "debug";

export interface MetroLogEntry {
  readonly level: MetroLogLevel;
  readonly message: string;
  readonly timestamp: number;
}

export type MetroBuildEventType =
  "bundle_build_started" | "bundle_build_done" | "bundle_build_failed" | "hmr_client_error";

export interface MetroBuildEvent {
  readonly type: MetroBuildEventType;
  readonly timestamp: number;
  readonly buildId?: string;
  readonly entryFile?: string;
  readonly platform?: string;
  readonly message?: string;
}

export type MetroFastRefreshEventType = "update-start" | "update" | "update-done" | "error";

export interface MetroFastRefreshEvent {
  readonly type: MetroFastRefreshEventType;
  readonly timestamp: number;
  readonly revisionId?: string;
  readonly addedCount?: number;
  readonly modifiedCount?: number;
  readonly deletedCount?: number;
  readonly message?: string;
}
