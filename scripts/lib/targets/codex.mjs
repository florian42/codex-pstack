import { existsSync, realpathSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

import { walkFiles } from "../fs.mjs";
import { resolveVocabularies } from "../vocabulary.mjs";

/**
 * Codex-only checks that a JSON schema cannot express. They run only for
 * targets whose build config sets `manifestChecks` to `codex`.
 */
export const codexChecks = {
  allowedMarketplaceKeys: new Set(["name", "interface", "plugins"]),

  expectedCopiedSkillResources: [
    {
      source: "agents/comment-sicko.md",
      destination: "skills/no-comments/references/comment-sicko.md",
    },
  ],

  /**
   * What a JSON schema cannot express: that the manifest's skills pointer
   * resolves to the canonical skill tree. Every key, type, and value rule for
   * this manifest lives in schemas/codex-plugin.schema.json and runs from
   * scripts/validate-plugins.mjs; version parity across the three manifests
   * runs from scripts/validate-plugin.mjs.
   */
  validateManifest(context) {
    const { target, fail, readJson, lineOf } = context;
    const manifestPath = target.manifestSourcePath;
    const parsed = readJson(manifestPath);
    if (parsed === null) return;
    const { text, value: manifest } = parsed;

    if (typeof manifest.skills !== "string") {
      fail(manifestPath, lineOf(text, '"skills"'), "skills must be a string");
      return;
    }
    const requestedSkillsPath = resolve(target.sourceRoot, manifest.skills);
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
