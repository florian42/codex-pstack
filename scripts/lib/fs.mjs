import { existsSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export function toPosix(path) {
  return path.split(sep).join("/");
}

export function walkFiles(path) {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

export function walkFilesIfPresent(path) {
  if (!existsSync(path)) return [];
  return walkFiles(path);
}

export function relativePosix(from, to) {
  return toPosix(relative(from, to));
}
