/**
 * Rough token estimate (~4 chars/token for English/code text). Good enough for
 * budgeting decisions — we don't need exact tokenizer parity here.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface Truncated<T> {
  readonly items: T[];
  readonly truncatedCount: number;
}

export function truncateList<T>(items: readonly T[], max: number): Truncated<T> {
  if (items.length <= max) {
    return { items: [...items], truncatedCount: 0 };
  }
  return { items: items.slice(0, max), truncatedCount: items.length - max };
}

export interface DedupedEntry<T> {
  readonly item: T;
  readonly count: number;
}

/** Collapse repeated items (e.g. identical log lines) into one entry + a count. */
export function dedupeCount<T>(items: readonly T[], keyFn: (item: T) => string): DedupedEntry<T>[] {
  const order: string[] = [];
  const map = new Map<string, DedupedEntry<T>>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (existing) {
      map.set(key, { item: existing.item, count: existing.count + 1 });
    } else {
      order.push(key);
      map.set(key, { item, count: 1 });
    }
  }
  return order.map((key) => map.get(key)!);
}
