import type { DetailLevel } from "@rn-devtools/shared";

export interface ReactDevtoolsConnectOptions {
  readonly webSocketDebuggerUrl: string;
}

export type ReactDevtoolsCaptureParams =
  | { readonly action: "fiber_tree"; readonly detail?: DetailLevel }
  | { readonly action: "commit_profile" };

export interface FiberHook {
  readonly index: number;
  readonly value: unknown;
}

export interface FiberNode {
  readonly name: string;
  readonly key: string | null;
  readonly props: Record<string, unknown>;
  readonly state?: unknown;
  readonly hooks?: FiberHook[];
  readonly actualDuration?: number;
  readonly selfBaseDuration?: number;
  readonly treeBaseDuration?: number;
  readonly children: FiberNode[];
}

export interface FiberTreeResult {
  readonly action: "fiber_tree";
  readonly rendererId: number;
  readonly nodeCount: number;
  readonly truncated: boolean;
  readonly trees: FiberNode[];
}

export interface SlowComponent {
  readonly name: string;
  readonly actualDuration: number;
}

export interface CommitProfileRoot {
  readonly rootActualDuration: number;
  readonly nodeCount: number;
  readonly slowestComponents: SlowComponent[];
}

export interface CommitProfileResult {
  readonly action: "commit_profile";
  readonly rendererId: number;
  readonly roots: CommitProfileRoot[];
}

export type ReactDevtoolsCaptureResult = FiberTreeResult | CommitProfileResult;

/** Shape of the plain-object payload the in-runtime walker script evaluates to. */
export interface RawWalkerError {
  readonly error: string;
}

export interface RawFiberTreeOutput {
  readonly rendererId: number;
  readonly nodeCount: number;
  readonly truncated: boolean;
  readonly trees: FiberNode[];
}

export interface RawCommitProfileOutput {
  readonly rendererId: number;
  readonly roots: CommitProfileRoot[];
}
