import { parseArgs } from "node:util";
import { loadConfig } from "@rn-devtools/core";
import { checkStatus } from "@rn-devtools/collector-metro";
import { listAndroidDevices } from "@rn-devtools/collector-android";
import { listSimulators, listXctraceDevices } from "@rn-devtools/collector-ios";
import { printCheck, printHeader, type CheckStatus } from "../output.js";

export interface DoctorOptions {
  readonly metroHost?: string;
  readonly metroPort?: number;
}

export function parseDoctorArgs(argv: string[]): DoctorOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      "metro-host": { type: "string" },
      "metro-port": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    ...(values["metro-host"] !== undefined && { metroHost: values["metro-host"] }),
    ...(values["metro-port"] !== undefined && { metroPort: Number(values["metro-port"]) }),
  };
}

/** Environment health check — no device connection required beyond an optional Metro reachability probe. */
export async function runDoctor(options: DoctorOptions = {}): Promise<number> {
  const config = loadConfig();
  const results: CheckStatus[] = [];

  printHeader("Node");
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeOk = nodeMajor >= 20;
  printCheck(nodeOk ? "pass" : "fail", `Node.js ${process.versions.node}`, "requires >= 20");
  results.push(nodeOk ? "pass" : "fail");

  printHeader("Android (adb)");
  try {
    const devices = await listAndroidDevices();
    printCheck("pass", "adb is available");
    if (devices.length === 0) {
      printCheck("warn", "no Android devices connected");
      results.push("warn");
    } else {
      for (const device of devices) {
        printCheck(
          device.state === "device" ? "pass" : "warn",
          `${device.serial} (${device.model ?? "unknown model"})`,
          device.state,
        );
      }
      results.push("pass");
    }
  } catch (caught) {
    printCheck("warn", "adb not available", (caught as Error).message);
    results.push("warn");
  }

  if (process.platform === "darwin") {
    printHeader("iOS (Xcode command line tools)");
    try {
      const [simulators, devices] = await Promise.all([listSimulators(), listXctraceDevices()]);
      const booted = simulators.filter((sim) => sim.state === "Booted");
      printCheck("pass", "simctl is available", `${simulators.length} known simulators`);
      printCheck(booted.length > 0 ? "pass" : "warn", `${booted.length} booted simulator(s)`);
      const onlineDevices = devices.filter((d) => d.online && d.name !== "MacBook Air");
      printCheck(
        onlineDevices.length > 0 ? "pass" : "warn",
        `${onlineDevices.length} online physical device(s)`,
      );
      results.push("pass");
    } catch (caught) {
      printCheck("warn", "xcrun tools not available", (caught as Error).message);
      results.push("warn");
    }
  } else {
    printHeader("iOS (Xcode command line tools)");
    printCheck("warn", "skipped", "iOS tooling requires macOS");
    results.push("warn");
  }

  printHeader("Metro");
  const host = options.metroHost ?? config.metro.host;
  const port = options.metroPort ?? config.metro.port;
  const running = await checkStatus(host, port);
  printCheck(running ? "pass" : "warn", `${host}:${port}`, running ? "running" : "not reachable");
  results.push(running ? "pass" : "warn");

  process.stdout.write("\n");
  const failed = results.includes("fail");
  printCheck(
    failed ? "fail" : "pass",
    failed ? "One or more critical checks failed" : "All critical checks passed",
  );

  return failed ? 1 : 0;
}
