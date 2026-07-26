#!/usr/bin/env node
import { run } from "./cli.js";

run()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((caught: unknown) => {
    process.stderr.write(`fatal: ${String(caught)}\n`);
    process.exitCode = 1;
  });
