# Use pstack with Claude Code

The Claude Code package uses the same hand-maintained skills as Cursor and
Codex. The source of truth stays in [`../skills/`](../skills/); the repository
generates a filtered, self-contained install tree at
`plugins/claude-code/pstack` because Claude Code clones an entire marketplace
repository and has no package ignore mechanism.

The generated package contains supported skills, the runtime contract, the
`comment-sicko` and `poteto-agent` plugin agents, the three-file Bun runtime
required by the Orchestrate profile, and the `show-me-your-work` logging
helper. It excludes Benny automations, dependency installers, tests, and other
TypeScript and shell utilities. Unsupported skills are omitted, and unsupported
Poteto Mode routes are generated as explicit stop pages. Do not edit generated
files.

## Install from GitHub

Add this repository as a marketplace, then install pstack:

```bash
claude plugin marketplace add florian42/codex-pstack
claude plugin install pstack@pstack-claude
```

To use an unpublished local checkout instead, pass its absolute repository path:

```bash
claude plugin marketplace add /absolute/path/to/codex-pstack
claude plugin install pstack@pstack-claude
```

To try a checkout without installing, load the generated tree for one session:

```bash
claude --plugin-dir /absolute/path/to/codex-pstack/plugins/claude-code/pstack
```

## Start with Poteto Mode

Follow these steps:

1. Open a repository you want to inspect.
2. Start a fresh Claude Code session after installation. Plugin skills load when
   a session starts, so an existing session is not a reliable installation test.
3. Invoke `/pstack:poteto-mode`.
4. State the goal and a result that Claude Code can check.

For example:

```text
/pstack:poteto-mode investigate how this repository validates changes. Do not edit anything. Show the files, commands, and evidence behind the answer.
```

This prompt uses the supported Investigation playbook. Poteto Mode reads the
[Claude Code runtime mapping](../references/runtime/claude-code.md), tracks the
playbook steps, delegates through the `Agent` tool, and reports the evidence
behind its conclusion.

Most pstack skills are user-invoked only. Claude Code lists them as
`/pstack:<name>` slash commands rather than offering them to the model, which
matches their Cursor behavior.

## Know the Claude Code boundary

Claude Code packages the shared skills that have a supported route. The first
release has these limits:

- Claude Code does not use `/setup-pstack`. Cursor `.mdc` model rules are
  ignored. Model roles use the aliases the install exposes, and the parent
  session's model is the default.
- Claude Code omits four top-level skills: `automate-me`, `make-bot-ui`,
  `recall`, and `setup-pstack`. The [active skill portability
  record](../references/runtime/skill-portability.md) lists each supported,
  adapted, and omitted skill.
- Poteto Mode stops before entering `autopilot-full`, `autopilot-stack`,
  `shipping`, `eval`, or `session-pickup`, and those five are the only
  unsupported routes. The first three depend on Graphite stack delivery; the
  last two depend on an authorized transcript source. It does not substitute a
  weaker workflow or report success.
- `babysit`, `worktree-cleanup`, and `multi-phase-plan` are supported. Babysit
  runs the packaged `watch-pr` utility and rearms it under `/loop`;
  worktree-cleanup runs the packaged worktree audit script, whose
  `--transcripts` argument is optional; multi-phase-plan runs the packaged plan
  checker.
- `no-comments` delegates to the registered `pstack:comment-sicko` agent, which
  is restricted to read tools. The parent applies accepted comment-only edits
  and validates the scope.
- Orchestrate supports the `claude-local-session` profile with Bun, durable
  SQLite state, worktree-isolated concurrent code units, exact commit evidence,
  and one integration writer. It does not claim unattended continuation or
  transcript recovery.
- Plan tracking falls back to a prose checklist when the session's task tools
  are absent.

## Maintain the Claude Code package

The remaining commands are for maintainers who refresh, generate, validate, or
smoke-test the Claude Code package.

### Refresh an installation

Refresh the marketplace snapshot, update pstack, and start a fresh session:

```bash
claude plugin marketplace update pstack-claude
claude plugin update pstack
```

When developing locally, regenerate the install tree before reinstalling:

```bash
node scripts/generate-plugin.mjs --target claude-code
node scripts/validate-plugin.mjs --target claude-code
```

### Generate and validate a change

Run the validator for every target from the repository root:

```bash
node scripts/validate-plugin.mjs --all
```

The validator uses Node built-ins only. It checks the source and generated
manifests, manifest version parity across the Cursor, Codex, and Claude Code
manifests, marketplace resolution, generated-tree freshness and exclusions,
skill frontmatter and discoverable names, agent names, runtime and portability
records, local links and path references, and the per-target vocabulary scan.
Failures include a file, line, and reason. When the Claude Code CLI is
installed, the validator also runs `claude plugin validate --strict` on the
generated tree and the marketplace.

If canonical skills or runtime references changed, regenerate first. CI checks
that every committed distribution is byte-for-byte current.

### Smoke test from a fresh session

First confirm that the generated tree loads and reports the expected inventory:

```bash
claude --plugin-dir "$PWD/plugins/claude-code/pstack" plugin details pstack
```

Expect the supported skill list and exactly two agents, `comment-sicko` and
`poteto-agent`. Then start a fresh session and record the commit,
`claude --version`, surface, prompt, result, and evidence for each check:

1. Confirm `/pstack:poteto-mode` and the supported pstack skills are
   discoverable as slash commands.
2. Ask Poteto Mode to investigate a small repository question without editing.
   Confirm it names the Claude Code mapping and delegates through `Agent`.
3. Ask it to propose and critique a bounded design.
4. Ask it to implement a small change and verify the real result before
   claiming completion.
5. Run `/pstack:no-comments` on a small fixture with a removable narration
   comment and a protected public API doc comment. Confirm the
   `pstack:comment-sicko` agent is spawned, only the narration comment is
   removed, and the parent validates the scope.
6. Confirm the four omitted skills, Benny, tests, and dependency installers are
   absent from the installed cache.
7. Invoke an unsupported route and confirm it stops explicitly instead of
   reporting success.
8. Ask Poteto Mode to babysit a pull request and confirm it runs the packaged
   `watch-pr` launcher from the installed plugin without installing
   dependencies.

### Canonical files this fork edits

Upstream syncs conflict where the fork rewords canonical files. The fork keeps
each edit to a single phrase or a small script change. Files edited for the
Claude Code target: `skills/poteto-mode/SKILL.md` (runtime-owned route list),
`skills/poteto-mode/playbooks/autonomous-run.md`, `babysit.md`,
`multi-phase-plan.md`, `orchestrate.md`, and `worktree-cleanup.md`
(runtime-neutral wording and a transcript-source safety gate),
`agents/poteto-agent.md` (one phrase), `skills/poteto-mode/scripts/watch-pr/`
(dependency-free argument parsing), `scripts/worktree-audit.sh` (transcript
root parameter and portable `stat`), and `scripts/orch/` (renamed entry file
and the `claude-local-session` profile).

For every upstream pstack sync, follow the evergreen [maintenance
contract](https://github.com/florian42/codex-pstack/issues/1): review the pstack
diff, regenerate and validate every target, reinstall, use a fresh session for
the smoke test, and confirm the Cursor and Codex packages still behave as
before.
