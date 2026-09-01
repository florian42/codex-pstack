export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isSemver(version) {
  return typeof version === "string" && SEMVER.test(version);
}

/**
 * N-way version parity with the Cursor manifest as the reference.
 *
 * `manifests` is a list of `{ label, version }`; every entry whose version
 * differs from the reference is reported.
 */
export function versionParityFailures(reference, manifests) {
  const failures = [];
  for (const manifest of manifests) {
    if (manifest.version !== reference.version) {
      failures.push({
        label: manifest.label,
        message: `version ${JSON.stringify(manifest.version)} must match ${reference.label} version ${JSON.stringify(reference.version)}`,
      });
    }
  }
  return failures;
}

/**
 * Every plugin manifest in the repository, in the order they are reported.
 * The first entry is the reference every other manifest's version must match.
 *
 * Paths are relative to the repository root. This list is deliberately not
 * derived from the target registry: the Claude Code manifest exists before its
 * build config does.
 */
export const MANIFESTS = [
  { label: "Cursor manifest", path: "pstack/.cursor-plugin/plugin.json", reference: true },
  { label: "Codex manifest", path: "pstack/.codex-plugin/plugin.json" },
  { label: "Claude Code manifest", path: "pstack/.claude-plugin/plugin.json" },
];
