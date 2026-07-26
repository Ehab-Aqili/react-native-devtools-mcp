import { NetworkCollector } from "@rn-devtools/collector-network";

const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

interface Session {
  readonly collector: NetworkCollector;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages `NetworkCollector` instances that live *across* multiple tool
 * calls — the one deliberate exception to this server's usual "connect and
 * dispose within a single tool call" rule (see ARCHITECTURE.md). Network
 * capture needs to span however long it takes a person to reproduce a bug,
 * which a single bounded tool call can't do.
 *
 * Sessions auto-dispose after 15 minutes of inactivity (reset on every
 * `touch()`) so an agent that forgets to call `stopCapture` doesn't leak a
 * CDP connection forever.
 */
export class NetworkSessionManager {
  private readonly sessions = new Map<string, Session>();

  async startCapture(webSocketDebuggerUrl: string): Promise<string> {
    const collector = new NetworkCollector();
    await collector.connect({ webSocketDebuggerUrl });

    const sessionId = `net-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timer = setTimeout(() => {
      void this.stopCapture(sessionId);
    }, SESSION_IDLE_TIMEOUT_MS);
    this.sessions.set(sessionId, { collector, timer });
    return sessionId;
  }

  private touch(sessionId: string, session: Session): void {
    clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      void this.stopCapture(sessionId);
    }, SESSION_IDLE_TIMEOUT_MS);
  }

  private get(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(
        `Unknown network capture session "${sessionId}" — it may have already been stopped, or expired after ${SESSION_IDLE_TIMEOUT_MS / 60_000} minutes of inactivity.`,
      );
    }
    return session;
  }

  /** Returns what's been observed so far without ending the session. */
  async peek(sessionId: string, detail?: "summary" | "normal" | "full") {
    const session = this.get(sessionId);
    this.touch(sessionId, session);
    return session.collector.capture(detail !== undefined ? { detail } : {});
  }

  /** Returns the final snapshot and ends the session, disposing its connection. */
  async stopCapture(sessionId: string, detail?: "summary" | "normal" | "full") {
    const session = this.get(sessionId);
    clearTimeout(session.timer);
    this.sessions.delete(sessionId);
    const result = await session.collector.capture(detail !== undefined ? { detail } : {});
    await session.collector.dispose();
    return result;
  }

  async disposeAll(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.all(
      sessions.map((session) => {
        clearTimeout(session.timer);
        return session.collector.dispose();
      }),
    );
  }
}
