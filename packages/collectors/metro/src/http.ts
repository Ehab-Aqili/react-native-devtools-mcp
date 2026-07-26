import type { MetroDevicePage } from "./types.js";

export function baseUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

/** Checks Metro's `/status` endpoint. Resolves false rather than throwing on any network failure. */
export async function checkStatus(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl(host, port)}/status`);
    if (!res.ok) {
      return false;
    }
    const text = await res.text();
    return text.trim() === "packager-status:running";
  } catch {
    return false;
  }
}

/** Lists connected app instances available for CDP debugging via `/json/list`. */
export async function listDevices(host: string, port: number): Promise<MetroDevicePage[]> {
  const res = await fetch(`${baseUrl(host, port)}/json/list`);
  if (!res.ok) {
    throw new Error(`Metro /json/list responded with ${res.status}`);
  }
  return (await res.json()) as MetroDevicePage[];
}

/** Triggers a full reload of every app currently connected to Metro. */
export async function triggerReload(host: string, port: number): Promise<void> {
  const res = await fetch(`${baseUrl(host, port)}/reload`);
  if (!res.ok) {
    throw new Error(`Metro /reload responded with ${res.status}`);
  }
}
