import type { Analyzer } from "./analyzer.js";
import type { Collector } from "./collector.js";

/** Central lookup for collectors and analyzers, keyed by their stable id. */
export class PluginRegistry {
  private readonly collectors = new Map<string, Collector>();
  private readonly analyzers = new Map<string, Analyzer>();

  registerCollector(collector: Collector): void {
    if (this.collectors.has(collector.id)) {
      throw new Error(`Collector already registered: ${collector.id}`);
    }
    this.collectors.set(collector.id, collector);
  }

  getCollector<T extends Collector = Collector>(id: string): T {
    const collector = this.collectors.get(id);
    if (!collector) {
      throw new Error(`Unknown collector: ${id}`);
    }
    return collector as T;
  }

  listCollectors(): Collector[] {
    return [...this.collectors.values()];
  }

  registerAnalyzer(analyzer: Analyzer): void {
    if (this.analyzers.has(analyzer.id)) {
      throw new Error(`Analyzer already registered: ${analyzer.id}`);
    }
    this.analyzers.set(analyzer.id, analyzer);
  }

  getAnalyzer<T extends Analyzer = Analyzer>(id: string): T {
    const analyzer = this.analyzers.get(id);
    if (!analyzer) {
      throw new Error(`Unknown analyzer: ${id}`);
    }
    return analyzer as T;
  }

  listAnalyzers(): Analyzer[] {
    return [...this.analyzers.values()];
  }

  /** Disposes every connected collector, e.g. on server shutdown. */
  async disposeAll(): Promise<void> {
    await Promise.all([...this.collectors.values()].map((collector) => collector.dispose()));
  }
}
