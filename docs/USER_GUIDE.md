# Using rn-devtools-mcp (no coding required)

This guide is for anyone who wants to _use_ this tool with their AI assistant to check on a React
Native app's performance — you don't need to understand TypeScript, the codebase, or how MCP
servers work internally. If you want the technical details, see
[TOOL_REFERENCE.md](TOOL_REFERENCE.md) or [ARCHITECTURE.md](ARCHITECTURE.md) instead.

## What this actually does

Normally, checking why a React Native app is slow or leaking memory means running a bunch of
command-line tools yourself (Android's `adb`, Apple's Instruments, Chrome DevTools) and reading
through dense technical output. This tool lets your AI assistant (Claude, or any assistant that
supports MCP) do that directly — it can look at your app's live memory, see what's slow to render,
check for dropped frames, and hand you a summary in plain language, or a shareable report.

It only _looks_ at your app — it doesn't change your code. The one exception is explicitly
reloading the app, which it will only do if asked (see [Things to know](#things-to-know) below).

## What you need before starting

- Your React Native app, running the normal way you develop it (a simulator, an emulator, or a
  real phone/tablet plugged in) — with Metro (the bundler) running, like it already is when you
  run `npx react-native start` or `npm run start`.
- Node.js installed on your computer.
- If you're testing on Android: the Android SDK command-line tools (`adb`) — you already have
  this if you can run your app on an Android emulator or device.
- If you're testing on iOS: a Mac with Xcode installed — same idea, you already have this if you
  can run your app on a simulator or iPhone.

You do **not** need to install anything extra for the tool itself to inspect your app — it uses
the same tools your React Native setup already relies on.

## One-time setup

Someone with a terminal needs to do this once (ask a developer on your team if this isn't you):

```sh
pnpm install
pnpm build
```

## Connecting it to your AI assistant

If you're using an assistant that supports MCP servers (Claude Desktop, Claude Code, etc.), add
this tool to its configuration, pointing at the built server:

```json
{
  "mcpServers": {
    "rn-devtools": {
      "command": "node",
      "args": ["/absolute/path/to/rn-devtools-mcp/packages/server/dist/main.js"]
    }
  }
}
```

Replace the path with wherever this project actually lives on your computer. Restart your
assistant after adding this. Once it's connected, you don't need to do anything else manually —
just ask.

## How to actually use it

With your app running, just ask your assistant things like:

- _"Check if my app is leaking memory."_
- _"Why is my app laggy when I scroll the list?"_
- _"What's slow when my app starts up?"_
- _"Is my app dropping frames?"_
- _"Give me a performance report I can share with the team."_

The assistant will typically:

1. Ask which device/app to look at (or figure it out automatically if only one is running).
2. Connect to it and gather the relevant data — a memory snapshot, timing information, frame
   stats, whatever fits the question.
3. Summarize what it found in plain language, calling out anything that looks like a real problem.

You don't need to know the names of the underlying tools or what a "heap snapshot" or "fiber tree"
technically is — just describe the symptom you're seeing, the same way you'd describe it to a
teammate.

### A typical exchange

> **You:** My app feels sluggish on the home screen. Can you check what's going on?
>
> **Assistant:** _(connects to your running app, checks render timing and frame drops)_ I found
> that the `ProductList` component is taking 65ms to render on every scroll, and about 8% of
> frames are being dropped — both above what feels smooth. Want me to look at whether it's
> re-rendering more than it needs to?

## Understanding what it finds

Findings come back tagged with a severity, so you can tell what actually needs attention:

- **Critical** — something clearly wrong (a request failing, frame times far past what's usable).
- **Warning** — worth investigating, not necessarily broken yet.
- **Info** — background context (e.g. "here's the memory breakdown by category") rather than a
  problem.

If you ask for a "leak check," a single check tells you what's numerous _right now_. A real leak
is confirmed by checking twice a few minutes apart and seeing the same things keep growing — your
assistant can do this by taking two snapshots and comparing them, if you ask it to check again
after using the app for a bit.

## Getting a shareable report

Ask your assistant to _"generate a report of that"_ — it can save what it found as a file (an
HTML file looks like a webpage you can open in a browser; Markdown or JSON if you want something
more raw) instead of just printing it in the chat.

## Things to know

- **Reloading the app is disruptive.** If you or your assistant asks it to "reload the app," that
  restarts it immediately — the same as if you'd shaken the device and hit reload yourself. It
  will only do this if the conversation actually calls for it, but say so explicitly if you don't
  want your app restarted mid-check.
- **It needs your app already running.** It can't launch your app for you — start it the way you
  normally do (simulator, emulator, or device) with Metro running, first.
- **Multiple devices connected?** You'll be asked to specify which one, by name — e.g. "the
  iPhone" vs. "the Pixel emulator" — since more than one can be attached to the same project.
- **Deep captures take a few seconds.** A memory snapshot or a system trace briefly uses some CPU
  on the device while it's being captured — a few seconds, not something you'll usually notice.

## If something goes wrong

- **"No devices found" / "device not reachable"** — make sure your app is actually running and
  Metro (the bundler) is started. If you changed Metro's port from the default, mention that so
  the assistant checks the right one.
- **Android checks failing** — make sure the device shows up when you'd normally check it
  yourself (i.e. your usual Android development setup is working).
- **iOS checks failing** — same idea: if you can run/debug your app on that simulator or device
  normally, this tool can too; if not, that's the thing to fix first.
- **Nothing seems to be happening for the "why is it slow" type question** — try describing the
  exact action that feels slow (e.g. "scrolling the product list" rather than "the app in
  general") — it helps the assistant know what to capture.

## Want more technical detail?

- [TOOL_REFERENCE.md](TOOL_REFERENCE.md) — the exact capabilities available and what each returns.
- [ARCHITECTURE.md](ARCHITECTURE.md) — how it works under the hood.
- The root [README.md](../README.md) — for whoever maintains the install/setup.
