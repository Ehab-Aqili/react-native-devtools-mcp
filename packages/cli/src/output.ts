export function printHeader(title: string): void {
  process.stdout.write(`\n${title}\n${"-".repeat(title.length)}\n`);
}

export type CheckStatus = "pass" | "warn" | "fail";

export function printCheck(status: CheckStatus, label: string, detail?: string): void {
  const marker = status === "pass" ? "[ OK ]" : status === "warn" ? "[WARN]" : "[FAIL]";
  process.stdout.write(`${marker} ${label}${detail ? ` — ${detail}` : ""}\n`);
}

export function printFinding(severity: string, title: string, message: string): void {
  process.stdout.write(`  [${severity.toUpperCase()}] ${title}\n      ${message}\n`);
}

export function printError(message: string): void {
  process.stderr.write(`error: ${message}\n`);
}
