#!/usr/bin/env node

/**
 * Schema validation for every plugin manifest, marketplace, and build config in
 * the repository.
 *
 * This is the only validator allowed to depend on ajv. The dependency-free
 * `scripts/validate-plugin.mjs` runs first in CI and keeps the checks a JSON
 * schema cannot express (path resolution, generated-tree freshness, version
 * parity, the term scan).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import { TARGET_REGISTRY } from "./lib/targets.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadJSON(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * One row per platform: where its marketplace lives, which schemas describe the
 * marketplace and the plugin manifest, which manifests to validate, and how a
 * marketplace entry names its plugin directory.
 */
const TARGETS = [
  {
    label: "Cursor",
    marketplacePath: ".cursor-plugin/marketplace.json",
    marketplaceSchema: "schemas/marketplace.schema.json",
    pluginSchema: "schemas/plugin.schema.json",
    manifests: [],
    // The Cursor marketplace points at plugin directories by relative path.
    entryDirectory: (entry) => entry.source,
    entryManifest: (directory) => `${directory}/.cursor-plugin/plugin.json`,
    checkEntrySource: true,
  },
  {
    label: "Codex",
    marketplacePath: ".agents/plugins/marketplace.json",
    marketplaceSchema: "schemas/codex-marketplace.schema.json",
    pluginSchema: "schemas/codex-plugin.schema.json",
    // The Codex manifest is hand-written in the canonical tree and copied
    // byte-for-byte into the generated distribution; both are validated.
    manifests: [
      "pstack/.codex-plugin/plugin.json",
      ".agents/plugins/pstack/.codex-plugin/plugin.json",
    ],
    entryDirectory: (entry) => entry.source?.path,
    entryManifest: (directory) => `${directory}/.codex-plugin/plugin.json`,
    checkEntrySource: true,
  },
  {
    label: "Claude Code",
    marketplacePath: ".claude-plugin/marketplace.json",
    marketplaceSchema: "schemas/claude-marketplace.schema.json",
    pluginSchema: "schemas/claude-plugin.schema.json",
    // The Claude Code manifest is hand-written in the canonical tree and copied
    // byte-for-byte into the generated distribution; both are validated.
    manifests: [
      "pstack/.claude-plugin/plugin.json",
      "plugins/claude-code/pstack/.claude-plugin/plugin.json",
    ],
    // A Claude Code marketplace entry names its directory with a plain string.
    entryDirectory: (entry) => entry.source,
    entryManifest: (directory) => `${directory}/.claude-plugin/plugin.json`,
    checkEntrySource: true,
  },
];

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const compiled = new Map();
function validatorFor(schemaRelativePath) {
  if (!compiled.has(schemaRelativePath)) {
    compiled.set(schemaRelativePath, ajv.compile(loadJSON(resolve(root, schemaRelativePath))));
  }
  return compiled.get(schemaRelativePath);
}

let errors = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  errors += 1;
}

function describe(error) {
  if (error.keyword === "additionalProperties") {
    return `${error.message}: "${error.params.additionalProperty}"`;
  }
  return error.message;
}

/** Validate one JSON file against one schema; returns the parsed value or null. */
function validateFile(relativePath, schemaRelativePath, label) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    fail(`${label}: ${relativePath} not found`);
    return null;
  }
  let value;
  try {
    value = loadJSON(path);
  } catch (error) {
    fail(`${label}: ${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
  const validate = validatorFor(schemaRelativePath);
  if (!validate(value)) {
    fail(`${label}: ${relativePath} failed ${schemaRelativePath}:`);
    for (const error of validate.errors) {
      console.error(`  ${error.instancePath || "/"}: ${describe(error)}`);
    }
  }
  return value;
}

for (const target of TARGETS) {
  const marketplace = validateFile(
    target.marketplacePath,
    target.marketplaceSchema,
    target.label,
  );

  for (const manifestPath of target.manifests) {
    validateFile(manifestPath, target.pluginSchema, target.label);
  }

  if (marketplace === null) continue;

  for (const entry of marketplace.plugins ?? []) {
    if (!target.checkEntrySource) continue;
    const directory = target.entryDirectory(entry);
    if (typeof directory !== "string") {
      fail(`${target.label}: plugin "${entry.name}": marketplace entry has no source path`);
      continue;
    }
    if (!existsSync(resolve(root, directory))) {
      fail(
        `${target.label}: plugin "${entry.name}": source directory "${directory}" does not exist`,
      );
      continue;
    }
    const manifestPath = target.entryManifest(directory);
    if (!existsSync(resolve(root, manifestPath))) {
      fail(`${target.label}: plugin "${entry.name}": missing ${manifestPath}`);
      continue;
    }
    // Skip a second schema run when this manifest is already in the table.
    const alreadyValidated = target.manifests.some(
      (candidate) => resolve(root, candidate) === resolve(root, manifestPath),
    );
    const manifest = alreadyValidated
      ? loadJSON(resolve(root, manifestPath))
      : validateFile(manifestPath, target.pluginSchema, target.label);
    if (manifest !== null && manifest.name && manifest.name !== entry.name) {
      fail(
        `${target.label}: plugin "${entry.name}": marketplace name does not match manifest name "${manifest.name}"`,
      );
    }
  }
}

// Every registered per-target build config.
for (const [name, configPath] of Object.entries(TARGET_REGISTRY)) {
  const config = validateFile(configPath, "schemas/plugin-build.schema.json", `build config ${name}`);
  if (config !== null && config.target !== name) {
    fail(`build config ${name}: ${configPath}: target must be "${name}"`);
  }
}

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log("All plugins validated successfully.");
  process.exit(0);
}
