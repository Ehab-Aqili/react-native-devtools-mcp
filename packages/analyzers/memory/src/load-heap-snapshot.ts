import { readFile, stat } from "node:fs/promises";
import type { ParsedHeapSnapshot } from "./heap-snapshot-format.js";

const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;

interface RawHeapSnapshotFile {
  readonly snapshot: {
    readonly meta: {
      readonly node_fields: string[];
      readonly node_types: [string[], ...unknown[]];
      readonly edge_fields: string[];
      readonly edge_types: [string[], ...unknown[]];
    };
    readonly node_count: number;
  };
  readonly nodes: number[];
  readonly edges: number[];
  readonly strings: string[];
}

export interface LoadHeapSnapshotOptions {
  readonly maxBytes?: number;
}

/**
 * Reads and parses a `.heapsnapshot` file written by
 * `@rn-devtools/collector-hermes`'s `heap_snapshot` capture. This is the I/O
 * boundary — `MemoryAnalyzer.analyze()` itself stays a pure function over
 * the returned structure, per the Collector/Analyzer split.
 */
export async function loadHeapSnapshot(
  filePath: string,
  options: LoadHeapSnapshotOptions = {},
): Promise<ParsedHeapSnapshot> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const stats = await stat(filePath);
  if (stats.size > maxBytes) {
    throw new Error(
      `Heap snapshot at ${filePath} is ${stats.size} bytes, exceeding the ${maxBytes}-byte analysis limit`,
    );
  }

  const text = await readFile(filePath, "utf8");
  const parsed = JSON.parse(text) as RawHeapSnapshotFile;

  return {
    meta: {
      nodeFields: parsed.snapshot.meta.node_fields,
      nodeTypes: parsed.snapshot.meta.node_types[0],
      edgeFields: parsed.snapshot.meta.edge_fields,
      edgeTypes: parsed.snapshot.meta.edge_types[0],
    },
    nodes: parsed.nodes,
    edges: parsed.edges,
    strings: parsed.strings,
    nodeCount: parsed.snapshot.node_count,
  };
}
