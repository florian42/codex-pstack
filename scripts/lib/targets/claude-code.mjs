import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Claude Code-only checks that a JSON schema cannot express. They run only for
 * targets whose build config sets `manifestChecks` to `claude-code`.
 */
export const claudeCodeChecks = {
  allowedMarketplaceKeys: new Set(["name", "owner", "metadata", "plugins"]),

  /**
   * What a JSON schema cannot express: that the manifest's skills pointer
   * resolves to the canonical skill tree. Every key, type, and value rule for
   * this manifest lives in schemas/claude-plugin.schema.json and runs from
   * scripts/validate-plugins.mjs; version parity across the manifests runs from
   * scripts/validate-plugin.mjs.
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
      fail(
        manifestPath,
        lineOf(text, '"skills"'),
        "skills path must resolve to the canonical pstack/skills tree",
      );
    }
  },

  /**
   * A Claude Code marketplace entry names its plugin directory with a plain
   * relative string, not the Codex `{ source, path }` object.
   */
  validateMarketplaceSource(context, entry, text) {
    const { target, fail, lineOf, root } = context;
    const marketplacePath = target.marketplace.path;
    if (entry?.source !== target.marketplace.sourcePointer) {
      fail(
        marketplacePath,
        lineOf(text, '"source"'),
        `${target.marketplace.pluginName} source must be the generated local path ${target.marketplace.sourcePointer}`,
      );
      return;
    }
    const requestedSource = resolve(root, entry.source);
    if (!existsSync(requestedSource)) {
      fail(marketplacePath, lineOf(text, '"source"'), "generated marketplace source does not exist");
    } else if (realpathSync(requestedSource) !== realpathSync(target.outputRoot)) {
      fail(
        marketplacePath,
        lineOf(text, '"source"'),
        `source path does not resolve to the generated ${target.marketplace.pluginName} distribution`,
      );
    }
  },

  /** The version lives in the manifest only; a fourth copy would drift. */
  validateMarketplaceEntry(context, entry, text) {
    const { target, fail, lineOf } = context;
    if (entry !== null && typeof entry === "object" && "version" in entry) {
      fail(
        target.marketplace.path,
        lineOf(text, '"version"'),
        "marketplace entry must omit version; the plugin manifest owns it",
      );
    }
  },
};
