# Use pstack with Codex

The Codex package uses the same hand-maintained skills as Cursor. The source of
truth stays in [`../skills/`](../skills/); the repository generates a filtered,
self-contained install tree at `.agents/plugins/pstack` because the Codex loader
copies an entire marketplace source and has no package ignore mechanism.

The generated package contains supported skills and the runtime contract. It
does not contain Cursor agents, Benny automations, or the existing TypeScript
and shell utilities. Unsupported skills are omitted, and unsupported Poteto
Mode routes are generated as explicit stop pages. Do not edit generated files.

## Install from GitHub

Add this fork as a Git-backed marketplace, then install pstack:

```bash
codex plugin marketplace add florian42/codex-pstack --ref main
codex plugin add pstack@codex-pstack
```

Start a fresh Codex task after installation. Plugin skills are loaded at task
startup, so an existing task is not a reliable installation test.

To use an unpublished local checkout instead, pass its absolute repository path:

```bash
codex plugin marketplace add /absolute/path/to/codex-pstack
codex plugin add pstack@codex-pstack
```

## Refresh an installation

Refresh the Git marketplace snapshot, reinstall pstack, and start a fresh task:

```bash
codex plugin marketplace upgrade codex-pstack
codex plugin add pstack@codex-pstack
```

When developing locally, regenerate the install tree before reinstalling:

```bash
node scripts/generate-codex-pstack.mjs
node scripts/validate-codex-pstack.mjs
codex plugin add pstack@codex-pstack
```

## Validate a change

Run the standalone compatibility validator from the repository root:

```bash
node scripts/validate-codex-pstack.mjs
```

The validator uses Node built-ins only. It checks the source and generated
manifests, manifest version parity, marketplace resolution, generated-tree
freshness and exclusions, skill frontmatter and discoverable names, runtime and
portability records, local links and path references, and reviewed platform-term
exceptions. Failures include a file, line, and reason.

If canonical skills or runtime references changed, regenerate first. CI checks
that the committed distribution is byte-for-byte current.

## Smoke test from a fresh task

First confirm that the configured marketplace exposes the installed plugin:

```bash
codex plugin list --marketplace codex-pstack --available --json
```

Then start a fresh Codex task and record the commit, `codex --version`, Codex
surface, prompt, result, and evidence for each check:

1. Confirm `poteto-mode` and the supported pstack skills are discoverable.
2. Ask Poteto Mode to investigate a small repository question without editing.
3. Ask it to propose and critique a bounded design.
4. Ask it to implement a small change and verify the real result before claiming completion.
5. Ask for one delegated or adversarial review and confirm its findings are synthesized.
6. Confirm Cursor agents, Benny, and utility scripts are absent from the installed cache.
7. Invoke an unsupported route and confirm it stops explicitly instead of reporting success.

For every upstream pstack sync, follow the evergreen [Codex maintenance
contract](https://github.com/florian42/codex-pstack/issues/1): review the pstack
diff, regenerate, validate, reinstall, use a fresh task for the smoke test, and
confirm the existing Cursor package still behaves as before.
