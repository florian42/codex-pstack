#!/usr/bin/env node

/**
 * Rewrite the `version` field of every plugin manifest to the given semantic
 * version.
 *
 * The three manifests do not share an indentation style — the Cursor manifest
 * is tab-indented and the Codex and Claude Code manifests are two-space — and
 * one of them is upstream-owned, so this edits the raw text of the version line
 * instead of reserializing. Indentation, key order, and the trailing newline
 * are untouched.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { isSemver, MANIFESTS } from "./lib/manifest.mjs";
import { repositoryRoot } from "./lib/targets.mjs";

const VERSION_LINE = /^([ \t]*)"version":([ \t]*)"([^"]*)"/gm;

function usage() {
  return "usage: node scripts/set-version.mjs <semver>";
}

function rewrite(text, version, label) {
  const matches = [...text.matchAll(VERSION_LINE)];
  if (matches.length === 0) throw new Error(`${label}: no "version" field to rewrite`);
  if (matches.length > 1) throw new Error(`${label}: more than one "version" field`);
  const [match, indent, space, current] = matches[0];
  const replacement = `${indent}"version":${space}"${version}"`;
  return {
    text: text.slice(0, matches[0].index) + replacement + text.slice(matches[0].index + match.length),
    current,
  };
}

function main(argv) {
  if (argv.length !== 1) throw new Error(usage());
  const version = argv[0];
  if (!isSemver(version)) {
    throw new Error(`${JSON.stringify(version)} is not a strict semantic version; ${usage()}`);
  }

  const root = repositoryRoot();
  const changed = [];
  const writes = [];
  for (const manifest of MANIFESTS) {
    const path = resolve(root, manifest.path);
    const text = readFileSync(path, "utf8");
    const result = rewrite(text, version, manifest.path);
    if (result.text !== text) {
      writes.push([path, result.text]);
      changed.push(`${manifest.path}: ${result.current} -> ${version}`);
    }
  }
  for (const [path, text] of writes) writeFileSync(path, text);

  if (changed.length === 0) {
    console.log(`Every manifest is already at ${version}.`);
    return 0;
  }
  console.log(`Set version ${version} in ${changed.length} manifest(s):`);
  for (const line of changed) console.log(`  ${line}`);
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}
