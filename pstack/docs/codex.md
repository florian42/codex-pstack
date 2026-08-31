# Use pstack with Codex

The Codex package uses the same hand-maintained skills as Cursor. The source of
truth stays in [`../skills/`](../skills/); the repository generates a filtered,
self-contained install tree at `.agents/plugins/pstack` because the Codex loader
copies an entire marketplace source and has no package ignore mechanism.

The generated package contains supported skills, the runtime contract, the
three-file Bun runtime required by the Codex Orchestrate profile, and the
`show-me-your-work` logging helper. It registers no Cursor agents or Benny
automations, and excludes other TypeScript and shell utilities. Unsupported
skills are omitted, and unsupported Poteto
Mode routes are generated as explicit stop pages. Do not edit generated files.

## Install from GitHub

Add this fork as a Git-backed marketplace, then install pstack:

```bash
codex plugin marketplace add florian42/codex-pstack --ref main
codex plugin add pstack@codex-pstack
```

To use an unpublished local checkout instead, pass its absolute repository path:

```bash
codex plugin marketplace add /absolute/path/to/codex-pstack
codex plugin add pstack@codex-pstack
```

## Start with Poteto Mode

Follow these steps:

1. Open a repository you want to inspect.
2. Start a fresh Codex task after installation. Plugin skills load when a task
   starts, so an existing task is not a reliable installation test.
3. Invoke `pstack:poteto-mode`.
4. State the goal and a result that Codex can check.

For example:

```text
pstack:poteto-mode investigate how this repository validates changes. Do not edit anything. Show the files, commands, and evidence behind the answer.
```

This prompt uses the supported Investigation playbook. Poteto Mode tracks the
playbook steps, uses the other supported skills when needed, and reports the
evidence behind its conclusion.

## Know the Codex boundary

Codex packages the shared skills that have a supported Codex route. The first
release has these limits:

- Codex does not use `/setup-pstack`. Cursor `.mdc` model rules are ignored.
  Codex uses the task and delegation model controls exposed by the runtime.
- Codex does not register Cursor agents, including `poteto-agent` and Comment
  Sicko, and excludes Benny automations. `no-comments` instead packages an
  inert, byte-identical Comment Sicko reference and delegates one independent,
  scoped comment-only reviewer through the runtime mapping. The parent validates
  that worker's diff before accepting it.
- Codex omits four top-level skills: `automate-me`, `make-bot-ui`, `recall`,
  and `setup-pstack`. The [active skill portability
  record](../references/runtime/skill-portability.md) lists each supported,
  adapted, and omitted skill.
- Poteto Mode stops before entering `autonomous-run`, `autopilot-full`,
  `autopilot-stack`, `babysit`, `eval`, `multi-phase-plan`,
  `session-pickup`, `shipping`, or `worktree-cleanup`. It does not substitute a
  weaker workflow or report success.
- Orchestrate supports a local-session profile with Bun, durable SQLite state,
  explicit worktrees, exact commit evidence, and one integration writer. It
  does not claim cloud workers, transcript recovery, or unattended continuation.

## Maintain the Codex package

The remaining commands are for maintainers who refresh, generate, validate, or
smoke-test the Codex package.

### Refresh an installation

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

### Generate and validate a change

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

### Smoke test from a fresh task

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
5. Run `pstack:no-comments` on a small fixture with a removable narration
   comment and a protected public API doc comment. Confirm a fresh independent
   reviewer makes only the scoped comment edit, returns its report and diff,
   and the parent validates that diff before accepting it.
6. Confirm Cursor agents, Benny, and unlisted utility scripts are absent from the installed cache.
7. Invoke an unsupported route and confirm it stops explicitly instead of reporting success.

For every upstream pstack sync, follow the evergreen [Codex maintenance
contract](https://github.com/florian42/codex-pstack/issues/1): review the pstack
diff, regenerate, validate, reinstall, use a fresh task for the smoke test, and
confirm the existing Cursor package still behaves as before.
