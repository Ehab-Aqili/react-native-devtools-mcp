# Tool Reference

All tools return the shared `Result<T>` envelope: `{ ok: true, data }` on success or
`{ ok: false, error: { code, message } }` on failure — thrown errors (including a specific
`ToolError` code) are caught and converted rather than crashing the server. Parameters marked
**required** have no default; everything else is optional.

Typical flow: call [`list_devices`](#list_devices) first to get a `webSocketDebuggerUrl` (for the
Hermes/React DevTools tools) and, if you need the native tools, an adb `serial` or iOS
`deviceUdid` — matched by device name between the two lists.

## Discovery

### `server_info`

Reports server identity, resolved config, and which collectors/analyzers are registered.

| Param    | Type                              | Notes                                  |
| -------- | --------------------------------- | -------------------------------------- |
| `detail` | `"summary" \| "normal" \| "full"` | `summary` omits the full config object |

### `list_devices`

Discovers everything available to attach to: Metro's JS debugging targets, connected Android
devices (`adb`), and iOS simulators/physical devices.

| Param       | Type     | Notes                                                                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `metroHost` | `string` | defaults to configured `metro.host` (`localhost`)                                                                           |
| `metroPort` | `number` | defaults to configured `metro.port` (**check the project's actual Metro port** — many projects override the `8081` default) |

Returns `{ metro: { host, port, running, pages: [{ id, deviceName, title, webSocketDebuggerUrl }] }, android: [{ serial, state, model?, product? }], ios: { simulators: [...], devices: [{ name, udid, online }] } }`.

## Metro

### `reload_app`

Triggers a full reload of every app currently connected to Metro. **Destructive** — restarts the
running app immediately (`annotations.destructiveHint: true`). Confirm with the user before
calling this against a live device they're actively using.

| Param       | Type     |
| ----------- | -------- |
| `metroHost` | `string` |
| `metroPort` | `number` |

## Hermes

### `capture_heap`

Takes a Hermes heap snapshot and returns an analyzed digest — never the raw file.

| Param                  | Type                              | Notes                        |
| ---------------------- | --------------------------------- | ---------------------------- |
| `webSocketDebuggerUrl` | `string`                          | **required**                 |
| `detail`               | `"summary" \| "normal" \| "full"` | `summary` caps findings to 5 |

Returns `{ handleId, filePath, byteSize, nodeCount, durationMs, findings: Finding[], findingsTruncated }`.
Pass `filePath` to `compare_heaps` for growth analysis.

### `compare_heaps`

Compares two heap snapshot files (from two `capture_heap` calls) for object-count and per-type
size growth — the strongest available leak signal.

| Param            | Type                   |
| ---------------- | ---------------------- |
| `beforeFilePath` | `string`, **required** |
| `afterFilePath`  | `string`, **required** |

Returns `{ beforeNodeCount, afterNodeCount, findings: Finding[] }`.

### `capture_cpu_profile`

Records a Hermes CPU profile and returns the top functions by self time.

| Param                  | Type     | Notes                 |
| ---------------------- | -------- | --------------------- |
| `webSocketDebuggerUrl` | `string` | **required**          |
| `durationMs`           | `number` | 1-60000, default 3000 |

Returns `{ handleId, filePath, durationMs, sampleCount, topFunctions: [{ functionName, url, lineNumber, selfTimeMs, selfTimePercent }] }`.

### `evaluate_expression`

Evaluates a JS expression directly in the Hermes runtime. A throwing expression returns its error
message rather than failing the tool call.

| Param                  | Type                   |
| ---------------------- | ---------------------- |
| `webSocketDebuggerUrl` | `string`, **required** |
| `expression`           | `string`, **required** |

Returns `{ resultType, value? , exception? }`.

### `collect_garbage`

Forces a Hermes GC pass (`HeapProfiler.collectGarbage`). Useful right before `capture_heap` for a
clean baseline.

| Param                  | Type                   |
| ---------------------- | ---------------------- |
| `webSocketDebuggerUrl` | `string`, **required** |

Returns `{ ok: true, durationMs }`.

## React DevTools

### `inspect_component`

Reads the live React fiber tree via `__REACT_DEVTOOLS_GLOBAL_HOOK__` (component names, props,
hooks, class state, render timings — see [ARCHITECTURE.md](ARCHITECTURE.md) for why this doesn't
use the real DevTools Bridge protocol).

| Param                  | Type                              | Notes                                                                                     |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `webSocketDebuggerUrl` | `string`                          | **required**                                                                              |
| `detail`               | `"summary" \| "normal" \| "full"` | ignored (forced to `full`) when `componentName` is given                                  |
| `componentName`        | `string`                          | if given, returns just that component's subtree + ancestor path instead of the whole tree |

Without `componentName`: returns `{ rendererId, nodeCount, truncated, trees: FiberNode[] }`.
With `componentName`: returns `{ rendererId, path, component: FiberNode }` or
`{ rendererId, found: false, message }` if not found.

## Android

### `capture_android_perf`

Captures `dumpsys gfxinfo` (frame timing/jank) and `meminfo` (memory breakdown) for a package, plus
FPS-analyzer findings.

| Param         | Type                                                     |
| ------------- | -------------------------------------------------------- |
| `serial`      | `string`, **required** — adb serial, from `list_devices` |
| `packageName` | `string`, **required** — e.g. `com.example.app`          |

Returns `{ gfxinfo, meminfo, findings: Finding[] }`.

### `capture_perfetto_trace`

Captures a short system-wide Perfetto trace and pulls it to disk (binary protobuf — open in
[ui.perfetto.dev](https://ui.perfetto.dev) for deep analysis, not parsed here).

| Param        | Type     | Notes                 |
| ------------ | -------- | --------------------- |
| `serial`     | `string` | **required**          |
| `durationMs` | `number` | 1-30000, default 5000 |

Returns `{ handleId, filePath, byteSize, durationMs }`.

## iOS

### `record_ios_trace`

Records a short Instruments trace by attaching to a running process, on a simulator or physical
device. Returns a best-effort CPU/memory summary — see [ARCHITECTURE.md](ARCHITECTURE.md) for the
known limitation on memory-sample completeness.

| Param         | Type     | Notes                                                              |
| ------------- | -------- | ------------------------------------------------------------------ |
| `deviceUdid`  | `string` | **required** — from `list_devices`' `ios.simulators`/`ios.devices` |
| `processName` | `string` | **required** — the running app's process name                      |
| `template`    | `string` | Instruments template name, default `"Activity Monitor"`            |
| `durationMs`  | `number` | 1-30000, default 3000                                              |

Returns `{ handleId, filePath, byteSize, durationMs, template, summary?: { cpuPercentAvg, cpuPercentMax, memoryMiBAvg, memoryMiBMax, sampleCount } }`.

## Cross-cutting analysis

### `analyze_project`

A one-call sweep: render timing (fiber tree + commit profile), and — if Android params are given —
frame/jank stats. Good as a first pass before drilling into a specific tool.

| Param                  | Type     | Notes                                   |
| ---------------------- | -------- | --------------------------------------- |
| `webSocketDebuggerUrl` | `string` | **required**                            |
| `androidSerial`        | `string` | give together with `androidPackageName` |
| `androidPackageName`   | `string` | give together with `androidSerial`      |

Returns `{ ranAnalyzers: string[], summary: { critical, warning, info }, findings: Finding[] }`.

## Reports

### `generate_report`

Renders a findings list (from any tool above) into a saved JSON/Markdown/HTML report, returning a
handle + short preview rather than the full content.

| Param             | Type                                                                                           | Notes                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `title`           | `string`, **required**                                                                         |
| `findings`        | `Finding[]`, **required** — `{ id, severity, category, title, message, location?, evidence? }` |
| `format`          | `"json" \| "markdown" \| "html"`, **required**                                                 |
| `subtitle`        | `string`                                                                                       |                                                                             |
| `groupByCategory` | `boolean`                                                                                      | splits findings into one section per `category` instead of one flat section |

Returns `{ handleId, filePath, format, byteSize, preview, previewTruncated }`.

## Resources

### `config://active`

The fully-resolved server configuration (defaults + config file + env + overrides), as JSON.

## Prompts

### `triage_performance`

Guides an investigation of a reported performance symptom using the tools above, favoring
`summary` detail and the fewest tool calls needed for a confident diagnosis.

| Arg       | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| `symptom` | `string`, **required** — free-text description of the reported issue |
