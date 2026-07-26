import { WebSocket } from "ws";

const DEFAULT_TIMEOUT_MS = 10_000;

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface CdpMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

/**
 * Minimal Chrome DevTools Protocol client over a raw websocket. Talks
 * directly to the target's `webSocketDebuggerUrl` (obtained from Metro's
 * `/json/list`) — no proxying logic of our own, matching what the Chrome
 * DevTools frontend itself does.
 */
export class CdpClient {
  private socket: WebSocket | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly eventListeners = new Map<string, Set<(params: unknown) => void>>();

  connect(webSocketDebuggerUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // The RN dev-middleware inspector proxy verifies the `Origin` header
      // against an allowlist (localhost/127.0.0.1/etc) and rejects the
      // handshake if it's absent — which it is by default for a Node client.
      // The `ws` package (unlike the global WebSocket) lets us set it.
      const socket = new WebSocket(webSocketDebuggerUrl, {
        headers: { origin: "http://localhost" },
      });
      const onOpen = (): void => {
        cleanup();
        resolve();
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(new Error(`Failed to connect to ${webSocketDebuggerUrl}: ${error.message}`));
      };
      const cleanup = (): void => {
        socket.off("open", onOpen);
        socket.off("error", onError);
      };
      socket.on("open", onOpen);
      socket.on("error", onError);
      socket.on("message", (data) => {
        this.handleMessage(data.toString());
      });
      this.socket = socket;
    });
  }

  private handleMessage(raw: string): void {
    let message: CdpMessage;
    try {
      message = JSON.parse(raw) as CdpMessage;
    } catch {
      return;
    }

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(`CDP error ${message.error.code}: ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      const listeners = this.eventListeners.get(message.method);
      if (listeners) {
        for (const listener of listeners) {
          listener(message.params);
        }
      }
    }
  }

  send<T = unknown>(method: string, params?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    if (!this.socket) {
      return Promise.reject(new Error("CdpClient is not connected"));
    }
    const socket = this.socket;
    const id = this.nextId++;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      socket.send(JSON.stringify({ id, method, ...(params !== undefined && { params }) }));
    });
  }

  on(method: string, listener: (params: unknown) => void): () => void {
    let listeners = this.eventListeners.get(method);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(method, listeners);
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  close(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("CdpClient closed"));
    }
    this.pending.clear();
    this.eventListeners.clear();
    this.socket?.close();
    this.socket = undefined;
  }
}
