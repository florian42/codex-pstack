#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  process.env.CODEX_PSTACK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const sourceRoot = resolve(root, "pstack");
const sourceSkills = resolve(sourceRoot, "skills");
const outputRoot = resolve(root, ".agents/plugins/pstack");
const configPath = resolve(root, ".agents/plugins/pstack-build.json");
const portabilityPath = resolve(
  sourceRoot,
  "references/runtime/skill-portability.md",
);
const checkOnly = process.argv.includes("--check");

function toPosix(path) {
  return path.split(sep).join("/");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const buildConfig = readJson(configPath);
const packagedRuntimeResources = new Set(buildConfig.runtimeResources ?? []);

function parsePortability() {
  const records = new Map();
  for (const line of readFileSync(portabilityPath, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ""));
    if (cells.length < 2) continue;
    const classification = cells[1].toLowerCase();
    if (["portable", "adapted", "unsupported"].includes(classification)) {
      records.set(cells[0], classification);
    }
  }
  return records;
}

function walkFiles(path) {
  if (!existsSync(path)) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function codexSkillContents(sourcePath, skillRoot, skillName) {
  const contents = readFileSync(sourcePath);
  if (sourcePath !== resolve(skillRoot, "SKILL.md")) return contents;
  const text = contents.toString("utf8");
  return Buffer.from(text.replace(/^name:.*$/m, `name: ${skillName}`));
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== ".." && !path.startsWith("../");
}

function copiedSkillResources(config) {
  const resources = config.copiedSkillResources;
  if (!Array.isArray(resources)) {
    throw new Error("copiedSkillResources must be an array");
  }
  const destinations = new Set();
  return resources.map((resource, index) => {
    const prefix = `copiedSkillResources[${index}]`;
    if (resource === null || Array.isArray(resource) || typeof resource !== "object") {
      throw new Error(`${prefix} must be an object`);
    }
    const keys = Object.keys(resource).sort();
    if (keys.length !== 2 || keys[0] !== "destination" || keys[1] !== "source") {
      throw new Error(`${prefix} must contain only source and destination`);
    }
    if (typeof resource.source !== "string" || resource.source.trim() === "") {
      throw new Error(`${prefix}.source must be a non-empty string`);
    }
    if (typeof resource.destination !== "string" || resource.destination.trim() === "") {
      throw new Error(`${prefix}.destination must be a non-empty string`);
    }

    const sourcePath = resolve(sourceRoot, resource.source);
    const destinationPath = resolve(outputRoot, resource.destination);
    const normalizedSource = toPosix(relative(sourceRoot, sourcePath));
    const normalizedDestination = toPosix(relative(outputRoot, destinationPath));
    const destinationSegments = normalizedDestination.split("/");
    if (!isWithin(sourceRoot, sourcePath) || normalizedSource !== resource.source) {
      throw new Error(`${prefix}.source must be a normalized path beneath pstack/`);
    }
    if (!isWithin(outputRoot, destinationPath) || normalizedDestination !== resource.destination) {
      throw new Error(`${prefix}.destination must be a normalized path beneath the generated package`);
    }
    if (
      destinationSegments.length < 4 ||
      destinationSegments[0] !== "skills" ||
      destinationSegments[2] !== "references"
    ) {
      throw new Error(`${prefix}.destination must be beneath skills/*/references/`);
    }
    if (destinations.has(normalizedDestination)) {
      throw new Error(`${prefix}.destination duplicates ${normalizedDestination}`);
    }
    if (!existsSync(sourcePath)) {
      throw new Error(`${prefix}.source does not exist: ${resource.source}`);
    }
    destinations.add(normalizedDestination);
    return { sourcePath, destination: normalizedDestination };
  });
}

function addCopiedSkillResources(files, resources) {
  for (const resource of resources) {
    if (files.has(resource.destination)) {
      throw new Error(`copied skill resource collides with generated file ${resource.destination}`);
    }
    files.set(resource.destination, readFileSync(resource.sourcePath));
  }
}

function buildFileMap() {
  const config = buildConfig;
  const portability = parsePortability();
  const unsupportedResources = new Map(
    config.unsupportedResources.map((entry) => [entry.path, entry.reason]),
  );
  const runtimeResources = new Set(config.runtimeResources ?? []);
  const files = new Map();

  files.set(
    ".codex-plugin/plugin.json",
    readFileSync(resolve(sourceRoot, ".codex-plugin/plugin.json")),
  );
  files.set("LICENSE", readFileSync(resolve(sourceRoot, "LICENSE")));

  const runtimeReferences = resolve(sourceRoot, "references/runtime");
  for (const sourcePath of walkFiles(runtimeReferences)) {
    const referenceRelative = toPosix(relative(sourceRoot, sourcePath));
    files.set(referenceRelative, readFileSync(sourcePath));
  }

  for (const entry of readdirSync(sourceSkills, { withFileTypes: true })) {
    if (!entry.isDirectory() || portability.get(entry.name) === "unsupported") continue;
    const skillRoot = resolve(sourceSkills, entry.name);
    for (const sourcePath of walkFiles(skillRoot)) {
      const skillRelative = toPosix(relative(sourceSkills, sourcePath));
      const segments = skillRelative.split("/");
      if (segments.includes("scripts") && !runtimeResources.has(skillRelative)) continue;
      const unsupportedReason = unsupportedResources.get(skillRelative);
      if (unsupportedReason !== undefined) {
        files.set(
          `skills/${skillRelative}`,
          Buffer.from(
            `# Unsupported on Codex\n\n${unsupportedReason} Stop this route and choose a supported playbook. See the [Codex runtime mapping](../../../references/runtime/codex.md).\n`,
          ),
        );
      } else {
      files.set(
        `skills/${skillRelative}`,
        codexSkillContents(sourcePath, skillRoot, entry.name),
      );
      }
    }
  }

  addCopiedSkillResources(files, copiedSkillResources(config));

  const hash = createHash("sha256");
  for (const [path, contents] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  files.set(
    ".generated.json",
    Buffer.from(
      `${JSON.stringify(
        {
          generatedBy: "scripts/generate-codex-pstack.mjs",
          canonicalSkills: "pstack/skills",
          contentSha256: hash.digest("hex"),
        },
        null,
        2,
      )}\n`,
    ),
  );
  return files;
}

function generatedFileMode(path) {
  if (!path.startsWith("skills/")) return null;
  const skillRelative = path.slice("skills/".length);
  if (!packagedRuntimeResources.has(skillRelative)) return null;
  return statSync(resolve(sourceSkills, skillRelative)).mode & 0o777;
}

function compare(expected) {
  const actualPaths = walkFiles(outputRoot)
    .map((path) => toPosix(relative(outputRoot, path)))
    .sort();
  const expectedPaths = [...expected.keys()].sort();
  const failures = [];
  for (const path of expectedPaths) {
    const outputPath = resolve(outputRoot, path);
    if (!existsSync(outputPath)) failures.push(`missing generated file ${path}`);
    else if (!readFileSync(outputPath).equals(expected.get(path))) {
      failures.push(`stale generated file ${path}`);
    } else {
      const expectedMode = generatedFileMode(path);
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

const expected = buildFileMap();
if (checkOnly) {
  const failures = compare(expected);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`ERROR .agents/plugins/pstack: ${failure}`);
    console.error("Run `node scripts/generate-codex-pstack.mjs` and commit the result.");
    process.exit(1);
  }
  console.log(`Generated Codex distribution is current (${expected.size} files).`);
  process.exit(0);
}

rmSync(outputRoot, { recursive: true, force: true });
for (const [path, contents] of expected) {
  const outputPath = resolve(outputRoot, path);
  mkdirSync(dirname(outputPath), { recursive: true });
  const mode = generatedFileMode(path);
  writeFileSync(outputPath, contents, mode === null ? undefined : { mode });
}
console.log(`Generated ${expected.size} files in ${toPosix(relative(root, outputRoot))}.`);
