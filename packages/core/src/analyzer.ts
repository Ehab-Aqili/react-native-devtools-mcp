import type { Finding } from "@rn-devtools/shared";

/** Pure transform from a collector's raw capture to findings — no I/O, no device access. */
export interface Analyzer<TRaw = unknown> {
  readonly id: string;
  analyze(raw: TRaw): Finding[] | Promise<Finding[]>;
}
