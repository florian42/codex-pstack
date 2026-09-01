#!/usr/bin/env node

// Compatibility shim. The multi-target generator is scripts/generate-plugin.mjs;
// this name stays for one release so documented Codex commands keep working.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entryPoint = resolve(dirname(fileURLToPath(import.meta.url)), "generate-plugin.mjs");
const result = spawnSync(
  process.execPath,
  [entryPoint, "--target", "codex", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
