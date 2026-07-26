export interface IosConnectOptions {
  readonly deviceUdid: string;
  readonly dataDir?: string;
}

export type IosCaptureParams =
  | { readonly action: "list_simulators" }
  | {
      readonly action: "record_trace";
      readonly processName: string;
      readonly template?: string;
      readonly durationMs?: number;
    };

export interface Simulator {
  readonly udid: string;
  readonly name: string;
  readonly state: string;
  readonly isAvailable: boolean;
  readonly runtime: string;
}

export interface ListSimulatorsResult {
  readonly action: "list_simulators";
  readonly simulators: Simulator[];
}

export interface InstrumentsTraceSummary {
  readonly cpuPercentAvg: number;
  readonly cpuPercentMax: number;
  readonly memoryMiBAvg: number;
  readonly memoryMiBMax: number;
  readonly sampleCount: number;
}

export interface InstrumentsTraceResult {
  readonly handleId: string;
  readonly filePath: string;
  readonly byteSize: number;
  readonly durationMs: number;
  readonly template: string;
  readonly summary?: InstrumentsTraceSummary;
}

export type IosCaptureResult =
  ListSimulatorsResult | ({ readonly action: "record_trace" } & InstrumentsTraceResult);
