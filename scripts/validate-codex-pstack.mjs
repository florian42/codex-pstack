#!/usr/bin/env node

// Compatibility shim. The multi-target validator is scripts/validate-plugin.mjs;
// this name stays for one release so documented Codex commands keep working.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entryPoint = resolve(dirname(fileURLToPath(import.meta.url)), "validate-plugin.mjs");
const result = spawnSync(
  process.execPath,
  [entryPoint, "--target", "codex", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
