import { existsSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

import { walkFiles } from "../fs.mjs";
import { isSemver, versionParityFailures } from "../manifest.mjs";
import { resolveVocabularies } from "../vocabulary.mjs";

/**
 * Codex-only checks. Ticket 04 replaces the hand-rolled manifest key checks
 * with a schema; until then they live here and run only for targets whose
 * build config sets `manifestChecks` to `codex`.
 */
export const codexChecks = {
  allowedMarketplaceKeys: new Set(["name", "interface", "plugins"]),

  expectedCopiedSkillResources: [
    {
      source: "agents/comment-sicko.md",
      destination: "skills/no-comments/references/comment-sicko.md",
    },
  ],

  validateManifest(context) {
    const {
      target,
      fail,
      readJson,
      requireString,
      rejectUnknownKeys,
      lineOf,
    } = context;
    const manifestPath = target.manifestSourcePath;
    const parsed = readJson(manifestPath);
    const referenceParsed = readJson(target.referenceManifestPath);
    if (parsed === null || referenceParsed === null) return;
    const { text, value: manifest } = parsed;
    const referenceManifest = referenceParsed.value;

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
      manifestPath,
      text,
    );

    const name = requireString(manifest, "name", manifestPath, text);
    const version = requireString(manifest, "version", manifestPath, text);
    requireString(manifest, "description", manifestPath, text);
    if (name !== "pstack") {
      fail(manifestPath, lineOf(text, '"name"'), "name must be pstack");
    }
    if (version !== null && !isSemver(version)) {
      fail(manifestPath, lineOf(text, '"version"'), "version must be strict semantic versioning");
    }
    for (const failure of versionParityFailures(
      { label: "Cursor manifest", version: referenceManifest.version },
      [{ label: "Codex manifest", version }],
    )) {
      fail(manifestPath, lineOf(text, '"version"'), failure.message);
    }
    if (manifest.skills !== "./skills/") {
      fail(manifestPath, lineOf(text, '"skills"'), "skills must be ./skills/");
    }

    for (const forbidden of ["agents", "automations", "hooks", "apps", "mcpServers"]) {
      if (Object.hasOwn(manifest, forbidden)) {
        fail(
          manifestPath,
          lineOf(text, `"${forbidden}"`),
          `${forbidden} must not be registered in the ${target.displayName} release`,
        );
      }
    }

    if (manifest.author === null || Array.isArray(manifest.author) || typeof manifest.author !== "object") {
      fail(manifestPath, lineOf(text, '"author"'), "author must be an object");
    } else {
      rejectUnknownKeys(manifest.author, new Set(["name", "email", "url"]), manifestPath, text, "author.");
      requireString(manifest.author, "name", manifestPath, text, "author.");
    }

    for (const key of ["homepage", "repository"]) {
      const value = requireString(manifest, key, manifestPath, text);
      if (value !== null && !/^https:\/\//.test(value)) {
        fail(manifestPath, lineOf(text, `"${key}"`), `${key} must be an absolute HTTPS URL`);
      }
    }
    requireString(manifest, "license", manifestPath, text);

    const interfaceValue = manifest.interface;
    if (interfaceValue === null || Array.isArray(interfaceValue) || typeof interfaceValue !== "object") {
      fail(manifestPath, lineOf(text, '"interface"'), "interface must be an object");
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
        manifestPath,
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
        requireString(interfaceValue, key, manifestPath, text, "interface.");
      }
      if (
        !Array.isArray(interfaceValue.capabilities) ||
        interfaceValue.capabilities.length === 0 ||
        interfaceValue.capabilities.some((item) => typeof item !== "string" || item.trim() === "")
      ) {
        fail(manifestPath, lineOf(text, '"capabilities"'), "interface.capabilities must be a non-empty string array");
      }
      const prompts = interfaceValue.defaultPrompt ?? interfaceValue.default_prompt;
      if (
        !Array.isArray(prompts) ||
        prompts.length === 0 ||
        prompts.length > 3 ||
        prompts.some((item) => typeof item !== "string" || item.trim() === "" || item.length > 128)
      ) {
        fail(manifestPath, lineOf(text, '"defaultPrompt"'), "interface.defaultPrompt must contain 1-3 non-empty strings of at most 128 characters");
      }
    }

    const requestedSkillsPath = resolve(target.sourceRoot, manifest.skills ?? "");
    if (!existsSync(requestedSkillsPath)) {
      fail(manifestPath, lineOf(text, '"skills"'), "skills path does not exist");
    } else if (realpathSync(requestedSkillsPath) !== realpathSync(target.sourceSkills)) {
      fail(manifestPath, lineOf(text, '"skills"'), "skills path must resolve to the canonical pstack/skills tree");
    }
  },

  validateMarketplaceEntry(context, entry, text) {
    const { target, fail, lineOf } = context;
    const marketplacePath = target.marketplace.path;
    if (entry?.policy?.installation !== "AVAILABLE") {
      fail(marketplacePath, lineOf(text, '"installation"'), "policy.installation must be AVAILABLE");
    }
    if (entry?.policy?.authentication !== "ON_INSTALL") {
      fail(marketplacePath, lineOf(text, '"authentication"'), "policy.authentication must be ON_INSTALL");
    }
    if (typeof entry?.category !== "string" || entry.category.trim() === "") {
      fail(marketplacePath, lineOf(text, '"category"'), "category must be a non-empty string");
    }
  },

  validateGeneratedDelegationTerms(context) {
    const { target, fail, readText, lineNumber } = context;
    const generatedNoComments = resolve(target.outputRoot, "skills/no-comments/SKILL.md");
    const text = readText(generatedNoComments);
    if (text === null) return;
    for (const [label, expression] of resolveVocabularies(["codex-delegation-terms"])) {
      for (const match of text.matchAll(expression)) {
        fail(
          generatedNoComments,
          lineNumber(text, match.index),
          `${label} ${JSON.stringify(match[0])} must not leak into generated ${target.displayName} skill instructions`,
        );
      }
    }
  },

  validateNoDuplicateDistribution(context) {
    const { target, fail } = context;
    for (const candidate of ["codex-skills", "codex_skills", "skills-codex"]) {
      const path = resolve(target.sourceRoot, candidate);
      if (existsSync(path) && statSync(path).isDirectory()) {
        fail(
          path,
          1,
          `separate ${target.displayName} skill distributions are forbidden; pstack/skills is canonical`,
        );
      }
    }
  },

  validateSupportedPlaybookRuntimeContract(context) {
    const { target, fail, readText, lineNumber } = context;
    const unsupported = new Set(
      target.unsupportedResources
        .map((resource) => resource?.path)
        .filter((path) => typeof path === "string"),
    );
    const playbooksRoot = resolve(target.outputRoot, "skills/poteto-mode/playbooks");
    const forbiddenPatterns = resolveVocabularies(["codex-banned-playbook-terms"]);

    for (const path of walkFiles(playbooksRoot).filter((candidate) => extname(candidate) === ".md")) {
      const relativePlaybook = relative(resolve(target.outputRoot, "skills"), path)
        .split(sep)
        .join("/");
      if (unsupported.has(relativePlaybook)) continue;
      const text = readText(path);
      if (text === null) continue;
      for (const [label, expression] of forbiddenPatterns) {
        expression.lastIndex = 0;
        for (const match of text.matchAll(expression)) {
          fail(
            path,
            lineNumber(text, match.index),
            `${label} is forbidden in a supported ${target.displayName} playbook; route it through the runtime mapping`,
          );
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
  },
};
