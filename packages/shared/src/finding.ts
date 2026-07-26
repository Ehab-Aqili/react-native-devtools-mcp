export type Severity = "info" | "warning" | "critical";

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  readonly category: string;
  readonly title: string;
  readonly message: string;
  readonly location?: string;
  readonly evidence?: Record<string, unknown>;
}
