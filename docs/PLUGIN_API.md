# Plugin API — adding a new Collector or Analyzer

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture. This doc is a practical walkthrough
of adding a new one of each, using the real `@rn-devtools/collector-network` package as the worked
example — it was added after `@rn-devtools/analyzer-network` already existed (built and
fixture-tested in Step 9 against a generic `NetworkRequest` shape, with no live data source yet),
which is exactly the situation this guide is written for: wiring a real collector up to an
analyzer that was deliberately built ahead of it.

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

## Worked example: `collector-network` (real, in the repo)

### 1. Scaffold the package

`packages/collectors/network/` — same shape as every other collector package: `package.json`
(`@rn-devtools/collector-network`, deps `@rn-devtools/core`, `@rn-devtools/shared`, and
`@rn-devtools/collector-hermes` for its CDP client), `tsconfig.json` (extends
`../../../tsconfig.base.json`, references `../../core`, `../../shared`, `../hermes`), and
`src/{types.ts,collector.ts,index.ts}`. `packages/collectors/*` was already covered by the root
`pnpm-workspace.yaml` glob; the new package just needed adding to the root `tsconfig.json`'s
`references` array, then `pnpm install` to link it.

### 2. Implement the collector

The key discovery that made this buildable at all: RN's Network tab is backed by **real** CDP
`Network.*` events, emitted natively (`RCTNetworking.mm` → `NetworkReporter` →
`jsinspector_modern::NetworkHandler` — see [ARCHITECTURE.md](ARCHITECTURE.md)), not a JS-side
interception hook the way one might assume. So the collector reuses `CdpClient` from
`@rn-devtools/collector-hermes` (the same pattern `collector-react-devtools` uses) exactly the way
any other CDP domain would be consumed:

- `network-client.ts` — `NetworkClient.connect()` sends `Network.enable`, then subscribes to
  `requestWillBeSent` / `responseReceived` / `loadingFinished` / `loadingFailed` and correlates
  them by `requestId` into a capped history array. One real CDP wrinkle it has to handle: a
  redirect re-fires `requestWillBeSent` for the _same_ `requestId` (with a `redirectResponse`
  field) — that leg has to be finalized into history before the id is reused for the new one, or
  the redirect's own status/timing gets silently dropped.
- `collector.ts` — `NetworkCollector implements Collector<NetworkConnectOptions, NetworkRequestRecord[]>`.
  `capture({ detail: "full" })` additionally calls `Network.getResponseBody(requestId)` per
  completed request (capped length, best-effort) — everything else skips body fetching entirely.

`NetworkRequestRecord` (in `types.ts`) is a type independently defined here, not imported from
`@rn-devtools/analyzer-network` — see [ARCHITECTURE.md](ARCHITECTURE.md#package-dependency-graph)
for why keeping collectors and analyzers decoupled in both directions was the deliberate choice,
relying on the two shapes being structurally compatible instead.

### 3. Wire it into the server

This is the one place `collector-network` didn't end up following the usual single-bounded-call
tool shape. The first version did (`connect → wait durationMs → capture → analyze → dispose`, one
tool call, following `capture-android-perf.ts`'s pattern) — but that doesn't fit how network
issues actually get diagnosed: the tool needs to be watching at the exact moment someone
reproduces a bug, which can take anywhere from seconds to several minutes, not a bounded window.
So it was reworked into three tools sharing a `NetworkSessionManager`
(`packages/server/src/network-sessions.ts`, threaded through `ServerContext`) that keeps a
`NetworkCollector` alive _across_ calls: `start_network_capture` connects and returns a
`sessionId` immediately, `get_network_requests` can be polled any number of times without ending
anything, and `stop_network_capture` disposes the connection and hands the raw array to
`ctx.registry.getAnalyzer<NetworkAnalyzer>("network")` (registered since Step 10, nothing to
change there). See [ARCHITECTURE.md](ARCHITECTURE.md#tool-lifecycle-exception-network-sessions)
for the full reasoning — this is the only tool in the server with cross-call state, and it's a
pattern worth reusing for anything else with the same "spans an unpredictable amount of real
time" shape. `@rn-devtools/collector-network` was added to both `packages/server` and
`packages/cli`'s `package.json`/`tsconfig.json` for parity with every other collector.

### 4. Verify it

There's no automated test suite in this repo (see [PLAN.md](../PLAN.md) — Step 13 was explicitly
skipped). The convention used throughout development instead: write a throwaway `.mjs` script
importing the built `dist/index.js`, run it against a real connected device, assert on the real
values you get back, then delete the script. `collector-network` was verified this way against a
real iPhone — triggering real `fetch()` calls (success, a 404, three identical duplicate requests,
a redirect) from a second Hermes connection while the network collector observed, confirming
correct status codes, correlation, the duplicate-request and failed-request analyzer findings, and
a real fetched response body at `detail: "full"`. (One thing that came up during that testing:
`httpbin.org` was transiently unreachable from the test network entirely — confirmed independently
via a direct `curl` from the host, unrelated to the collector — so the fixtures were switched to
`google.com` endpoints, which is worth remembering if a test service seems to be silently dropping
requests: check whether the service itself is reachable before suspecting the collector.)

The session tool trio was verified the same way, separately from the collector itself: confirmed
`start_network_capture` returns in well under a second (not blocking for a fixed window), that
`get_network_requests` correctly shows progressively more requests across repeated calls without
ending the session, that `stop_network_capture` returns real findings, and that using a `sessionId`
again after `stop` fails cleanly with a clear error rather than crashing the server.

## Adding just an analyzer (no new collector)

If you already have a raw data shape (from an existing collector, a fixture, or a file), you only
need `packages/analyzers/<name>/src/analyzer.ts` implementing `Analyzer<TRaw>`, registered in
`packages/server/src/analyzers.ts`'s `registerAnalyzers()`. See `analyzer-fps` for the simplest
complete example — one file, one class, a handful of threshold-based `Finding`s.
