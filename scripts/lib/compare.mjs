import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { toPosix, walkFilesIfPresent } from "./fs.mjs";
import { generatedFileMode } from "./file-map.mjs";

/** Compare the generated tree on disk against the expected file map. */
export function compare(target, expected) {
  const actualPaths = walkFilesIfPresent(target.outputRoot)
    .map((path) => toPosix(relative(target.outputRoot, path)))
    .sort();
  const expectedPaths = [...expected.keys()].sort();
  const failures = [];
  for (const path of expectedPaths) {
    const outputPath = resolve(target.outputRoot, path);
    if (!existsSync(outputPath)) failures.push(`missing generated file ${path}`);
    else if (!readFileSync(outputPath).equals(expected.get(path))) {
      failures.push(`stale generated file ${path}`);
    } else {
      const expectedMode = generatedFileMode(target, path);
      if (expectedMode !== null && (statSync(outputPath).mode & 0o777) !== expectedMode) {
        failures.push(`stale generated file mode ${path}`);
      }
    }
  }
  for (const path of actualPaths) {
    if (!expected.has(path)) failures.push(`unexpected generated file ${path}`);
  }
  return failures;
}
