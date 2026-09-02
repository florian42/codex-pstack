import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { toPosix, walkFilesIfPresent } from "./fs.mjs";
import { readPortability } from "./portability.mjs";

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== ".." && !path.startsWith("../");
}

function skillContents(sourcePath, skillRoot, skillName) {
  const contents = readFileSync(sourcePath);
  if (sourcePath !== resolve(skillRoot, "SKILL.md")) return contents;
  const text = contents.toString("utf8");
  return Buffer.from(text.replace(/^name:.*$/m, `name: ${skillName}`));
}

/** Validate and resolve the config's copied skill resources. */
export function copiedSkillResources(target) {
  const resources = target.copiedSkillResources;
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

    const sourcePath = resolve(target.sourceRoot, resource.source);
    const destinationPath = resolve(target.outputRoot, resource.destination);
    const normalizedSource = toPosix(relative(target.sourceRoot, sourcePath));
    const normalizedDestination = toPosix(relative(target.outputRoot, destinationPath));
    const destinationSegments = normalizedDestination.split("/");
    if (!isWithin(target.sourceRoot, sourcePath) || normalizedSource !== resource.source) {
      throw new Error(
        `${prefix}.source must be a normalized path beneath ${target.sourceRootRelative}/`,
      );
    }
    if (
      !isWithin(target.outputRoot, destinationPath) ||
      normalizedDestination !== resource.destination
    ) {
      throw new Error(
        `${prefix}.destination must be a normalized path beneath the generated package`,
      );
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

/**
 * Copy a canonical agent file, rewriting its frontmatter for one target.
 *
 * The canonical file is never edited: Cursor dispatches Comment Sicko by its
 * display name. A target that registers agents natively wants the lowercase
 * slug plus its own keys, so the copy renames `name`, drops the keys the target
 * does not understand, and sets the ones it does.
 */
/** Quote a frontmatter value only when a YAML parser would misread it bare. */
function yamlScalar(value) {
  return /: |\s#|^[\[\{"'&*!|>%@`]|^\s|\s$/.test(value) ? JSON.stringify(value) : value;
}

export function agentContents(target, agent) {
  const sourcePath = resolve(target.sourceRoot, agent.source);
  const text = readFileSync(sourcePath, "utf8");
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    throw new Error(`copied agent ${agent.source} must start with YAML frontmatter`);
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    throw new Error(`copied agent ${agent.source} frontmatter is missing its closing ---`);
  }

  const removed = new Set(agent.removeFrontmatter);
  const overrides = new Map(Object.entries(agent.frontmatter));
  const applied = new Set();
  const rewritten = [];
  let renamed = false;
  for (const line of lines.slice(1, end)) {
    const key = line.match(/^([A-Za-z][A-Za-z0-9_-]*):/)?.[1];
    if (key === undefined) {
      rewritten.push(line);
      continue;
    }
    if (removed.has(key)) continue;
    if (key === "name") {
      rewritten.push(`name: ${agent.name}`);
      renamed = true;
      continue;
    }
    if (overrides.has(key)) {
      rewritten.push(`${key}: ${yamlScalar(overrides.get(key))}`);
      applied.add(key);
      continue;
    }
    rewritten.push(line);
  }
  if (!renamed) {
    throw new Error(`copied agent ${agent.source} has no frontmatter name to rewrite`);
  }
  for (const [key, value] of overrides) {
    if (!applied.has(key)) rewritten.push(`${key}: ${yamlScalar(value)}`);
  }
  return Buffer.from(["---", ...rewritten, ...lines.slice(end)].join("\n"));
}

function addCopiedAgents(target, files) {
  for (const agent of target.copiedAgents) {
    if (files.has(agent.destination)) {
      throw new Error(`copied agent collides with generated file ${agent.destination}`);
    }
    files.set(agent.destination, agentContents(target, agent));
  }
}

function stopPage(target, reason) {
  return Buffer.from(
    `# ${target.stopPageTitle}\n\n${reason} Stop this route and choose a supported playbook. See the [${target.displayName} runtime mapping](${target.stopPageMappingLink}).\n`,
  );
}

/** Build the complete generated tree for a target as a path -> contents map. */
export function buildFileMap(target) {
  const { records, issues } = readPortability(target.portabilityPath, {
    column: target.portabilityColumn,
  });
  if (issues.length > 0) {
    const detail = issues
      .map((issue) => `${target.portabilityPath}:${issue.line}: ${issue.message}`)
      .join("\n");
    throw new Error(`portability record is not usable:\n${detail}`);
  }

  const unsupportedResources = new Map(
    target.unsupportedResources.map((entry) => [entry.path, entry.reason]),
  );
  const runtimeResources = new Set(target.runtimeResources);
  const files = new Map();

  files.set(target.manifestDestination, readFileSync(target.manifestSourcePath));
  files.set("LICENSE", readFileSync(resolve(target.sourceRoot, "LICENSE")));

  const runtimeReferences = resolve(target.sourceRoot, "references/runtime");
  for (const sourcePath of walkFilesIfPresent(runtimeReferences)) {
    files.set(toPosix(relative(target.sourceRoot, sourcePath)), readFileSync(sourcePath));
  }

  for (const entry of skillDirectories(target)) {
    if (records.get(entry) === "unsupported") continue;
    const skillRoot = resolve(target.sourceSkills, entry);
    for (const sourcePath of walkFilesIfPresent(skillRoot)) {
      const skillRelative = toPosix(relative(target.sourceSkills, sourcePath));
      const segments = skillRelative.split("/");
      if (segments.includes("scripts") && !runtimeResources.has(skillRelative)) continue;
      const unsupportedReason = unsupportedResources.get(skillRelative);
      files.set(
        `skills/${skillRelative}`,
        unsupportedReason === undefined
          ? skillContents(sourcePath, skillRoot, entry)
          : stopPage(target, unsupportedReason),
      );
    }
  }

  addCopiedSkillResources(files, copiedSkillResources(target));
  addCopiedAgents(target, files);

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
          generatedBy: target.generatedBy,
          canonicalSkills: `${target.sourceRootRelative}/skills`,
          contentSha256: hash.digest("hex"),
        },
        null,
        2,
      )}\n`,
    ),
  );
  return files;
}

function skillDirectories(target) {
  return readdirSync(target.sourceSkills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** File mode a generated path must carry, or null when the default applies. */
export function generatedFileMode(target, path) {
  if (!path.startsWith("skills/")) return null;
  const skillRelative = path.slice("skills/".length);
  if (!target.runtimeResources.includes(skillRelative)) return null;
  return statSync(resolve(target.sourceSkills, skillRelative)).mode & 0o777;
}
