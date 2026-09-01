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
