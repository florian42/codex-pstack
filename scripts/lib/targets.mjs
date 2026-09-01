import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { toPosix } from "./fs.mjs";
import { vocabularyNames } from "./vocabulary.mjs";

/** target name -> build config path, relative to the repository root. */
export const TARGET_REGISTRY = {
  codex: ".agents/plugins/pstack-build.json",
};

export function targetNames() {
  return Object.keys(TARGET_REGISTRY);
}

export function repositoryRoot() {
  return resolve(
    process.env.CODEX_PSTACK_ROOT ??
      resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."),
  );
}

function requireString(config, key, configPath) {
  const value = config[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${configPath}: ${key} must be a non-empty string`);
  }
  return value;
}

function requireObjectArray(config, key, keys, configPath) {
  const value = config[key] ?? [];
  if (!Array.isArray(value)) {
    throw new Error(`${configPath}: ${key} must be an array`);
  }
  for (const [index, entry] of value.entries()) {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") {
      throw new Error(`${configPath}: ${key}[${index}] must be an object`);
    }
    for (const field of keys) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        throw new Error(`${configPath}: ${key}[${index}].${field} must be a non-empty string`);
      }
    }
  }
  return value;
}

function requireStringArray(config, key, configPath) {
  const value = config[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${configPath}: ${key} must be an array of strings`);
  }
  return value;
}

/**
 * Read and validate a per-target build config, resolving every path it names
 * against the repository root.
 */
export function loadTarget(name, root = repositoryRoot()) {
  const configRelative = TARGET_REGISTRY[name];
  if (configRelative === undefined) {
    throw new Error(
      `unknown target ${JSON.stringify(name)}; known targets: ${targetNames().join(", ")}`,
    );
  }
  const configPath = resolve(root, configRelative);
  if (!existsSync(configPath)) {
    throw new Error(`${configRelative}: build config is missing`);
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config === null || Array.isArray(config) || typeof config !== "object") {
    throw new Error(`${configRelative}: build config must be a JSON object`);
  }

  const target = requireString(config, "target", configRelative);
  if (target !== name) {
    throw new Error(`${configRelative}: target must be ${JSON.stringify(name)}`);
  }
  const displayName = requireString(config, "displayName", configRelative);
  const sourceRootRelative = requireString(config, "sourceRoot", configRelative);
  const outputRootRelative = requireString(config, "outputRoot", configRelative);
  const manifestSource = requireString(config, "manifestSource", configRelative);
  const manifestDestination = requireString(config, "manifestDestination", configRelative);
  const referenceManifest = requireString(config, "referenceManifest", configRelative);
  const runtimeMapping = requireString(config, "runtimeMapping", configRelative);
  const portabilityRecord = requireString(config, "portabilityRecord", configRelative);
  const stopPageTitle = requireString(config, "stopPageTitle", configRelative);
  const stopPageMappingLink = requireString(config, "stopPageMappingLink", configRelative);
  const generatedBy = requireString(config, "generatedBy", configRelative);
  const regenerateCommand = requireString(config, "regenerateCommand", configRelative);
  const manifestChecks = requireString(config, "manifestChecks", configRelative);

  const marketplace = config.marketplace;
  if (marketplace === null || Array.isArray(marketplace) || typeof marketplace !== "object") {
    throw new Error(`${configRelative}: marketplace must be an object`);
  }
  for (const key of ["path", "name", "pluginName", "sourcePointer"]) {
    requireString(marketplace, key, `${configRelative}: marketplace`);
  }

  const portabilityColumn = config.portabilityColumn;
  if (
    !(typeof portabilityColumn === "string" && portabilityColumn.trim() !== "") &&
    !(Number.isInteger(portabilityColumn) && portabilityColumn >= 0)
  ) {
    throw new Error(
      `${configRelative}: portabilityColumn must be a column header name or a column index`,
    );
  }

  const bannedVocabularies = requireStringArray(config, "bannedVocabularies", configRelative);
  const known = new Set(vocabularyNames());
  for (const vocabulary of bannedVocabularies) {
    if (!known.has(vocabulary)) {
      throw new Error(`${configRelative}: unknown vocabulary ${JSON.stringify(vocabulary)}`);
    }
  }

  const sourceRoot = resolve(root, sourceRootRelative);
  const outputRoot = resolve(root, outputRootRelative);

  return {
    name: target,
    displayName,
    root,
    configPath,
    configRelative,
    config,
    sourceRoot,
    sourceRootRelative,
    sourceSkills: resolve(sourceRoot, "skills"),
    outputRoot,
    outputRootRelative: toPosix(outputRootRelative),
    manifestSourcePath: resolve(root, manifestSource),
    manifestDestination: toPosix(manifestDestination),
    referenceManifestPath: resolve(root, referenceManifest),
    runtimeMapping: toPosix(runtimeMapping),
    runtimeMappingPath: resolve(sourceRoot, runtimeMapping),
    portabilityPath: resolve(sourceRoot, portabilityRecord),
    portabilityColumn,
    stopPageTitle,
    stopPageMappingLink,
    generatedBy,
    regenerateCommand,
    manifestChecks,
    marketplace: {
      path: resolve(root, marketplace.path),
      relativePath: toPosix(marketplace.path),
      name: marketplace.name,
      pluginName: marketplace.pluginName,
      sourcePointer: marketplace.sourcePointer,
    },
    forbiddenGeneratedDirectories: requireStringArray(
      config,
      "forbiddenGeneratedDirectories",
      configRelative,
    ),
    requiredSkills: requireStringArray(config, "requiredSkills", configRelative),
    requiredAgents: requireStringArray(config, "requiredAgents", configRelative),
    bannedVocabularies,
    unsupportedResources: config.unsupportedResources ?? [],
    runtimeResources: config.runtimeResources ?? [],
    copiedSkillResources: config.copiedSkillResources,
    platformTermAllowlist: requireObjectArray(
      config,
      "platformTermAllowlist",
      ["path", "match"],
      configRelative,
    ),
  };
}
