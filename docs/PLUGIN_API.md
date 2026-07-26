# Plugin API — adding a new Collector or Analyzer

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture. This doc is a practical walkthrough
of adding a new one of each, using a real gap in the current codebase as the worked example: there
is no live collector feeding `@rn-devtools/analyzer-network` yet (it was built and fixture-tested
against a generic `NetworkRequest` shape — see its README note in
`packages/analyzers/network/src/types.ts`). Wiring a real network collector is exactly the kind of
addition this API is meant for.

## The two interfaces (`packages/core`)

```ts
interface Collector<TOptions = unknown, TRaw = unknown> {
  readonly id: string;
  readonly platform: Platform | "any"; // "android" | "ios" | "any"
  readonly isConnected: boolean;
  connect(options: TOptions): Promise<void>;
  capture(params?: unknown): Promise<TRaw>;
  dispose(): Promise<void>;
}

interface Analyzer<TRaw = unknown> {
  readonly id: string;
  analyze(raw: TRaw): Finding[] | Promise<Finding[]>;
}
```

Rules of thumb, established by every existing collector/analyzer in this repo:

- **Collectors do I/O; analyzers don't.** If your analyzer needs to read a file, put that in a
  separate exported loader function (see `loadHeapSnapshot()` in `analyzer-memory`), not inside
  `analyze()`. This keeps analyzers testable with a plain fixture object and no device.
- **`capture()` params are a discriminated union** keyed by an `action` field when a collector
  supports more than one kind of capture (see `HermesCaptureParams` /`HermesCaptureResult` in
  `collector-hermes`). Callers narrow the result with `if (result.action !== "x") throw ...`
  before accessing action-specific fields — TypeScript can't narrow a fixed union return type
  from the input alone.
- **Large artifacts are handles, not payloads.** If a capture could be more than a few KB, write it
  to disk under a caller-supplied `dataDir` and return `{ handleId, filePath, byteSize, ... }` —
  see `capturePerfettoTrace()` / `captureHeapSnapshot()`.
- **A `detail` param when output size varies.** Use `DetailLevelSchema` from `@rn-devtools/shared`
  (`"summary" | "normal" | "full"`) and cap output accordingly. See `WALK_OPTIONS_BY_DETAIL` in
  `collector-react-devtools`'s `collector.ts` for the pattern.

## Worked example: a network collector

### 1. Scaffold the package

Copy the shape any existing collector package uses:

```
packages/collectors/network/
├─ package.json    # name "@rn-devtools/collector-network", deps: @rn-devtools/core, @rn-devtools/shared
├─ tsconfig.json    # extends ../../../tsconfig.base.json, references ../../core and ../../shared
└─ src/
   ├─ types.ts
   ├─ collector.ts
   └─ index.ts
```

Add it to the root `pnpm-workspace.yaml` glob (already covers `packages/collectors/*`, so no
change needed there) and run `pnpm install` once the `package.json` exists.

### 2. Implement the collector

A real network collector would speak CDP's `Network` domain over the same kind of connection
`collector-hermes`'s `CdpClient` already establishes (`Network.enable`, listen for
`requestWillBeSent`/`responseReceived`/`loadingFinished` events, correlate by `requestId`). Reuse
`CdpClient` from `@rn-devtools/collector-hermes` rather than writing a new websocket client — see
how `collector-react-devtools` does exactly this.

```ts
// packages/collectors/network/src/collector.ts
import type { Collector } from "@rn-devtools/core";
import { CdpClient } from "@rn-devtools/collector-hermes";
import type { NetworkRequest } from "@rn-devtools/analyzer-network";

export class NetworkCollector implements Collector<
  { webSocketDebuggerUrl: string },
  NetworkRequest[]
> {
  readonly id = "network";
  readonly platform = "any" as const;
  private readonly cdp = new CdpClient();
  private readonly requests: NetworkRequest[] = [];
  private connected = false;

  get isConnected() {
    return this.connected;
  }

  async connect(options: { webSocketDebuggerUrl: string }) {
    await this.cdp.connect(options.webSocketDebuggerUrl);
    await this.cdp.send("Network.enable");
    this.cdp.on("Network.requestWillBeSent", (params) => {
      /* record start */
    });
    this.cdp.on("Network.loadingFinished", (params) => {
      /* record end, push to this.requests */
    });
    this.connected = true;
  }

  async capture(): Promise<NetworkRequest[]> {
    return [...this.requests]; // snapshot of what's been observed since connect()
  }

  async dispose() {
    this.cdp.close();
    this.connected = false;
  }
}
```

Note this reuses the _existing_ `NetworkRequest` type from `@rn-devtools/analyzer-network` instead
of defining a new one — the analyzer was deliberately built against a stable, documented shape so
a real collector could target it directly.

### 3. Wire it into the server

In `packages/server/src/tools/`, add a tool following the `capture-android-perf.ts` pattern:
connect the collector, `capture()`, hand the raw array to
`ctx.registry.getAnalyzer<NetworkAnalyzer>("network")` (already registered in `analyzers.ts` since
Step 10), return `ok({ requests, findings })`. Register it in `tools/index.ts`'s
`registerDomainTools()`. Add `@rn-devtools/collector-network` to `packages/server/package.json`
and a matching `tsconfig.json` reference.

## Adding just an analyzer (no new collector)

If you already have a raw data shape (from an existing collector, a fixture, or a file), you only
need `packages/analyzers/<name>/src/analyzer.ts` implementing `Analyzer<TRaw>`, registered in
`packages/server/src/analyzers.ts`'s `registerAnalyzers()`. See `analyzer-fps` for the simplest
complete example — one file, one class, a handful of threshold-based `Finding`s.
