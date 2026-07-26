import { parseAnalyzeArgs, runAnalyze } from "./commands/analyze.js";
import { parseDoctorArgs, runDoctor } from "./commands/doctor.js";
import { parseProfileArgs, runProfile } from "./commands/profile.js";
import { parseReportArgs, runReport } from "./commands/report.js";
import { printError } from "./output.js";

const USAGE = `rn-devtools-mcp <command> [options]

Commands:
  doctor    Check the local environment (adb, Xcode tools, Metro reachability)
              [--metro-host <host>] [--metro-port <port>]
  profile   Capture a CPU profile or heap snapshot from a Hermes CDP target
              --ws <webSocketDebuggerUrl> [--type cpu|heap] [--duration <ms>]
  analyze   Run render (+ optional Android FPS) analyzers against a running app
              --ws <webSocketDebuggerUrl> [--android-serial <serial> --package <name>]
              [--report <path>] [--format json|markdown|html]
  report    Render a saved findings JSON file into a report
              --input <findings.json> --out <path> --format json|markdown|html
              [--title <string>] [--group-by-category]

Run "rn-devtools-mcp <command> --help" is not supported; see the flags above.
`;

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return command ? 0 : 1;
  }

  try {
    switch (command) {
      case "doctor":
        return await runDoctor(parseDoctorArgs(rest));
      case "profile":
        return await runProfile(parseProfileArgs(rest));
      case "analyze":
        return await runAnalyze(parseAnalyzeArgs(rest));
      case "report":
        return await runReport(parseReportArgs(rest));
      default:
        printError(`unknown command "${command}"`);
        process.stdout.write(USAGE);
        return 1;
    }
  } catch (caught) {
    printError((caught as Error).message);
    return 1;
  }
}
