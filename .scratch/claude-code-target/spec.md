# Spec: pstack for Claude Code

Status: implemented on this branch; see issues/ for per-ticket acceptance
Branch: claude/codex-plugin-exploration-pnz7wn
Related: pstack/docs/codex.md, pstack/references/runtime/contract.md, GitHub issue #1 (Codex maintenance contract)

## Problem Statement

pstack is packaged for Cursor (canonical tree, consumed directly) and for Codex (a
generated, filtered distribution under `.agents/plugins/pstack`). A Claude Code user
cannot install pstack today. When the canonical skills are loaded into Claude Code by
hand, `poteto-mode` correctly detects that no runtime mapping exists for the host and
falls back to filesystem-only work, so delegation, plan tracking, policy review, and
orchestration never run. The value of pstack on Claude Code is therefore gated on the
runtime contract, not on packaging.

The build tooling that produces the Codex distribution is single-target. Its
platform-term scan bans vocabulary that is legitimate on Claude Code (`Task`,
`subagent_type`, `run_in_background`, `/loop`, `claude-*` model slugs), its manifest
checks are hand-rolled for Codex, and its portability table has one classification
column. Adding Claude Code by copying the Codex scripts would create a second editable
copy of the build logic and violate the repository's one-canonical-source rule.

## Solution

Add Claude Code as a third runtime target of the same canonical skill tree.

- A user runs `claude plugin marketplace add florian42/codex-pstack` and
  `claude plugin install pstack@<marketplace>`, starts a fresh session, and invokes
  `/pstack:poteto-mode`. Poteto Mode reads the Claude Code runtime mapping, delegates
  through the Agent tool, tracks a plan, and stops explicitly on unsupported routes.
- `comment-sicko` and `poteto-agent` are registered as native plugin agents, so
  `no-comments` delegates to the exact independent reviewer and `/poteto-mode` has a
  resumable routing target, both of which the Codex target lacks.
- Orchestrate runs on Claude Code through the existing Bun runtime with a superset
  profile that allows concurrent worktree-isolated code units.
- The generator and validator become one multi-target tool driven by per-target build
  configs. Producing the Claude Code distribution must not change one byte of the
  committed Codex distribution.
- Verification is layered: static checks and install resolution gate every pull
  request; headless behavior smoke tests run nightly and on labeled pull requests; a
  manual fresh-session checklist runs per release and per upstream sync.

## User Stories

1. As a Claude Code user, I want to add this repository as a plugin marketplace, so that I can install pstack without cloning or copying files by hand.
2. As a Claude Code user, I want `/pstack:poteto-mode` to be invocable in a fresh session, so that the entry point works the same way it does on Cursor and Codex.
3. As a Claude Code user, I want Poteto Mode to find a Claude Code runtime mapping, so that it delegates, tracks a plan, and monitors work instead of falling back to filesystem-only mode.
4. As a Claude Code user, I want unsupported playbooks to stop with an explicit page naming the missing capability, so that I never receive a simulated success.
5. As a Claude Code user, I want the four skills with no Claude Code route omitted from the installed plugin, so that I am not offered `setup-pstack`, `make-bot-ui`, `recall`, or `automate-me` when they cannot work.
6. As a Claude Code user, I want `/pstack:no-comments` to delegate to a registered `comment-sicko` agent, so that the policy review is performed by the exact independent reviewer the canonical policy describes.
7. As a Claude Code user, I want the `comment-sicko` agent restricted to read tools, so that a plugin-shipped reviewer cannot edit application code even though plugin agents ignore permission modes.
8. As a Claude Code user, I want `poteto-agent` registered as a plugin agent, so that `/poteto-mode` has a resumable routing target rather than a sibling spawn.
9. As a Claude Code user, I want Orchestrate to run with the Bun runtime, so that a standing multi-unit program has durable SQLite state and exact commit evidence on Claude Code.
10. As a Claude Code user, I want Orchestrate on Claude Code to dispatch several code units concurrently in isolated worktrees, so that I benefit from Claude Code's native worktree isolation rather than inheriting the Codex one-at-a-time limit.
11. As a Claude Code user, I want `autonomous-run` supported, so that a long task can be driven to a checkable predicate with `/loop`.
12. As a Claude Code user, I want `babysit`, `worktree-cleanup`, and `multi-phase-plan` supported once their script dependencies are packageable, so that Claude Code gains the autonomy routes Codex lacks.
13. As a Claude Code user, I want the plan-tracking mapping to fall back to a prose checklist when the task tools are absent, so that the planning requirement survives model configurations that exclude those tools.
14. As a Claude Code user, I want the mapping to forbid reading session transcripts from the private JSONL directory, so that pstack never depends on an undocumented, version-unstable format.
15. As a Claude Code user, I want the mapping to name the exact model roles Claude Code exposes, so that Cursor model slugs and rules files are ignored rather than guessed at.
16. As a Claude Code user, I want a Claude Code guide mirroring the Codex guide, so that install, first use, boundary, maintenance, and smoke steps are documented in one place.
17. As a Claude Code user, I want the plugin to pass `claude plugin validate --strict`, so that the installed manifest and every skill and agent are structurally sound on the current CLI.
18. As a Cursor user, I want the Cursor package to behave exactly as before, so that adding a third target costs me nothing.
19. As a Codex user, I want the committed Codex distribution to be byte-identical after the build tooling is generalized, so that the refactor is provably behavior-preserving.
20. As a maintainer, I want one generator and one validator parameterized by target, so that a fix to the build applies to Codex and Claude Code at once.
21. As a maintainer, I want a single shared portability parser, so that a row the validator accepts can never be dropped silently by the generator.
22. As a maintainer, I want the portability table to carry one column per target, so that an upstream skill addition fails validation once per target until it is classified.
23. As a maintainer, I want the platform-term scan to be vocabulary-based and per-target, so that Claude Code vocabulary is legitimate on Claude Code and banned on Codex, and vice versa.
24. As a maintainer, I want each runtime mapping to own its own unsupported-route list, so that the canonical Poteto Mode skill no longer states the Codex list as fact to Cursor and Claude Code users.
25. As a maintainer, I want JSON schemas for the Codex and Claude Code manifests and for the build config, so that manifest checks are declarative and shared across targets.
26. As a maintainer, I want an N-way version parity check with the Cursor manifest as reference, so that an upstream version bump fails loudly until every manifest matches.
27. As a maintainer, I want a single command that sets the version across all manifests, so that a release bump is one step.
28. As a maintainer, I want the marketplace entry to omit `version`, so that there is no fourth copy of the version to keep in sync.
29. As a maintainer, I want generator freshness enforced for every target in CI, so that a stale generated tree cannot merge.
30. As a maintainer, I want a hermetic install-resolution smoke test gating pull requests, so that marketplace add, install, and component inventory are proven end to end without a model call.
31. As a maintainer, I want the install smoke to assert that the four omitted skills are absent, so that filtering is proven rather than assumed.
32. As a maintainer, I want headless behavior smoke tests asserting on the tool-call stream, so that unsupported-route stops and Comment Sicko delegation are verified by observed tool calls rather than prose.
33. As a maintainer, I want behavior smoke tests off the pull-request gate and on a nightly schedule and a label, so that model nondeterminism never blocks unrelated merges.
34. As a maintainer, I want `claude plugin eval` suites checked in but optional, so that the suite runs wherever early access is enabled without failing where it is not.
35. As a maintainer, I want the Orchestrate runtime entry file renamed to a target-neutral name, so that the Codex-exclusive vocabulary scan does not fire on the Claude Code profile.
36. As a maintainer, I want the canonical skill edits kept to single replaced paragraphs, so that the next upstream merge produces small, obvious conflicts.
37. As a maintainer, I want the Codex maintenance contract extended with the Claude Code steps, so that every upstream sync regenerates and validates both distributions.
38. As a maintainer, I want the `watch-pr` utility free of runtime dependency installation, so that it can be packaged into a read-only plugin cache.
39. As a maintainer, I want the worktree audit script to take its transcript root as a parameter, so that the audit runs on hosts without Cursor transcript directories.
40. As a reviewer, I want a generated tree change to be reviewable through its build config and content hash, so that a large generated diff does not need line-by-line reading.
41. As a reviewer, I want the Claude Code runtime mapping landed as a documentation-only change before any generated tree, so that the support matrix is argued on its merits.

## Implementation Decisions

**Distribution shape.** Claude Code gets a generated, filtered, committed distribution, not a direct pointer at the canonical tree. Claude Code clones the whole marketplace repository and has no ignore mechanism, the same constraint that produced the Codex distribution. Filtering is required for the four unsupported skills, the stop pages, and the script tree, which contains a dependency installer and Cursor-specific paths. The generated tree lives under a top-level `plugins/claude-code/` directory beside a per-target build config. `dist/` and `build/` are excluded by the repository gitignore and must not be used.

**Marketplace and manifest.** The Claude Code marketplace file lives at the repository root in the `.claude-plugin` directory, the only location Claude Code accepts. Its single entry points at the generated tree by relative path and omits `version`. The Claude Code plugin manifest is hand-written beside the Cursor and Codex manifests in the canonical `pstack` directory and copied byte-for-byte into the distribution. It omits the `agents` field and relies on the default `agents/` directory; verified on the current CLI, the array form registers agents in-session but reports zero in the component inventory, and the directory-string form fails validation.

**Agents.** `comment-sicko` and `poteto-agent` are copied from the canonical agents directory into the distribution's `agents/` directory. The generator normalizes the agent `name` frontmatter to the lowercase-hyphenated filename for this target only; the canonical file keeps `Comment Sicko` because Cursor dispatches by that display name. The generator injects a read-only tool allowlist into the generated `comment-sicko` frontmatter, because plugin agents ignore `permissionMode`, `hooks`, and `mcpServers`. The Codex-only inert reference copy is not produced for this target.

**Skill frontmatter.** The generator applies the same single transform it applies for Codex: the frontmatter `name` becomes the directory slug. Cursor-only keys (`mode`, `reminder`, `icon`, `color`) are copied verbatim; strict validation on the current CLI accepts them. Key filtering is not introduced, so the Codex distribution stays byte-identical through the refactor.

**Runtime contract.** A Claude Code mapping is added with one row per contract capability: delegation through the Agent tool with `subagent_type`, background execution, and worktree isolation; policy review through the registered `comment-sicko` agent, with any spawn or wait failure reported as `blocked`; blocking questions through the user-question tool, which is unavailable to subagents; plan tracking through the task tools with a prose-checklist fallback because those tools are excluded by default on current models; skill authoring through the installed skill-creator skill and the project or personal skills directories; conversation resolution restricted to visible context, with the private JSONL transcript directory forbidden; monitoring through background-agent completion and the monitor primitive; scheduling through `/loop`; model roles restricted to aliases the install exposes, with Cursor slugs ignored; browser verification through a repository-owned harness or an installed browser-control server, with the Chrome integration noted as plan-gated. The contract's mapping index gains the Claude Code link. Agent teams are classified unsupported for the first release.

**Unsupported-route ownership.** The canonical Poteto Mode skill stops hardcoding the Codex unsupported-route list. One paragraph is replaced with a rule that the current runtime mapping owns the list. Each mapping file carries its own list: none for Cursor, nine for Codex, and for Claude Code `autopilot-full`, `autopilot-stack`, `shipping`, `eval`, and `session-pickup`. Those five reduce to two missing dependencies, Graphite and an authorized transcript source, and the guide says so. `autonomous-run` is supported in the first release. `babysit`, `worktree-cleanup`, and `multi-phase-plan` are supported once the prefactors below land; until then they are stop pages.

**Orchestrate.** The Codex Bun runtime is reused unchanged except for renaming its entry file to a target-neutral name. A Claude Code profile document is written as a delta over the shared safety model: concurrent code units, one per isolated worktree; a `/loop` wake cadence for a coordinator tick; everything else identical, including fast-forward-only integration, one integration writer, full-SHA evidence, and interrupted-dispatch recovery. Shared paragraphs move into the design document.

**Build tooling.** The generator and validator are split into a shared core and two thin per-target entry points selected by a target flag. The shared core owns portability parsing, frontmatter parsing, file-map building, stop-page rendering, comparison, vocabulary resolution, and manifest parity. The existing Codex script names remain as shims for one release. The per-target build config gains the fields: target name, manifest source and destination, output root, marketplace path and expected source pointer, portability column, runtime mapping path, stop-page title and mapping link, banned vocabularies, copied trees, copied files with optional name normalization and frontmatter injection, copied skill resources, unsupported resources, runtime resources, forbidden generated directories, required skills, and required agents. The Codex config is migrated to the same shape.

**Vocabulary scan.** Regular expressions live in the shared core as named vocabularies: cursor-exclusive, codex-exclusive, claude-exclusive, and cursor-shared-with-claude. A target config names the vocabularies it bans. The Codex target bans cursor-exclusive, cursor-shared-with-claude, and claude-exclusive. The Claude Code target bans cursor-exclusive and codex-exclusive. The hardcoded ban of delegation vocabulary in the generated `no-comments` skill is removed because the per-target scan subsumes it.

**Portability record.** The single portability table gains one classification column per target, and the parser locates a target's column by header. Per-target unsupported-route subsections replace the single Codex section. A separate per-target table is rejected because it would drift on the next upstream skill addition.

**Schemas and versions.** JSON schemas are added for the Codex manifest, the Claude Code manifest, the Claude Code marketplace, and the build config, in the style of the existing Cursor schemas. The Cursor-side validator iterates a table of targets. Version parity becomes N-way with the Cursor manifest as the reference. A set-version script rewrites every manifest preserving each file's indentation.

**Prefactors.** The `watch-pr` command-line entry replaces its third-party argument parser with the standard library parser and drops the dependency installer, so the utility becomes a closed set of packageable files. The worktree audit script takes its transcript root as an optional parameter and skips the chat-scan bucket when none is given.

**CI.** The workflow gains path filters for the new directories, a schedule trigger, an install-resolution job that gates pull requests, and a behavior-smoke job that runs on schedule or on a `claude-smoke` label with an API key secret and cancel-in-progress concurrency.

## Testing Decisions

**What makes a good test here.** A test observes an external boundary and asserts on its output: a process exit code and message, a file listing of a generated tree, a component inventory printed by the Claude Code CLI, or a tool call observed in a headless session's stream. Tests never inspect generator internals or parse a skill's prose for intent.

**Seams, highest first.**

1. The validator command line. Every static guarantee is asserted by running the validator for a target and checking its exit code and `path:line: message` output. The validator already wraps the generator's check mode and will wrap `claude plugin validate --strict` when the CLI is present. This is the existing CI seam and the primary seam for this work.
2. The Claude Code CLI boundary. Install resolution is asserted by running marketplace add, install, and component inventory under a scratch config directory and checking the printed skill and agent lists. Behavior is asserted by running headless sessions with the plugin directory loaded and checking the tool-call stream and the working tree afterward.

No new seam is introduced. The generator is never tested directly; its correctness is proven by the validator's freshness check and by the zero-diff gate on the Codex tree.

**Prior art.** The Codex validator's check groups, its spawn of the generator in check mode, and the manual smoke checklist in the Codex guide. The Bun test files beside the Orchestrate runtime for any runtime change.

**Layers and gating.**

- Static, gates every pull request: schema validation, generator check for every target, term, link, frontmatter, name, and portability checks, strict CLI validation guarded by CLI presence.
- Install resolution, gates every pull request: hermetic marketplace add and install, inventory equals the generated tree's skill count plus two agents, the four omitted skills absent.
- Behavior, nightly and labeled pull requests: discovery lists the expected skills; a read-only investigation leaves the tree clean and creates a plan; an unsupported route prints the stop page and issues no merge or push call; `no-comments` spawns `comment-sicko`, removes the narration comment, and preserves the public-API doc comment; Orchestrate init creates the SQLite store. Bare mode requires an API key; OAuth tokens are not read in bare mode.
- Optional: `claude plugin eval` suites, skipped where early access is not enabled.
- Manual, per release and upstream sync: the fresh-session checklist in the Claude Code guide.

**Refactor safety.** Every tooling ticket that precedes the Claude Code target must leave the committed Codex distribution byte-identical, checked by a clean diff of that directory.

## Out of Scope

- Supporting `shipping`, `autopilot-full`, or `autopilot-stack` on Claude Code; they depend on Graphite.
- Supporting `eval`, `session-pickup`, `recall`, or `automate-me`; they depend on an authorized transcript source. The hook-provided transcript path is the candidate for a later release.
- `setup-pstack` and `make-bot-ui`; no Claude Code route exists.
- Agent teams; experimental, off by default, and unavailable headless.
- Emulating Cursor's sticky-mode reminder through a prompt-submit hook; a later release.
- Generating the three manifests from a shared template.
- Changing Cursor behavior or the Cursor marketplace file.
- Benny automations.

## Further Notes

- Verified on the current CLI in this environment: the canonical tree wrapped in a minimal manifest passes strict validation; the two agents register from the default directory; `/pstack:poteto-mode` invoked headlessly detects the missing mapping and falls back correctly; `claude plugin eval` is gated by early access; the validate subcommand offers `--strict` but not `--json`.
- The Claude Code marketplace name must not collide with reserved names; a name such as `pstack-claude` is acceptable.
- Only two tickets touch upstream-owned canonical files: the route-list move and the `watch-pr` prefactor. Both are recorded in the maintenance contract.
