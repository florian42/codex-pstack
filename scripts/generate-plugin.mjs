#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { compare } from "./lib/compare.mjs";
import { buildFileMap, generatedFileMode } from "./lib/file-map.mjs";
import { toPosix } from "./lib/fs.mjs";
import { loadTarget, repositoryRoot, targetNames } from "./lib/targets.mjs";

function parseArguments(argv) {
  let target = null;
  let checkOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") checkOnly = true;
    else if (argument === "--target") target = argv[++index] ?? null;
    else if (argument.startsWith("--target=")) target = argument.slice("--target=".length);
    else {
      throw new Error(`unknown argument ${JSON.stringify(argument)}`);
    }
  }
  if (target === null) {
    throw new Error(`--target is required; known targets: ${targetNames().join(", ")}`);
  }
  return { target, checkOnly };
}

function generate(argv) {
  const { target: targetName, checkOnly } = parseArguments(argv);
  const root = repositoryRoot();
  const target = loadTarget(targetName, root);
  const expected = buildFileMap(target);

  if (checkOnly) {
    const failures = compare(target, expected);
    if (failures.length > 0) {
      for (const failure of failures) {
        console.error(`ERROR ${target.outputRootRelative}: ${failure}`);
      }
      console.error(`Run \`${target.regenerateCommand}\` and commit the result.`);
      return 1;
    }
    console.log(
      `Generated ${target.displayName} distribution is current (${expected.size} files).`,
    );
    return 0;
  }

  rmSync(target.outputRoot, { recursive: true, force: true });
  for (const [path, contents] of expected) {
    const outputPath = resolve(target.outputRoot, path);
    mkdirSync(dirname(outputPath), { recursive: true });
    const mode = generatedFileMode(target, path);
    writeFileSync(outputPath, contents, mode === null ? undefined : { mode });
  }
  console.log(
    `Generated ${expected.size} files in ${toPosix(relative(root, target.outputRoot))}.`,
  );
  return 0;
}

try {
  process.exit(generate(process.argv.slice(2)));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}
