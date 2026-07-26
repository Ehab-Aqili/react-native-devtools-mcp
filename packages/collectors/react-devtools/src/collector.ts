import type { Collector } from "@rn-devtools/core";
import { CdpClient } from "@rn-devtools/collector-hermes";
import type { DetailLevel } from "@rn-devtools/shared";
import { buildCommitProfileExpression, buildFiberTreeExpression } from "./fiber-tree-script.js";
import type { FiberTreeWalkOptions } from "./fiber-tree-script.js";
import type {
  CommitProfileResult,
  FiberTreeResult,
  RawCommitProfileOutput,
  RawFiberTreeOutput,
  RawWalkerError,
  ReactDevtoolsCaptureParams,
  ReactDevtoolsCaptureResult,
  ReactDevtoolsConnectOptions,
} from "./types.js";

interface EvaluateResponse {
  readonly result: { readonly type: string; readonly value?: unknown };
  readonly exceptionDetails?: { readonly text: string };
}

const WALK_OPTIONS_BY_DETAIL: Record<DetailLevel, FiberTreeWalkOptions> = {
  summary: {
    maxNodes: 50,
    maxDepth: 15,
    stringMaxLen: 40,
    includeProps: false,
    includeHooks: false,
    includeState: false,
  },
  normal: {
    maxNodes: 200,
    maxDepth: 30,
    stringMaxLen: 80,
    includeProps: true,
    includeHooks: true,
    includeState: true,
  },
  full: {
    maxNodes: 1000,
    maxDepth: 60,
    stringMaxLen: 200,
    includeProps: true,
    includeHooks: true,
    includeState: true,
  },
};

function isWalkerError(value: unknown): value is RawWalkerError {
  return typeof value === "object" && value !== null && "error" in value;
}

/**
 * Reads the live React fiber tree by evaluating a tree-walking script inside
 * the Hermes runtime via `__REACT_DEVTOOLS_GLOBAL_HOOK__` — the same global
 * hook `react-devtools-core` installs — rather than implementing the full
 * React DevTools Bridge wire protocol (operations-array tree diffing), which
 * isn't published as a reusable library. All summarization/truncation
 * happens on-device so only a small, already-capped object crosses the wire.
 */
export class ReactDevtoolsCollector implements Collector<
  ReactDevtoolsConnectOptions,
  ReactDevtoolsCaptureResult
> {
  readonly id = "react-devtools";
  readonly platform = "any" as const;

  private readonly cdp = new CdpClient();
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(options: ReactDevtoolsConnectOptions): Promise<void> {
    await this.cdp.connect(options.webSocketDebuggerUrl);
    await this.cdp.send("Runtime.enable");
    this.connected = true;
  }

  async capture(params: ReactDevtoolsCaptureParams): Promise<ReactDevtoolsCaptureResult> {
    switch (params.action) {
      case "fiber_tree":
        return this.captureFiberTree(params.detail ?? "summary");
      case "commit_profile":
        return this.captureCommitProfile();
    }
  }

  private async captureFiberTree(detail: DetailLevel): Promise<FiberTreeResult> {
    const expression = buildFiberTreeExpression(WALK_OPTIONS_BY_DETAIL[detail]);
    const output = await this.evaluateJson<RawFiberTreeOutput>(expression);
    return { action: "fiber_tree", ...output };
  }

  private async captureCommitProfile(): Promise<CommitProfileResult> {
    const expression = buildCommitProfileExpression();
    const output = await this.evaluateJson<RawCommitProfileOutput>(expression);
    return { action: "commit_profile", ...output };
  }

  private async evaluateJson<T>(expression: string): Promise<T> {
    const response = await this.cdp.send<EvaluateResponse>("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text);
    }
    const value = response.result.value;
    if (isWalkerError(value)) {
      throw new Error(value.error);
    }
    return value as T;
  }

  async dispose(): Promise<void> {
    this.cdp.close();
    this.connected = false;
  }
}
