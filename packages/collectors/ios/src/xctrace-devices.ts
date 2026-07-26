import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface XctraceDevice {
  readonly name: string;
  readonly udid: string;
  readonly online: boolean;
}

function parseSection(text: string, header: string, online: boolean): XctraceDevice[] {
  const sectionStart = text.indexOf(header);
  if (sectionStart === -1) {
    return [];
  }
  const afterHeader = text.slice(sectionStart + header.length);
  const nextSectionIdx = afterHeader.indexOf("\n==");
  const body = nextSectionIdx === -1 ? afterHeader : afterHeader.slice(0, nextSectionIdx);

  const devices: XctraceDevice[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = /^(.*)\s\(([0-9A-F-]{8,40})\)$/i.exec(trimmed);
    if (match?.[1] && match[2]) {
      devices.push({ name: match[1].trim(), udid: match[2], online });
    }
  }
  return devices;
}

/**
 * Lists physical iOS devices (and this Mac) via `xctrace list devices` — the
 * only way to discover a physical device's UDID; `simctl` only knows about
 * simulators (see `listSimulators`).
 */
export async function listXctraceDevices(): Promise<XctraceDevice[]> {
  const { stdout } = await execFileAsync("xcrun", ["xctrace", "list", "devices"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  return [
    ...parseSection(stdout, "== Devices ==", true),
    ...parseSection(stdout, "== Devices Offline ==", false),
  ];
}
