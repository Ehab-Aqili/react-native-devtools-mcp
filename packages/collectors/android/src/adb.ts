import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 32 * 1024 * 1024;

export interface AndroidDevice {
  readonly serial: string;
  readonly state: string;
  readonly model?: string;
  readonly product?: string;
}

async function adb(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("adb", args, { maxBuffer: MAX_BUFFER });
  return stdout;
}

/** Runs `adb -s <serial> shell <command...>` and returns stdout. */
export async function adbShell(serial: string, command: string[]): Promise<string> {
  return adb(["-s", serial, "shell", ...command]);
}

export async function adbPull(
  serial: string,
  remotePath: string,
  localPath: string,
): Promise<void> {
  await adb(["-s", serial, "pull", remotePath, localPath]);
}

export async function adbShellRaw(serial: string, command: string[]): Promise<void> {
  await execFileAsync("adb", ["-s", serial, "shell", ...command], { maxBuffer: MAX_BUFFER });
}

/** Parses `adb devices -l` output into structured device entries. */
export async function listAndroidDevices(): Promise<AndroidDevice[]> {
  const stdout = await adb(["devices", "-l"]);
  const lines = stdout.split("\n").slice(1);
  const devices: AndroidDevice[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const serial = parts[0];
    const state = parts[1];
    if (!serial || !state) {
      continue;
    }
    let model: string | undefined;
    let product: string | undefined;
    for (const part of parts.slice(2)) {
      const [key, value] = part.split(":");
      if (key === "model" && value) {
        model = value;
      }
      if (key === "product" && value) {
        product = value;
      }
    }
    devices.push({
      serial,
      state,
      ...(model !== undefined && { model }),
      ...(product !== undefined && { product }),
    });
  }
  return devices;
}
