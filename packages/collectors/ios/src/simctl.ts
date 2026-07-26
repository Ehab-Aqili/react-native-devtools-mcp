import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Simulator } from "./types.js";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 32 * 1024 * 1024;

interface RawSimctlDevice {
  readonly udid: string;
  readonly name: string;
  readonly state: string;
  readonly isAvailable: boolean;
}

interface RawSimctlList {
  readonly devices: Record<string, RawSimctlDevice[]>;
}

function runtimeNameFromKey(key: string): string {
  // "com.apple.CoreSimulator.SimRuntime.iOS-17-5" -> "iOS 17.5"
  const match = /SimRuntime\.([A-Za-z]+)-([\d-]+)$/.exec(key);
  if (!match || !match[1] || !match[2]) {
    return key;
  }
  return `${match[1]} ${match[2].replace(/-/g, ".")}`;
}

/** Lists every known iOS Simulator via `simctl list devices --json`. */
export async function listSimulators(): Promise<Simulator[]> {
  const { stdout } = await execFileAsync("xcrun", ["simctl", "list", "devices", "--json"], {
    maxBuffer: MAX_BUFFER,
  });
  const parsed = JSON.parse(stdout) as RawSimctlList;

  const simulators: Simulator[] = [];
  for (const [runtimeKey, devices] of Object.entries(parsed.devices)) {
    for (const device of devices) {
      simulators.push({
        udid: device.udid,
        name: device.name,
        state: device.state,
        isAvailable: device.isAvailable,
        runtime: runtimeNameFromKey(runtimeKey),
      });
    }
  }
  return simulators;
}
