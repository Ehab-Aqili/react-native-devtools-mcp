export interface HermesConnectOptions {
  readonly webSocketDebuggerUrl: string;
  /** Directory heavy artifacts (heap snapshots, CPU profiles) are written under. */
  readonly dataDir?: string;
}

export type HermesCaptureParams =
  | { readonly action: "heap_snapshot" }
  | { readonly action: "cpu_profile"; readonly durationMs?: number }
  | { readonly action: "evaluate"; readonly expression: string }
  | { readonly action: "collect_garbage" };

export interface HeapSnapshotResult {
  readonly action: "heap_snapshot";
  readonly handleId: string;
  readonly filePath: string;
  readonly byteSize: number;
  readonly chunkCount: number;
  readonly durationMs: number;
}

export interface CpuProfileTopFunction {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly selfTimeMs: number;
  readonly selfTimePercent: number;
}

export interface CpuProfileResult {
  readonly action: "cpu_profile";
  readonly handleId: string;
  readonly filePath: string;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly topFunctions: CpuProfileTopFunction[];
}

export interface EvaluateResult {
  readonly action: "evaluate";
  readonly resultType: string;
  readonly value?: unknown;
  readonly exception?: string;
}

export interface CollectGarbageResult {
  readonly action: "collect_garbage";
  readonly ok: true;
  readonly durationMs: number;
}

export type HermesCaptureResult =
  HeapSnapshotResult | CpuProfileResult | EvaluateResult | CollectGarbageResult;

export interface CpuProfileNode {
  readonly id: number;
  readonly callFrame: {
    readonly functionName: string;
    readonly url: string;
    readonly lineNumber: number;
  };
}

export interface RawCpuProfile {
  readonly nodes: CpuProfileNode[];
  readonly startTime: number;
  readonly endTime: number;
  readonly samples: number[];
  readonly timeDeltas: number[];
}
