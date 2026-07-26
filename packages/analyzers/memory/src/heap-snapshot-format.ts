export interface HeapSnapshotMeta {
  readonly nodeFields: string[];
  readonly nodeTypes: string[];
  readonly edgeFields: string[];
  readonly edgeTypes: string[];
}

/**
 * A loaded Chrome DevTools / V8 heap snapshot (the format Hermes's
 * `HeapProfiler.takeHeapSnapshot` produces — verified in Step 6). `nodes`
 * and `edges` are flat arrays: each node/edge occupies a fixed-width stride
 * of `meta.nodeFields.length` / `meta.edgeFields.length` consecutive slots.
 */
export interface ParsedHeapSnapshot {
  readonly meta: HeapSnapshotMeta;
  readonly nodes: number[];
  readonly edges: number[];
  readonly strings: string[];
  readonly nodeCount: number;
}

export interface HeapNodeView {
  readonly type: string;
  readonly name: string;
  readonly id: number;
  readonly selfSize: number;
  readonly edgeCount: number;
}

/** Iterates `snapshot.nodes` yielding a decoded view per node, field order read from `meta`. */
export function* iterateNodes(snapshot: ParsedHeapSnapshot): Generator<HeapNodeView> {
  const { nodeFields, nodeTypes } = snapshot.meta;
  const stride = nodeFields.length;
  const typeIdx = nodeFields.indexOf("type");
  const nameIdx = nodeFields.indexOf("name");
  const idIdx = nodeFields.indexOf("id");
  const selfSizeIdx = nodeFields.indexOf("self_size");
  const edgeCountIdx = nodeFields.indexOf("edge_count");

  const { nodes, strings } = snapshot;
  for (let offset = 0; offset < nodes.length; offset += stride) {
    const typeNumber = nodes[offset + typeIdx] ?? 0;
    const nameIndex = nodes[offset + nameIdx] ?? 0;
    yield {
      type: nodeTypes[typeNumber] ?? "unknown",
      name: strings[nameIndex] ?? "",
      id: nodes[offset + idIdx] ?? 0,
      selfSize: nodes[offset + selfSizeIdx] ?? 0,
      edgeCount: nodes[offset + edgeCountIdx] ?? 0,
    };
  }
}
