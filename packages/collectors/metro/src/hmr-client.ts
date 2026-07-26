import { baseUrl } from "./http.js";
import type { MetroFastRefreshEvent } from "./types.js";

const MAX_BUFFERED_EVENTS = 200;

interface RawHmrMessage {
  readonly type: string;
  readonly body?: {
    readonly revisionId?: string;
    readonly changeId?: string;
    readonly added?: unknown[];
    readonly modified?: unknown[];
    readonly deleted?: unknown[];
    readonly message?: string;
  };
}

/**
 * Observes Fast Refresh activity by registering as a passive HMR client on
 * Metro's `/hot` websocket, mirroring the handshake `HMRClient.setup()` does
 * on-device (`register-entrypoints` with the bundle URL). We never inject
 * the received module updates — we only record that they happened.
 */
export class MetroHmrClient {
  private socket: WebSocket | undefined;
  private readonly events: MetroFastRefreshEvent[] = [];

  connect(host: string, port: number, entryPoints: string[]): void {
    const url = `${baseUrl(host, port).replace("http", "ws")}/hot`;
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "register-entrypoints", entryPoints }));
    });
    socket.addEventListener("message", (event) => {
      this.handleMessage(String(event.data));
    });
    this.socket = socket;
  }

  private handleMessage(raw: string): void {
    let message: RawHmrMessage;
    try {
      message = JSON.parse(raw) as RawHmrMessage;
    } catch {
      return;
    }

    const timestamp = Date.now();
    const body = message.body;

    if (message.type === "update-start" || message.type === "update-done") {
      this.push({
        type: message.type,
        timestamp,
        ...(body?.revisionId !== undefined && { revisionId: body.revisionId }),
      });
      return;
    }

    if (message.type === "update" && body) {
      this.push({
        type: "update",
        timestamp,
        ...(body.revisionId !== undefined && { revisionId: body.revisionId }),
        addedCount: body.added?.length ?? 0,
        modifiedCount: body.modified?.length ?? 0,
        deletedCount: body.deleted?.length ?? 0,
      });
      return;
    }

    if (message.type === "error") {
      this.push({
        type: "error",
        timestamp,
        ...(body?.message !== undefined && { message: body.message }),
      });
    }
  }

  private push(event: MetroFastRefreshEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_BUFFERED_EVENTS) {
      this.events.splice(0, this.events.length - MAX_BUFFERED_EVENTS);
    }
  }

  snapshot(): MetroFastRefreshEvent[] {
    return [...this.events];
  }

  dispose(): void {
    this.socket?.close();
    this.socket = undefined;
    this.events.length = 0;
  }
}
