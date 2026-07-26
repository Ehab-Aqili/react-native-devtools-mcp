import type { ReportInput } from "./types.js";

export function renderJson(input: ReportInput): string {
  return JSON.stringify(input, null, 2);
}
