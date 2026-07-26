import { CdpClient } from "@rn-devtools/collector-hermes";
import type { NetworkRequestRecord } from "./types.js";

const MAX_HISTORY = 500;
const MAX_RESPONSE_BODY_CHARS = 5000;

interface RawRequestWillBeSent {
  readonly requestId: string;
  readonly timestamp: number;
  readonly request: { readonly url: string; readonly method: string };
  readonly redirectResponse?: { readonly status: number };
}

interface RawResponseReceived {
  readonly requestId: string;
  readonly response: { readonly status: number };
}

interface RawLoadingFinished {
  readonly requestId: string;
  readonly timestamp: number;
  readonly encodedDataLength: number;
}

interface RawLoadingFailed {
  readonly requestId: string;
  readonly timestamp: number;
  readonly errorText: string;
}

interface MutableEntry {
  url: string;
  method: string;
  startTime: number;
  statusCode?: number;
  endTime?: number;
  transferSize?: number;
  failed?: boolean;
  errorText?: string;
}

interface HistoryEntry {
  readonly requestId: string;
  readonly record: NetworkRequestRecord;
}

function toRecord(entry: MutableEntry): NetworkRequestRecord {
  return {
    url: entry.url,
    method: entry.method,
    startTime: entry.startTime,
    ...(entry.statusCode !== undefined && { statusCode: entry.statusCode }),
    ...(entry.endTime !== undefined && { endTime: entry.endTime }),
    ...(entry.transferSize !== undefined && { transferSize: entry.transferSize }),
    ...(entry.failed !== undefined && { failed: entry.failed }),
    ...(entry.errorText !== undefined && { errorText: entry.errorText }),
  };
}

/**
 * Connects to Hermes's CDP `Network` domain — real native events (see
 * `ReactCommon/jsinspector-modern/network/NetworkHandler.cpp`), not a JS-side
 * interception hack. Correlates the request lifecycle by `requestId`,
 * including the CDP quirk where a redirect re-fires `requestWillBeSent` for
 * the same id (each leg is finalized into history before the id is reused).
 */
export class NetworkClient {
  private readonly cdp = new CdpClient();
  private readonly inFlight = new Map<string, MutableEntry>();
  private readonly history: HistoryEntry[] = [];

  async connect(webSocketDebuggerUrl: string): Promise<void> {
    await this.cdp.connect(webSocketDebuggerUrl);
    await this.cdp.send("Network.enable");

    this.cdp.on("Network.requestWillBeSent", (params) => {
      const event = params as RawRequestWillBeSent;
      const existing = this.inFlight.get(event.requestId);
      if (existing && event.redirectResponse) {
        existing.statusCode = event.redirectResponse.status;
        existing.endTime = event.timestamp * 1000;
        this.pushHistory(event.requestId, existing);
      }
      this.inFlight.set(event.requestId, {
        url: event.request.url,
        method: event.request.method,
        startTime: event.timestamp * 1000,
      });
    });

    this.cdp.on("Network.responseReceived", (params) => {
      const event = params as RawResponseReceived;
      const entry = this.inFlight.get(event.requestId);
      if (entry) {
        entry.statusCode = event.response.status;
      }
    });

    this.cdp.on("Network.loadingFinished", (params) => {
      const event = params as RawLoadingFinished;
      const entry = this.inFlight.get(event.requestId);
      if (entry) {
        entry.endTime = event.timestamp * 1000;
        entry.transferSize = event.encodedDataLength;
        this.pushHistory(event.requestId, entry);
        this.inFlight.delete(event.requestId);
      }
    });

    this.cdp.on("Network.loadingFailed", (params) => {
      const event = params as RawLoadingFailed;
      const entry = this.inFlight.get(event.requestId);
      if (entry) {
        entry.endTime = event.timestamp * 1000;
        entry.failed = true;
        entry.errorText = event.errorText;
        this.pushHistory(event.requestId, entry);
        this.inFlight.delete(event.requestId);
      }
    });
  }

  private pushHistory(requestId: string, entry: MutableEntry): void {
    this.history.push({ requestId, record: toRecord(entry) });
    if (this.history.length > MAX_HISTORY) {
      this.history.splice(0, this.history.length - MAX_HISTORY);
    }
  }

  /** Completed + in-flight requests observed since `connect()`. */
  snapshot(): NetworkRequestRecord[] {
    const pending = [...this.inFlight.values()].map(toRecord);
    return [...this.history.map((entry) => entry.record), ...pending];
  }

  /**
   * Same as `snapshot()`, but fetches and attaches each completed request's
   * response body (capped, best-effort — a body that's already been evicted
   * from Hermes's own buffer or fails to fetch is simply omitted).
   */
  async snapshotWithBodies(): Promise<NetworkRequestRecord[]> {
    const completed = await Promise.all(
      this.history.map(async (entry) => {
        const body = await this.getResponseBody(entry.requestId);
        return body !== undefined ? { ...entry.record, responseBody: body } : entry.record;
      }),
    );
    const pending = [...this.inFlight.values()].map(toRecord);
    return [...completed, ...pending];
  }

  private async getResponseBody(requestId: string): Promise<string | undefined> {
    try {
      const result = await this.cdp.send<{ body: string; base64Encoded: boolean }>(
        "Network.getResponseBody",
        { requestId },
      );
      const text = result.base64Encoded
        ? Buffer.from(result.body, "base64").toString("utf8")
        : result.body;
      return text.slice(0, MAX_RESPONSE_BODY_CHARS);
    } catch {
      return undefined;
    }
  }

  close(): void {
    this.cdp.close();
    this.inFlight.clear();
    this.history.length = 0;
  }
}
