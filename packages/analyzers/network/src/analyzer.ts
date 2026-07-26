import type { Analyzer } from "@rn-devtools/core";
import type { Finding } from "@rn-devtools/shared";
import type { NetworkRequest } from "./types.js";

export interface NetworkAnalyzerOptions {
  readonly slowRequestMs?: number;
  readonly largePayloadBytes?: number;
  readonly duplicateRequestThreshold?: number;
}

const DEFAULT_OPTIONS: Required<NetworkAnalyzerOptions> = {
  slowRequestMs: 1000,
  largePayloadBytes: 1024 * 1024,
  duplicateRequestThreshold: 3,
};

function requestKey(request: NetworkRequest): string {
  return `${request.method} ${request.url}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

/** Analyzes a batch of captured network requests: failures, slow requests, large payloads, duplicates. */
export class NetworkAnalyzer implements Analyzer<NetworkRequest[]> {
  readonly id = "network";

  private readonly options: Required<NetworkAnalyzerOptions>;

  constructor(options: NetworkAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  analyze(requests: NetworkRequest[]): Finding[] {
    const findings: Finding[] = [];
    const requestCounts = new Map<string, NetworkRequest[]>();

    for (const request of requests) {
      const key = requestKey(request);
      const bucket = requestCounts.get(key) ?? [];
      bucket.push(request);
      requestCounts.set(key, bucket);

      if (request.failed || (request.statusCode !== undefined && request.statusCode >= 400)) {
        findings.push({
          id: `network.failed.${key}.${request.startTime}`,
          severity: "critical",
          category: "network",
          title: "Failed request",
          message: request.failed
            ? `${key} failed: ${request.errorText ?? "unknown error"}`
            : `${key} returned HTTP ${request.statusCode}`,
          location: request.url,
          evidence: { method: request.method, url: request.url, statusCode: request.statusCode },
        });
        continue;
      }

      if (request.endTime !== undefined) {
        const durationMs = request.endTime - request.startTime;
        if (durationMs >= this.options.slowRequestMs) {
          findings.push({
            id: `network.slow.${key}.${request.startTime}`,
            severity: durationMs >= this.options.slowRequestMs * 3 ? "critical" : "warning",
            category: "network",
            title: "Slow request",
            message: `${key} took ${durationMs}ms, above the ${this.options.slowRequestMs}ms threshold.`,
            location: request.url,
            evidence: { method: request.method, url: request.url, durationMs },
          });
        }
      }

      if (
        request.transferSize !== undefined &&
        request.transferSize >= this.options.largePayloadBytes
      ) {
        findings.push({
          id: `network.large-payload.${key}.${request.startTime}`,
          severity: "warning",
          category: "network",
          title: "Large payload",
          message: `${key} transferred ${formatBytes(request.transferSize)}, above the ${formatBytes(this.options.largePayloadBytes)} threshold.`,
          location: request.url,
          evidence: {
            method: request.method,
            url: request.url,
            transferSize: request.transferSize,
          },
        });
      }
    }

    for (const [key, bucket] of requestCounts) {
      const first = bucket[0];
      if (first && bucket.length >= this.options.duplicateRequestThreshold) {
        findings.push({
          id: `network.duplicate-requests.${key}`,
          severity: "warning",
          category: "network",
          title: "Repeated identical request",
          message: `${key} was requested ${bucket.length} times — consider caching or deduplicating.`,
          location: first.url,
          evidence: { method: first.method, url: first.url, count: bucket.length },
        });
      }
    }

    return findings;
  }
}
