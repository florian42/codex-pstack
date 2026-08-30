#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(
  process.env.CODEX_PSTACK_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const pstackRoot = resolve(root, "pstack");
const skillsRoot = resolve(pstackRoot, "skills");
const codexManifestPath = resolve(pstackRoot, ".codex-plugin/plugin.json");
const cursorManifestPath = resolve(pstackRoot, ".cursor-plugin/plugin.json");
const marketplacePath = resolve(root, ".agents/plugins/marketplace.json");
const generatedRoot = resolve(root, ".agents/plugins/pstack");
const buildConfigPath = resolve(root, ".agents/plugins/pstack-build.json");
const portabilityPath = resolve(
  pstackRoot,
  "references/runtime/skill-portability.md",
);
const requiredRuntimeReferences = [
  "contract.md",
  "cursor.md",
  "codex.md",
  "skill-portability.md",
].map((name) => resolve(pstackRoot, "references/runtime", name));

const errors = [];

function relativePath(path) {
  return relative(root, path).split(sep).join("/");
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
      fail(path, lineOf(text, `"${key}"`), `${prefix}${key} is not accepted by the Codex plugin contract`);
    }
  }
}

function validateCodexManifest() {
  const parsed = readJson(codexManifestPath);
  const cursorParsed = readJson(cursorManifestPath);
  if (parsed === null || cursorParsed === null) return;
  const { text, value: manifest } = parsed;
  const cursorManifest = cursorParsed.value;

  rejectUnknownKeys(
    manifest,
    new Set([
      "id",
      "name",
      "version",
      "description",
      "skills",
      "apps",
      "mcpServers",
      "interface",
      "author",
      "homepage",
      "repository",
      "license",
      "keywords",
    ]),
    codexManifestPath,
    text,
  );

  const name = requireString(manifest, "name", codexManifestPath, text);
  const version = requireString(manifest, "version", codexManifestPath, text);
  requireString(manifest, "description", codexManifestPath, text);
  if (name !== "pstack") {
    fail(codexManifestPath, lineOf(text, '"name"'), "name must be pstack");
  }
  if (
    version !== null &&
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)
  ) {
    fail(codexManifestPath, lineOf(text, '"version"'), "version must be strict semantic versioning");
  }
  if (version !== cursorManifest.version) {
    fail(
      codexManifestPath,
      lineOf(text, '"version"'),
      `version ${JSON.stringify(version)} must match Cursor manifest version ${JSON.stringify(cursorManifest.version)}`,
    );
  }
  if (manifest.skills !== "./skills/") {
    fail(codexManifestPath, lineOf(text, '"skills"'), "skills must be ./skills/");
  }

  for (const forbidden of ["agents", "automations", "hooks", "apps", "mcpServers"]) {
    if (Object.hasOwn(manifest, forbidden)) {
      fail(
        codexManifestPath,
        lineOf(text, `"${forbidden}"`),
        `${forbidden} must not be registered in the Codex release`,
      );
    }
  }

  if (manifest.author === null || Array.isArray(manifest.author) || typeof manifest.author !== "object") {
    fail(codexManifestPath, lineOf(text, '"author"'), "author must be an object");
  } else {
    rejectUnknownKeys(
      manifest.author,
      new Set(["name", "email", "url"]),
      codexManifestPath,
      text,
      "author.",
    );
    requireString(manifest.author, "name", codexManifestPath, text, "author.");
  }

  for (const key of ["homepage", "repository"]) {
    const value = requireString(manifest, key, codexManifestPath, text);
    if (value !== null && !/^https:\/\//.test(value)) {
      fail(codexManifestPath, lineOf(text, `"${key}"`), `${key} must be an absolute HTTPS URL`);
    }
  }
  requireString(manifest, "license", codexManifestPath, text);

  const interfaceValue = manifest.interface;
  if (interfaceValue === null || Array.isArray(interfaceValue) || typeof interfaceValue !== "object") {
    fail(codexManifestPath, lineOf(text, '"interface"'), "interface must be an object");
  } else {
    rejectUnknownKeys(
      interfaceValue,
      new Set([
        "displayName",
        "shortDescription",
        "longDescription",
        "developerName",
        "category",
        "capabilities",
        "websiteURL",
        "privacyPolicyURL",
        "termsOfServiceURL",
        "brandColor",
        "composerIcon",
        "logo",
        "logoDark",
        "screenshots",
        "defaultPrompt",
        "default_prompt",
      ]),
      codexManifestPath,
      text,
      "interface.",
    );
    for (const key of [
      "displayName",
      "shortDescription",
      "longDescription",
      "developerName",
      "category",
    ]) {
      requireString(interfaceValue, key, codexManifestPath, text, "interface.");
    }
    if (
      !Array.isArray(interfaceValue.capabilities) ||
      interfaceValue.capabilities.length === 0 ||
      interfaceValue.capabilities.some((item) => typeof item !== "string" || item.trim() === "")
    ) {
      fail(codexManifestPath, lineOf(text, '"capabilities"'), "interface.capabilities must be a non-empty string array");
    }
    const prompts = interfaceValue.defaultPrompt ?? interfaceValue.default_prompt;
    if (
      !Array.isArray(prompts) ||
      prompts.length === 0 ||
      prompts.length > 3 ||
      prompts.some((item) => typeof item !== "string" || item.trim() === "" || item.length > 128)
    ) {
      fail(codexManifestPath, lineOf(text, '"defaultPrompt"'), "interface.defaultPrompt must contain 1-3 non-empty strings of at most 128 characters");
    }
  }

  const requestedSkillsPath = resolve(pstackRoot, manifest.skills ?? "");
  if (!existsSync(requestedSkillsPath)) {
    fail(codexManifestPath, lineOf(text, '"skills"'), "skills path does not exist");
  } else if (realpathSync(requestedSkillsPath) !== realpathSync(skillsRoot)) {
    fail(codexManifestPath, lineOf(text, '"skills"'), "skills path must resolve to the canonical pstack/skills tree");
  }
}

function validateMarketplace() {
  const parsed = readJson(marketplacePath);
  if (parsed === null) return;
  const { text, value: marketplace } = parsed;
  rejectUnknownKeys(
    marketplace,
    new Set(["name", "interface", "plugins"]),
    marketplacePath,
    text,
  );
  const marketplaceName = requireString(marketplace, "name", marketplacePath, text);
  if (marketplaceName !== "codex-pstack") {
    fail(marketplacePath, lineOf(text, '"name"'), "marketplace name must be codex-pstack");
  }
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    fail(marketplacePath, lineOf(text, '"plugins"'), "plugins must contain exactly the pstack entry");
    return;
  }
  const entry = marketplace.plugins[0];
  if (entry?.name !== "pstack") {
    fail(marketplacePath, lineOf(text, '"plugins"'), "plugin entry name must be pstack");
  }
  if (
    entry?.source?.source !== "local" ||
    entry?.source?.path !== "./.agents/plugins/pstack"
  ) {
    fail(
      marketplacePath,
      lineOf(text, '"source"'),
      "pstack source must be the generated local path ./.agents/plugins/pstack",
    );
  } else {
    const requestedSource = resolve(root, entry.source.path);
    if (!existsSync(requestedSource)) {
      fail(marketplacePath, lineOf(text, '"path"'), "generated marketplace source does not exist");
    } else if (realpathSync(requestedSource) !== realpathSync(generatedRoot)) {
      fail(marketplacePath, lineOf(text, '"path"'), "source path does not resolve to the generated pstack distribution");
    }
  }
  if (entry?.policy?.installation !== "AVAILABLE") {
    fail(marketplacePath, lineOf(text, '"installation"'), "policy.installation must be AVAILABLE");
  }
  if (entry?.policy?.authentication !== "ON_INSTALL") {
    fail(marketplacePath, lineOf(text, '"authentication"'), "policy.authentication must be ON_INSTALL");
  }
  if (typeof entry?.category !== "string" || entry.category.trim() === "") {
    fail(marketplacePath, lineOf(text, '"category"'), "category must be a non-empty string");
  }
}

function walkFiles(path) {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function parseFrontmatter(path, text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    fail(path, 1, "SKILL.md must start with YAML frontmatter");
    return null;
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    fail(path, 1, "SKILL.md frontmatter is missing its closing --- delimiter");
    return null;
  }
  const values = new Map();
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (match === null) {
      fail(path, index + 1, "invalid top-level YAML frontmatter entry");
      continue;
    }
    const [, key, rawValue = ""] = match;
    if (values.has(key)) fail(path, index + 1, `duplicate frontmatter key ${key}`);
    values.set(key, rawValue.trim().replace(/^(['"])(.*)\1$/, "$2"));
  }
  for (const key of ["name", "description"]) {
    const value = values.get(key);
    if (value === undefined || value === "" || /^[>|]-?$/.test(value)) {
      const keyLine = lines.findIndex((line) => line.startsWith(`${key}:`)) + 1 || 1;
      const hasBlockValue =
        value !== undefined &&
        /^[>|]-?$/.test(value) &&
        lines.slice(keyLine, end).some((line) => /^\s+\S/.test(line));
      if (!hasBlockValue) fail(path, keyLine, `frontmatter ${key} must be non-empty`);
    }
  }
  return values;
}

function skillDirectories() {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(skillsRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function parsePortability() {
  const text = readText(portabilityPath);
  if (text === null) return new Map();
  const result = new Map();
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ""));
    if (cells.length < 2) continue;
    const skill = cells[0];
    const normalized = cells[1].toLowerCase();
    const status = new Map([
      ["portable", "portable"],
      ["portable unchanged", "portable"],
      ["adapted", "adapted"],
      ["wording edit", "adapted"],
      ["unsupported", "unsupported"],
    ]).get(normalized);
    if (status !== undefined) {
      if (result.has(skill)) fail(portabilityPath, index + 1, `duplicate portability row for ${skill}`);
      result.set(skill, status);
    }
  }
  return result;
}

function validateSkillsAndPortability() {
  for (const path of requiredRuntimeReferences) {
    if (!existsSync(path)) fail(path, 1, "required runtime compatibility reference is missing");
  }
  const portability = parsePortability();
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

  const skillFiles = walkFiles(skillsRoot).filter((path) => path.endsWith("/SKILL.md"));
  for (const path of skillFiles) {
    const text = readText(path);
    if (text === null) continue;
    parseFrontmatter(path, text);
  }
  return portability;
}

function validateGeneratedSkillNames() {
  const generatedSkillsRoot = resolve(generatedRoot, "skills");
  const seenNames = new Map();
  for (const path of walkFiles(generatedSkillsRoot).filter((candidate) => candidate.endsWith("/SKILL.md"))) {
    const text = readText(path);
    if (text === null) continue;
    const frontmatter = parseFrontmatter(path, text);
    if (frontmatter === null) continue;
    const name = frontmatter.get("name");
    const expectedName = relative(generatedSkillsRoot, dirname(path)).split(sep).at(-1);
    if (name !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      fail(path, lineOf(text, "name:"), "frontmatter name must be lowercase hyphen-case for Codex discovery");
    }
    if (dirname(path) === resolve(generatedSkillsRoot, expectedName) && name !== expectedName) {
      fail(path, lineOf(text, "name:"), `frontmatter name must match skill directory ${expectedName}`);
    }
    if (name !== undefined) {
      if (seenNames.has(name)) fail(path, lineOf(text, "name:"), `duplicate skill name also used by ${relativePath(seenNames.get(name))}`);
      else seenNames.set(name, path);
    }
  }
  if (!seenNames.has("poteto-mode")) {
    fail(resolve(generatedSkillsRoot, "poteto-mode/SKILL.md"), 1, "Codex must discover a skill named poteto-mode");
  }
}

const platformTerms = [
  ["Cursor name", /\bCursor(?:'s)?\b/g],
  ["Cursor path", /(?:~\/|\.)\.cursor\//g],
  ["Cursor AskQuestion", /\bAskQuestion\b/g],
  ["Cursor Task delegation", /`Task`|\bTask (?:tool|calls?|prompts?)\b/g],
  ["Cursor background flag", /\brun_in_background\b/g],
  ["Cursor agent type", /\b(?:subagent_type|generalPurpose)\b/g],
  ["Cursor model slug", /\b(?:claude-(?:fable|opus)|grok-)[a-z0-9.-]*\b/g],
  ["Cursor automation URL", /\bcursor\.sh\b/g],
  ["Cursor loop command", /`\/loop`/g],
  ["Cursor transcript path", /\bagent-transcripts\b/g],
];

function topLevelSkillFor(path) {
  const marker = `${sep}skills${sep}`;
  const markerIndex = path.lastIndexOf(marker);
  return markerIndex === -1
    ? relative(skillsRoot, path).split(sep)[0]
    : path.slice(markerIndex + marker.length).split(sep)[0];
}

function validatePlatformCoupling(portability) {
  const buildConfig = readJson(buildConfigPath)?.value;
  const allowlist = new Set(
    (buildConfig?.platformTermAllowlist ?? []).map(
      (entry) => `${entry.path}\0${entry.match}`,
    ),
  );
  const usedAllowlist = new Set();
  const generatedSkills = resolve(generatedRoot, "skills");
  if (!existsSync(generatedSkills)) {
    fail(generatedRoot, 1, "generated skills directory is missing");
    return;
  }
  for (const path of walkFiles(generatedSkills).filter((candidate) => extname(candidate) === ".md")) {
    const text = readText(path);
    if (text === null) continue;
    for (const [label, expression] of platformTerms) {
      expression.lastIndex = 0;
      for (const match of text.matchAll(expression)) {
        const generatedPath = toGeneratedPath(path);
        const allowance = `${generatedPath}\0${match[0]}`;
        if (allowlist.has(allowance)) {
          usedAllowlist.add(allowance);
          continue;
        }
        fail(
          path,
          lineNumber(text, match.index),
          `${label} ${JSON.stringify(match[0])} is not allowed in the Codex distribution; move it to a runtime mapping or add a reviewed exact-match exception`,
        );
      }
    }
  }
  for (const allowance of allowlist) {
    if (!usedAllowlist.has(allowance)) {
      const [path, match] = allowance.split("\0");
      fail(buildConfigPath, 1, `stale platform-term allowlist entry for ${path}: ${JSON.stringify(match)}`);
    }
  }
}

function toGeneratedPath(path) {
  return relative(generatedRoot, path).split(sep).join("/");
}

function validateMarkdownLinks() {
  const markdownFiles = [
    ...walkFiles(skillsRoot),
    ...walkFiles(resolve(pstackRoot, "references/runtime")),
    resolve(pstackRoot, "docs/codex.md"),
    ...walkFiles(generatedRoot),
  ].filter((path) => extname(path) === ".md");
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g;
  for (const path of markdownFiles) {
    const text = readText(path);
    if (text === null) continue;
    for (const match of text.matchAll(linkPattern)) {
      let target = match[1].replace(/^<|>$/g, "");
      if (
        /^(?:https?:|mailto:|tel:|#|\/)/.test(target) ||
        target === "url" ||
        /[{}]/.test(target)
      ) {
        continue;
      }
      target = target.split("#", 1)[0].split("?", 1)[0];
      if (target === "") continue;
      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        fail(path, lineNumber(text, match.index), `Markdown link has invalid escaping: ${target}`);
        continue;
      }
      const resolvedTarget = resolve(dirname(path), decodedTarget);
      if (!existsSync(resolvedTarget)) {
        fail(path, lineNumber(text, match.index), `broken local Markdown link: ${target}`);
      }
    }
  }
}

function validateBacktickedLocalReferences() {
  const markdownFiles = [
    ...walkFiles(skillsRoot),
    ...walkFiles(resolve(pstackRoot, "references/runtime")),
    resolve(pstackRoot, "docs/codex.md"),
    ...walkFiles(generatedRoot),
  ].filter((path) => extname(path) === ".md");
  const referencePattern = /`((?:\.\.\/|\.\/|references\/|playbooks\/|templates\/|skills\/|pstack\/)[^`\s<>]*(?:\.md|\.json))`/g;
  for (const path of markdownFiles) {
    const text = readText(path);
    if (text === null) continue;
    for (const match of text.matchAll(referencePattern)) {
      const target = match[1];
      if (/[{}*]/.test(target)) continue;
      const pathWithinSkills = path.includes(`${sep}skills${sep}`);
      const skillsMarkerIndex = path.lastIndexOf(`${sep}skills${sep}`);
      const skillRoot = pathWithinSkills
        ? resolve(path.slice(0, skillsMarkerIndex), "skills", topLevelSkillFor(path))
        : dirname(path);
      const base = target.startsWith("pstack/")
        ? root
        : target.startsWith("skills/")
          ? pathWithinSkills
            ? path.slice(0, skillsMarkerIndex)
            : pstackRoot
          : /^(?:references|playbooks|templates)\//.test(target)
            ? skillRoot
            : dirname(path);
      if (!existsSync(resolve(base, target.split("#", 1)[0]))) {
        fail(path, lineNumber(text, match.index), `broken backticked local reference: ${target}`);
      }
    }
  }
}

function validateGeneratedDistribution() {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts/generate-codex-pstack.mjs"), "--check"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) {
    const detail = `${result.stderr}${result.stdout}`.trim();
    fail(
      generatedRoot,
      1,
      detail || "generated distribution check failed",
    );
  }
  for (const forbidden of ["agents", "automations", "scripts", "codex-skills"]) {
    const matches = walkFiles(generatedRoot).filter((path) =>
      relative(generatedRoot, path).split(sep).includes(forbidden),
    );
    if (matches.length > 0) {
      fail(matches[0], 1, `${forbidden} must be absent from the installed Codex distribution`);
    }
  }
  const sourceManifest = readText(codexManifestPath);
  const generatedManifestPath = resolve(generatedRoot, ".codex-plugin/plugin.json");
  const generatedManifest = readText(generatedManifestPath);
  if (sourceManifest !== null && generatedManifest !== null && sourceManifest !== generatedManifest) {
    fail(generatedManifestPath, 1, "generated manifest differs from pstack/.codex-plugin/plugin.json");
  }
}

function validateNoDuplicateDistribution() {
  for (const candidate of ["codex-skills", "codex_skills", "skills-codex"]) {
    const path = resolve(pstackRoot, candidate);
    if (existsSync(path) && statSync(path).isDirectory()) {
      fail(path, 1, "separate Codex skill distributions are forbidden; pstack/skills is canonical");
    }
  }
}

function validateUnsupportedResourceContract() {
  const parsed = readJson(buildConfigPath);
  const potetoPath = resolve(skillsRoot, "poteto-mode/SKILL.md");
  const poteto = readText(potetoPath);
  const portability = readText(portabilityPath);
  if (parsed === null || poteto === null || portability === null) return;
  for (const resource of parsed.value.unsupportedResources ?? []) {
    if (typeof resource?.path !== "string") {
      fail(buildConfigPath, 1, "unsupported resource path must be a string");
      continue;
    }
    const route = resource.path.split("/").at(-1)?.replace(/\.md$/, "");
    if (route === undefined) continue;
    if (!poteto.includes(`\`${route}\``)) {
      fail(buildConfigPath, 1, `unsupported route ${route} is missing from poteto-mode's declared set`);
    }
    if (!portability.includes(`\`${route}\``)) {
      fail(buildConfigPath, 1, `unsupported route ${route} is missing from the portability record`);
    }
  }
}

function validateSupportedPlaybookRuntimeContract() {
  const parsed = readJson(buildConfigPath);
  if (parsed === null) return;
  const unsupported = new Set(
    (parsed.value.unsupportedResources ?? [])
      .map((resource) => resource?.path)
      .filter((path) => typeof path === "string"),
  );
  const playbooksRoot = resolve(generatedRoot, "skills/poteto-mode/playbooks");
  const forbiddenPatterns = [
    ["Cursor-only plugin package", /\bcursor-team-kit\b/g],
    ["Cursor-only model slug", /\bgpt-5\.6-sol-max\b/g],
    ["destructive checkout recovery", /\bgit reset --hard\b/g],
    ["unsupported cleanup command", /`?\/deslop`?/g],
    ["unsupported comment-review command", /`?\/no-comments`?/g],
  ];

  for (const path of walkFiles(playbooksRoot).filter((candidate) => extname(candidate) === ".md")) {
    const relativePlaybook = relative(resolve(generatedRoot, "skills"), path)
      .split(sep)
      .join("/");
    if (unsupported.has(relativePlaybook)) continue;
    const text = readText(path);
    if (text === null) continue;
    for (const [label, expression] of forbiddenPatterns) {
      expression.lastIndex = 0;
      for (const match of text.matchAll(expression)) {
        fail(path, lineNumber(text, match.index), `${label} is forbidden in a supported Codex playbook; route it through the runtime mapping`);
      }
    }
    for (const unsupportedPath of unsupported) {
      const route = unsupportedPath.split("/").at(-1);
      const needle = `playbooks/${route}`;
      const offset = text.indexOf(needle);
      if (offset !== -1) {
        fail(path, lineNumber(text, offset), `supported playbook must not route through unsupported ${route}`);
      }
    }
  }
}

validateCodexManifest();
validateGeneratedDistribution();
validateMarketplace();
const portability = validateSkillsAndPortability();
validateGeneratedSkillNames();
validatePlatformCoupling(portability);
validateMarkdownLinks();
validateBacktickedLocalReferences();
validateNoDuplicateDistribution();
validateUnsupportedResourceContract();
validateSupportedPlaybookRuntimeContract();

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nCodex pstack validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `Codex pstack validation passed: 1 plugin, ${skillDirectories().length} skills, ${portability.size} portability records.`,
);
