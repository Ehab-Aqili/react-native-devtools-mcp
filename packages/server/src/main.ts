import { run } from "./run.js";

run().catch((caught: unknown) => {
  process.stderr.write(`fatal: ${String(caught)}\n`);
  process.exitCode = 1;
});
