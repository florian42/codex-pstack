#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { toPosix, walkFiles, walkFilesIfPresent } from "./lib/fs.mjs";
import { readPortability } from "./lib/portability.mjs";
import { isSemver, MANIFESTS, versionParityFailures } from "./lib/manifest.mjs";
import { loadTarget, repositoryRoot, targetNames } from "./lib/targets.mjs";
import { codexChecks } from "./lib/targets/codex.mjs";
import { resolveVocabularies } from "./lib/vocabulary.mjs";

/** Bundles of target-specific checks, selected by the config's manifestChecks. */
const CHECK_BUNDLES = { codex: codexChecks };

function parseArguments(argv) {
  const targets = [];
  let all = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") all = true;
    else if (argument === "--target") targets.push(argv[++index]);
    else if (argument.startsWith("--target=")) targets.push(argument.slice("--target=".length));
    else throw new Error(`unknown argument ${JSON.stringify(argument)}`);
  }
  if (all && targets.length > 0) throw new Error("--all and --target are mutually exclusive");
  if (all) return targetNames();
  if (targets.length === 0) {
    throw new Error(`--target or --all is required; known targets: ${targetNames().join(", ")}`);
  }
  for (const target of targets) {
    if (target === undefined) throw new Error("--target requires a target name");
  }
  return targets;
}

/**
 * Cross-target version parity over every plugin manifest in the repository,
 * with the Cursor manifest as the reference. Runs once per invocation, not per
 * target: a manifest whose target has no build config yet is still covered.
 */
function validateManifestParity(root) {
  const errors = [];
  const read = (manifest) => {
    const path = resolve(root, manifest.path);
    if (!existsSync(path)) {
      errors.push(`${manifest.path}:1: ${manifest.label} is missing`);
      return null;
    }
    const text = readFileSync(path, "utf8");
    try {
      return { ...manifest, text, value: JSON.parse(text) };
    } catch (error) {
      errors.push(`${manifest.path}:1: ${manifest.label} is not valid JSON: ${error.message}`);
      return null;
    }
  };
  const lineOfVersion = (text) => {
    const offset = text.indexOf('"version"');
    return offset === -1 ? 1 : text.slice(0, offset).split("\n").length;
  };

  const loaded = MANIFESTS.map(read);
  const reference = loaded.find((manifest) => manifest?.reference);
  if (reference === undefined) return errors;
  if (!isSemver(reference.value.version)) {
    errors.push(
      `${reference.path}:${lineOfVersion(reference.text)}: version must be strict semantic versioning`,
    );
  }
  const peers = loaded.filter((manifest) => manifest !== null && manifest !== reference);
  for (const peer of peers) {
    if (!isSemver(peer.value.version)) {
      errors.push(
        `${peer.path}:${lineOfVersion(peer.text)}: version must be strict semantic versioning`,
      );
    }
  }
  const failures = versionParityFailures(
    { label: reference.label, version: reference.value.version },
    peers.map((peer) => ({ label: peer.label, version: peer.value.version, peer })),
  );
  for (const failure of failures) {
    const peer = peers.find((candidate) => candidate.label === failure.label);
    errors.push(`${peer.path}:${lineOfVersion(peer.text)}: ${failure.message}`);
  }
  return errors;
}

function validateTarget(target) {
  const root = target.root;
  const pstackRoot = target.sourceRoot;
  const skillsRoot = target.sourceSkills;
  const generatedRoot = target.outputRoot;
  const buildConfigPath = target.configPath;
  const portabilityPath = target.portabilityPath;
  const checks = CHECK_BUNDLES[target.manifestChecks];
  if (checks === undefined) {
    throw new Error(
      `${target.configRelative}: unknown manifestChecks ${JSON.stringify(target.manifestChecks)}`,
    );
  }

  const requiredRuntimeReferences = [
    ...new Set([
      resolve(pstackRoot, "references/runtime/contract.md"),
      resolve(pstackRoot, "references/runtime/cursor.md"),
      target.runtimeMappingPath,
      portabilityPath,
    ]),
  ];
  const publicDocumentationFiles = [
    resolve(pstackRoot, "README.md"),
    ...walkFilesIfPresent(resolve(pstackRoot, "docs")),
  ].filter((path) => extname(path) === ".md");

  const errors = [];

  function relativePath(path) {
    return toPosix(relative(root, path));
  }

  function lineNumber(text, offset) {
    return text.slice(0, Math.max(offset, 0)).split("\n").length;
  }

  function lineOf(text, needle) {
    const offset = text.indexOf(needle);
    return offset === -1 ? 1 : lineNumber(text, offset);
  }

  function fail(path, line, message) {
    errors.push(`${relativePath(path)}:${line}: ${message}`);
  }

  function readText(path) {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      fail(path, 1, `cannot read file: ${error.message}`);
      return null;
    }
  }

  function readJson(path) {
    const text = readText(path);
    if (text === null) return null;
    try {
      const value = JSON.parse(text);
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        fail(path, 1, "expected a JSON object");
        return null;
      }
      return { text, value };
    } catch (error) {
      const offset = Number(error.message.match(/position (\d+)/)?.[1] ?? 0);
      fail(path, lineNumber(text, offset), `invalid JSON: ${error.message}`);
      return null;
    }
  }

  function requireString(payload, key, path, text, prefix = "") {
    if (typeof payload[key] !== "string" || payload[key].trim() === "") {
      fail(path, lineOf(text, `"${key}"`), `${prefix}${key} must be a non-empty string`);
      return null;
    }
    return payload[key];
  }

  function rejectUnknownKeys(payload, allowed, path, text, prefix = "") {
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) {
        fail(
          path,
          lineOf(text, `"${key}"`),
          `${prefix}${key} is not accepted by the ${target.displayName} plugin contract`,
        );
      }
    }
  }

  function toGeneratedPath(path) {
    return toPosix(relative(generatedRoot, path));
  }

  function topLevelSkillFor(path) {
    const marker = `${sep}skills${sep}`;
    const markerIndex = path.lastIndexOf(marker);
    return markerIndex === -1
      ? relative(skillsRoot, path).split(sep)[0]
      : path.slice(markerIndex + marker.length).split(sep)[0];
  }

  const context = {
    target,
    root,
    fail,
    readText,
    readJson,
    requireString,
    rejectUnknownKeys,
    lineOf,
    lineNumber,
    relativePath,
    toGeneratedPath,
  };

  function skillDirectories() {
    return readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(resolve(skillsRoot, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
      .sort();
  }

  function checkFrontmatter(path, text, options) {
    const { values, issues } = parseFrontmatter(text, options);
    for (const issue of issues) fail(path, issue.line, issue.message);
    return values;
  }

  function validateGeneratedDistribution() {
    const runtimeResources = new Set(target.runtimeResources.map((path) => `skills/${path}`));
    const result = spawnSync(
      process.execPath,
      [resolve(root, "scripts/generate-plugin.mjs"), "--target", target.name, "--check"],
      { cwd: root, encoding: "utf8" },
    );
    if (result.status !== 0) {
      const detail = `${result.stderr}${result.stdout}`.trim();
      fail(generatedRoot, 1, detail || "generated distribution check failed");
    }
    for (const forbidden of target.forbiddenGeneratedDirectories) {
      const matches = walkFilesIfPresent(generatedRoot).filter((path) =>
        relative(generatedRoot, path).split(sep).includes(forbidden),
      );
      if (matches.length > 0) {
        fail(
          matches[0],
          1,
          `${forbidden} must be absent from the installed ${target.displayName} distribution`,
        );
      }
    }
    const generatedScripts = walkFilesIfPresent(generatedRoot).filter((path) =>
      relative(generatedRoot, path).split(sep).includes("scripts"),
    );
    for (const path of generatedScripts) {
      if (!runtimeResources.has(toGeneratedPath(path))) {
        fail(
          path,
          1,
          `unlisted script must be absent from the installed ${target.displayName} distribution`,
        );
      }
    }
    for (const generatedPath of runtimeResources) {
      const sourceRelative = generatedPath.replace(/^skills\//, "");
      const sourcePath = resolve(skillsRoot, sourceRelative);
      const installedPath = resolve(generatedRoot, generatedPath);
      if (!existsSync(sourcePath)) {
        fail(buildConfigPath, 1, `runtime resource does not exist: ${sourceRelative}`);
        continue;
      }
      if (!existsSync(installedPath)) {
        fail(
          generatedRoot,
          1,
          `runtime resource is missing from the installed distribution: ${generatedPath}`,
        );
      } else if ((statSync(installedPath).mode & 0o777) !== (statSync(sourcePath).mode & 0o777)) {
        fail(installedPath, 1, `runtime resource must preserve its source file mode: ${generatedPath}`);
      }
      if (/\.test\.[cm]?[jt]sx?$/.test(sourceRelative)) {
        fail(buildConfigPath, 1, `runtime resource must not be a test: ${sourceRelative}`);
      }
      const text = readText(sourcePath);
      if (text === null) continue;
      const importPattern = /from\s+["'](\.[^"']+)["']/g;
      for (const match of text.matchAll(importPattern)) {
        const imported = resolve(dirname(sourcePath), match[1]);
        const importedRelative = toPosix(relative(skillsRoot, imported));
        if (!runtimeResources.has(`skills/${importedRelative}`)) {
          fail(
            sourcePath,
            lineNumber(text, match.index),
            `runtime import is outside the packaged allowlist: ${match[1]}`,
          );
        }
      }
    }
    const sourceManifest = readText(target.manifestSourcePath);
    const generatedManifestPath = resolve(generatedRoot, target.manifestDestination);
    const generatedManifest = readText(generatedManifestPath);
    if (sourceManifest !== null && generatedManifest !== null && sourceManifest !== generatedManifest) {
      fail(
        generatedManifestPath,
        1,
        `generated manifest differs from ${relativePath(target.manifestSourcePath)}`,
      );
    }
  }

  function validateCopiedSkillResources() {
    const parsed = readJson(buildConfigPath);
    if (parsed === null) return;
    const resources = parsed.value.copiedSkillResources;
    if (!Array.isArray(resources)) {
      fail(buildConfigPath, 1, "copiedSkillResources must be an array");
      return;
    }
    const expectedResources = checks.expectedCopiedSkillResources ?? null;
    if (expectedResources !== null && resources.length !== expectedResources.length) {
      fail(
        buildConfigPath,
        lineOf(parsed.text, '"copiedSkillResources"'),
        "copiedSkillResources must contain exactly the Comment Sicko mapping",
      );
      return;
    }
    for (const [index, resource] of resources.entries()) {
      if (resource === null || Array.isArray(resource) || typeof resource !== "object") {
        fail(
          buildConfigPath,
          lineOf(parsed.text, '"copiedSkillResources"'),
          "copiedSkillResources entry must be an object",
        );
        return;
      }
      rejectUnknownKeys(
        resource,
        new Set(["source", "destination"]),
        buildConfigPath,
        parsed.text,
        "copiedSkillResources entry.",
      );
      const expected = expectedResources?.[index];
      if (
        expected !== undefined &&
        (resource.source !== expected.source || resource.destination !== expected.destination)
      ) {
        fail(
          buildConfigPath,
          lineOf(parsed.text, '"copiedSkillResources"'),
          "copiedSkillResources must map agents/comment-sicko.md to skills/no-comments/references/comment-sicko.md",
        );
        return;
      }
      const sourcePath = resolve(pstackRoot, resource.source);
      const generatedPath = resolve(generatedRoot, resource.destination);
      const sourceRelative = toPosix(relative(pstackRoot, sourcePath));
      const generatedRelative = toGeneratedPath(generatedPath);
      if (sourceRelative !== resource.source || sourceRelative.startsWith("../")) {
        fail(
          buildConfigPath,
          lineOf(parsed.text, '"source"'),
          `copiedSkillResources source must be a normalized path beneath ${target.sourceRootRelative}/`,
        );
      }
      if (generatedRelative !== resource.destination || generatedRelative.startsWith("../")) {
        fail(
          buildConfigPath,
          lineOf(parsed.text, '"destination"'),
          "copiedSkillResources destination must be a normalized generated path",
        );
      }
      if (!existsSync(sourcePath)) {
        fail(buildConfigPath, lineOf(parsed.text, '"source"'), "Comment Sicko canonical source is missing");
      }
      if (!existsSync(generatedPath)) {
        fail(generatedPath, 1, "packaged Comment Sicko reference is missing");
      } else if (existsSync(sourcePath) && !readFileSync(sourcePath).equals(readFileSync(generatedPath))) {
        fail(
          generatedPath,
          1,
          `packaged Comment Sicko reference must be byte-identical to ${relativePath(sourcePath)}`,
        );
      }
    }
  }

  function validateCommentReviewerContract() {
    const canonicalPath = resolve(pstackRoot, "agents/comment-sicko.md");
    const editableRoots = [resolve(pstackRoot, "agents"), skillsRoot];
    for (const editableRoot of editableRoots) {
      for (const path of walkFilesIfPresent(editableRoot).filter((candidate) => candidate.endsWith(".md"))) {
        if (path === canonicalPath) continue;
        const text = readText(path);
        if (text === null) continue;
        if (path.endsWith(`${sep}comment-sicko.md`) || /^name:\s*Comment Sicko\s*$/m.test(text)) {
          fail(
            path,
            1,
            "Comment Sicko must have exactly one editable definition at pstack/agents/comment-sicko.md",
          );
        }
      }
    }
  }

  function validateMarketplace() {
    const marketplacePath = target.marketplace.path;
    const parsed = readJson(marketplacePath);
    if (parsed === null) return;
    const { text, value: marketplace } = parsed;
    rejectUnknownKeys(
      marketplace,
      checks.allowedMarketplaceKeys ?? new Set(Object.keys(marketplace)),
      marketplacePath,
      text,
    );
    const marketplaceName = requireString(marketplace, "name", marketplacePath, text);
    if (marketplaceName !== target.marketplace.name) {
      fail(
        marketplacePath,
        lineOf(text, '"name"'),
        `marketplace name must be ${target.marketplace.name}`,
      );
    }
    if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
      fail(
        marketplacePath,
        lineOf(text, '"plugins"'),
        `plugins must contain exactly the ${target.marketplace.pluginName} entry`,
      );
      return;
    }
    const entry = marketplace.plugins[0];
    if (entry?.name !== target.marketplace.pluginName) {
      fail(
        marketplacePath,
        lineOf(text, '"plugins"'),
        `plugin entry name must be ${target.marketplace.pluginName}`,
      );
    }
    if (entry?.source?.source !== "local" || entry?.source?.path !== target.marketplace.sourcePointer) {
      fail(
        marketplacePath,
        lineOf(text, '"source"'),
        `${target.marketplace.pluginName} source must be the generated local path ${target.marketplace.sourcePointer}`,
      );
    } else {
      const requestedSource = resolve(root, entry.source.path);
      if (!existsSync(requestedSource)) {
        fail(marketplacePath, lineOf(text, '"path"'), "generated marketplace source does not exist");
      } else if (realpathSync(requestedSource) !== realpathSync(generatedRoot)) {
        fail(
          marketplacePath,
          lineOf(text, '"path"'),
          `source path does not resolve to the generated ${target.marketplace.pluginName} distribution`,
        );
      }
    }
    checks.validateMarketplaceEntry?.(context, entry, text);
  }

  function validateSkillsAndPortability() {
    for (const path of requiredRuntimeReferences) {
      if (!existsSync(path)) fail(path, 1, "required runtime compatibility reference is missing");
    }
    let portability = new Map();
    if (existsSync(portabilityPath)) {
      const parsed = readPortability(portabilityPath, { column: target.portabilityColumn });
      for (const issue of parsed.issues) fail(portabilityPath, issue.line, issue.message);
      portability = parsed.records;
    }
    const directories = skillDirectories();
    for (const directory of directories) {
      if (!portability.has(directory)) {
        fail(portabilityPath, 1, `missing portability classification for ${directory}`);
      }
    }
    for (const classified of portability.keys()) {
      if (!directories.includes(classified)) {
        fail(portabilityPath, 1, `portability classification names unknown skill ${classified}`);
      }
    }

    const skillFiles = walkFilesIfPresent(skillsRoot).filter((path) => path.endsWith("/SKILL.md"));
    for (const path of skillFiles) {
      const text = readText(path);
      if (text === null) continue;
      checkFrontmatter(path, text);
    }
    return portability;
  }

  function validateGeneratedSkillNames() {
    const generatedSkillsRoot = resolve(generatedRoot, "skills");
    const seenNames = new Map();
    for (const path of walkFilesIfPresent(generatedSkillsRoot).filter((candidate) =>
      candidate.endsWith("/SKILL.md"),
    )) {
      const text = readText(path);
      if (text === null) continue;
      const frontmatter = checkFrontmatter(path, text);
      if (frontmatter === null) continue;
      const name = frontmatter.get("name");
      const expectedName = relative(generatedSkillsRoot, dirname(path)).split(sep).at(-1);
      if (name !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        fail(
          path,
          lineOf(text, "name:"),
          `frontmatter name must be lowercase hyphen-case for ${target.displayName} discovery`,
        );
      }
      if (dirname(path) === resolve(generatedSkillsRoot, expectedName) && name !== expectedName) {
        fail(path, lineOf(text, "name:"), `frontmatter name must match skill directory ${expectedName}`);
      }
      if (name !== undefined) {
        if (seenNames.has(name)) {
          fail(
            path,
            lineOf(text, "name:"),
            `duplicate skill name also used by ${relativePath(seenNames.get(name))}`,
          );
        } else seenNames.set(name, path);
      }
    }
    for (const required of target.requiredSkills) {
      if (!seenNames.has(required)) {
        fail(
          resolve(generatedSkillsRoot, `${required}/SKILL.md`),
          1,
          `${target.displayName} must discover a skill named ${required}`,
        );
      }
    }
    for (const required of target.requiredAgents) {
      const agentPath = resolve(generatedRoot, `agents/${required}.md`);
      if (!existsSync(agentPath)) {
        fail(agentPath, 1, `${target.displayName} must discover an agent named ${required}`);
      }
    }
  }

  function validatePlatformCoupling() {
    const buildConfig = readJson(buildConfigPath)?.value;
    const allowlist = new Set(
      (buildConfig?.platformTermAllowlist ?? []).map((entry) => `${entry.path}\0${entry.match}`),
    );
    const usedAllowlist = new Set();
    const generatedSkills = resolve(generatedRoot, "skills");
    if (!existsSync(generatedSkills)) {
      fail(generatedRoot, 1, "generated skills directory is missing");
      return;
    }
    const terms = resolveVocabularies(target.bannedVocabularies);
    for (const path of walkFiles(generatedSkills).filter((candidate) => extname(candidate) === ".md")) {
      const text = readText(path);
      if (text === null) continue;
      for (const [label, expression] of terms) {
        expression.lastIndex = 0;
        for (const match of text.matchAll(expression)) {
          const allowance = `${toGeneratedPath(path)}\0${match[0]}`;
          if (allowlist.has(allowance)) {
            usedAllowlist.add(allowance);
            continue;
          }
          fail(
            path,
            lineNumber(text, match.index),
            `${label} ${JSON.stringify(match[0])} is not allowed in the ${target.displayName} distribution; move it to a runtime mapping or add a reviewed exact-match exception`,
          );
        }
      }
    }
    for (const allowance of allowlist) {
      if (!usedAllowlist.has(allowance)) {
        const [path, match] = allowance.split("\0");
        fail(
          buildConfigPath,
          1,
          `stale platform-term allowlist entry for ${path}: ${JSON.stringify(match)}`,
        );
      }
    }
  }

  function markdownCorpus() {
    return [
      ...walkFilesIfPresent(skillsRoot),
      ...walkFilesIfPresent(resolve(pstackRoot, "references/runtime")),
      ...publicDocumentationFiles,
      ...walkFilesIfPresent(generatedRoot),
    ].filter((path) => extname(path) === ".md");
  }

  function validateMarkdownLinks() {
    const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g;
    for (const path of markdownCorpus()) {
      const text = readText(path);
      if (text === null) continue;
      for (const match of text.matchAll(linkPattern)) {
        let linkTarget = match[1].replace(/^<|>$/g, "");
        if (/^(?:https?:|mailto:|tel:|#|\/)/.test(linkTarget) || linkTarget === "url" || /[{}]/.test(linkTarget)) {
          continue;
        }
        linkTarget = linkTarget.split("#", 1)[0].split("?", 1)[0];
        if (linkTarget === "") continue;
        let decodedTarget;
        try {
          decodedTarget = decodeURIComponent(linkTarget);
        } catch {
          fail(path, lineNumber(text, match.index), `Markdown link has invalid escaping: ${linkTarget}`);
          continue;
        }
        if (!existsSync(resolve(dirname(path), decodedTarget))) {
          fail(path, lineNumber(text, match.index), `broken local Markdown link: ${linkTarget}`);
        }
      }
    }
  }

  function validateBacktickedLocalReferences() {
    const referencePattern =
      /`((?:\.\.\/|\.\/|references\/|playbooks\/|templates\/|skills\/|pstack\/)[^`\s<>]*(?:\.md|\.json))`/g;
    for (const path of markdownCorpus()) {
      const text = readText(path);
      if (text === null) continue;
      for (const match of text.matchAll(referencePattern)) {
        const referenceTarget = match[1];
        if (/[{}*]/.test(referenceTarget)) continue;
        const pathWithinSkills = path.includes(`${sep}skills${sep}`);
        const skillsMarkerIndex = path.lastIndexOf(`${sep}skills${sep}`);
        const skillRoot = pathWithinSkills
          ? resolve(path.slice(0, skillsMarkerIndex), "skills", topLevelSkillFor(path))
          : dirname(path);
        const base = referenceTarget.startsWith("pstack/")
          ? root
          : referenceTarget.startsWith("skills/")
            ? pathWithinSkills
              ? path.slice(0, skillsMarkerIndex)
              : pstackRoot
            : /^(?:references|playbooks|templates)\//.test(referenceTarget)
              ? skillRoot
              : dirname(path);
        if (!existsSync(resolve(base, referenceTarget.split("#", 1)[0]))) {
          fail(
            path,
            lineNumber(text, match.index),
            `broken backticked local reference: ${referenceTarget}`,
          );
        }
      }
    }
  }

  function validateUnsupportedResourceContract() {
    const mapping = readText(target.runtimeMappingPath);
    const portability = readText(portabilityPath);
    if (mapping === null || portability === null) return;
    for (const resource of target.unsupportedResources) {
      if (typeof resource?.path !== "string") {
        fail(buildConfigPath, 1, "unsupported resource path must be a string");
        continue;
      }
      const route = resource.path.split("/").at(-1)?.replace(/\.md$/, "");
      if (route === undefined) continue;
      if (!mapping.includes(`\`${route}\``)) {
        fail(buildConfigPath, 1, `unsupported route ${route} is missing from the ${target.displayName} runtime mapping ${target.runtimeMapping}`);
      }
      if (!portability.includes(`\`${route}\``)) {
        fail(buildConfigPath, 1, `unsupported route ${route} is missing from the portability record`);
      }
    }
  }

  checks.validateManifest?.(context);
  validateGeneratedDistribution();
  validateCopiedSkillResources();
  validateCommentReviewerContract();
  validateMarketplace();
  const portability = validateSkillsAndPortability();
  validateGeneratedSkillNames();
  validatePlatformCoupling();
  validateMarkdownLinks();
  validateBacktickedLocalReferences();
  checks.validateNoDuplicateDistribution?.(context);
  validateUnsupportedResourceContract();
  checks.validateSupportedPlaybookRuntimeContract?.(context);

  return { errors, skillCount: skillDirectories().length, portabilityCount: portability.size };
}

function main(argv) {
  const requested = parseArguments(argv);
  const root = repositoryRoot();
  let status = 0;
  const parityErrors = validateManifestParity(root);
  if (parityErrors.length > 0) {
    for (const error of parityErrors) console.error(`ERROR ${error}`);
    console.error(`\nManifest version parity failed with ${parityErrors.length} error(s).`);
    status = 1;
  }
  for (const name of requested) {
    const target = loadTarget(name, root);
    const { errors, skillCount, portabilityCount } = validateTarget(target);
    if (errors.length > 0) {
      for (const error of errors) console.error(`ERROR ${error}`);
      console.error(
        `\n${target.displayName} pstack validation failed with ${errors.length} error(s).`,
      );
      status = 1;
      continue;
    }
    console.log(
      `${target.displayName} pstack validation passed: 1 plugin, ${skillCount} skills, ${portabilityCount} portability records.`,
    );
  }
  return status;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}
