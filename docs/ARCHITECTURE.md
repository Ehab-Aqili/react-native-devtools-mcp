# Architecture

## Data flow

```
MCP tool call
   │
   ▼
Collector.connect(options) → Collector.capture(params)   (raw data, I/O, one device/session)
   │
   ▼
Analyzer.analyze(raw)                                     (pure function → Finding[])
   │
   ▼
Result envelope { ok: true, data } | { ok: false, error }  (what the MCP client actually sees)
```

`Collector` and `Analyzer` (defined in `packages/core`) are deliberately split:

```ts
interface Collector<TOptions = unknown, TRaw = unknown> {
  readonly id: string;
  readonly platform: Platform | "any";
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

Collectors do I/O (CDP websockets, `adb`, `xcrun`) and know nothing about analysis. Analyzers are
pure — no device, no network, no filesystem in the common case — which is what makes them
trivially testable with a captured fixture instead of a live device. The one exception is the
memory analyzer's `loadHeapSnapshot()`, which is a separate I/O-boundary function from
`MemoryAnalyzer.analyze()` itself (which stays pure over the parsed structure) — see
[PLUGIN_API.md](PLUGIN_API.md) for why that split matters.

Every MCP tool in `packages/server/src/tools/` follows the same shape: construct a collector,
`connect()`, `capture()`, optionally hand the raw result to a registered analyzer, `dispose()` in
a `finally`. Tool calls are self-contained — connect and dispose within the single call — rather
than holding a long-lived session across calls, so there's no dangling-connection state to manage
between requests.

## Token efficiency

This is the server's core design constraint, not a nice-to-have:

- **Handle-based artifacts.** Anything that could be large (heap snapshots, CPU/Instruments/
  Perfetto traces) is written to disk under `dataDir` (default `.rn-devtools/`, configurable) and
  the tool returns `{ handleId, filePath, byteSize, ... }` plus an already-computed digest —
  never the raw bytes. `capture_heap` parses the snapshot itself and returns `MemoryAnalyzer`
  findings; the ~60MB file stays on disk.
- **`detail` parameter.** Tools that can produce a lot of data (`capture_heap`, `inspect_component`)
  accept `detail: "summary" | "normal" | "full"` (see `DetailLevelSchema` in `packages/shared`).
  `summary` is the default everywhere.
- **On-device summarization.** The React DevTools collector doesn't ship a raw fiber graph over
  the wire — it evaluates a tree-walking script _inside_ the Hermes runtime (depth/node caps,
  string truncation, all baked into the generated JS) and only the already-small result crosses
  the CDP connection.
- **Dedup/truncate utilities** in `packages/shared/src/token-budget.ts` (`estimateTokens`,
  `truncateList`, `dedupeCount`) — used by the Metro collector to collapse repeated log lines into
  `{ message, count }` rather than repeating them N times.

## Package dependency graph

```
shared ← core ← {collectors/*, analyzers/*} ← server ← cli
                        │                        ↑
                        └── reports ─────────────┘
```

A few non-obvious edges, added as they became necessary rather than planned upfront:

- `collector-react-devtools` depends on `collector-hermes` — it reuses `collector-hermes`'s
  CDP client (`CdpClient`, built for the `ws`-based Origin-header workaround below) rather than
  duplicating a websocket client.
- `analyzer-render` depends on `collector-react-devtools` and `analyzer-fps` depends on
  `collector-android` — each analyzer's `analyze()` signature is typed against that collector's
  real capture-result shape, not a generic placeholder.
- `analyzer-network` and `analyzer-bundle` depend on nothing collector-side. No Step 5-8 collector
  produces network requests or per-module bundle stats, so these two are built and tested against
  well-documented generic shapes (CDP `Network.*` fields; a module path+size list). A future
  collector can feed them directly once it exists.

## Server internals (`packages/server`)

- `server.ts` — `createServer()`: loads config, builds the stderr-only logger, constructs a
  `PluginRegistry`, registers all 6 analyzers into it (`analyzers.ts`), builds the `McpServer`,
  registers builtins (`server_info` tool, `config://active` resource, `triage_performance`
  prompt) and all domain tools (`tools/index.ts`).
- `run.ts` / `main.ts` — connects `StdioServerTransport`, handles `SIGINT`/`SIGTERM` by disposing
  every registered collector and closing the server before exit.
- `tools.ts` / `resources.ts` / `prompts.ts` — thin wrappers around the MCP SDK's
  `registerTool`/`registerResource`/`registerPrompt`. `registerTool`'s wrapper is the important
  one: it catches everything a handler throws (including `ToolError` for a specific error code)
  and converts it into `{ ok: false, error }` instead of crashing the process or leaking a raw
  stack trace to the client.
- **Logging is stderr-only.** stdout is the MCP protocol channel; the logger
  (`packages/core/src/logger.ts`) writes structured JSON lines to `process.stderr` and nowhere
  else. This was verified with a smoke test that intercepted both streams during development.

## Config layering (`packages/core/src/config.ts`)

Resolution order, lowest to highest precedence: zod schema defaults → `rn-devtools.config.json`
(or `.rn-devtools.config.json`) in the working directory → `RN_DEVTOOLS_*` environment variables
→ explicit `overrides` passed to `loadConfig()` (mainly for tests/programmatic use). See the root
README's configuration table for the actual keys.

## Protocol grounding — real findings from building this

These came from reading the actual installed dependencies of a real RN 0.85 app and live-testing
against real devices, not from documentation:

- **Metro discovery**: `GET /json/list` on the Metro dev server returns every connected app's CDP
  `webSocketDebuggerUrl` — the single entry point Steps 6 and 7 both use. `/status`, `/reload`,
  and the `/events`/`/hot` websockets come from `@react-native-community/cli-server-api`
  (bundled into the dev server), not Metro core itself.
- **Hermes CDP quirks**: connecting requires the `ws` npm package, not Node's native `WebSocket`
  global — the RN dev-middleware inspector proxy verifies the handshake's `Origin` header against
  an allowlist, and only `ws` lets you set it. Also, Hermes's inspector doesn't implement
  `HeapProfiler.enable`/`Profiler.enable` at all (`-32601 Unsupported method`); the actual
  commands (`takeHeapSnapshot`, `collectGarbage`, `Profiler.start`/`stop`) work without them.
- **React DevTools**: the real Bridge wire protocol (operations-array tree diffing) lives inside a
  minified webpack bundle (`react-devtools-core/dist/standalone.js`), not published as a reusable
  library. Rather than reverse-engineer it, the collector reads
  `globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots()` directly via `Runtime.evaluate` —
  read-only, but covers fiber tree/props/hooks/state/timings without that risk.
- **iOS**: `xcrun xctrace record --attach <processName> --device <UDID>` works against physical
  devices, not just simulators. The exported trace XML uses an id/ref value-sharing scheme that
  the collector does not fully resolve (see `packages/collectors/ios/src/xctrace.ts`) — CPU%
  sampling is reliable, memory sampling can under-count over short capture windows.
