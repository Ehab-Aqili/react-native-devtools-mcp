import type { Finding } from "@rn-devtools/shared";

export type ReportFormat = "json" | "markdown" | "html";

export interface ReportSection {
  readonly title: string;
  readonly summary?: string;
  readonly findings?: Finding[];
  /** Arbitrary structured data to render as a key/value table (e.g. raw gfxinfo numbers). */
  readonly data?: Record<string, unknown>;
}

export interface ReportInput {
  readonly title: string;
  readonly generatedAt: string;
  readonly subtitle?: string;
  readonly sections: ReportSection[];
}
