# Upstream sync ledger

This file records selective sync decisions for `florian42/codex-pstack`. It is
content state, not a claim that the fork has the same Git history as
`cursor/plugins`.

## Boundary

| Field | Value |
|---|---|
| Upstream | `https://github.com/cursor/plugins.git` |
| Parent branch | `cursor/plugins:main` |
| Last reviewed upstream commit | `c1c0a32802223f4be824112dd83d33ad29a8b26c` |
| Last reviewed on | `2026-09-15` |
| Next observed parent tip | `c1c0a32802223f4be824112dd83d33ad29a8b26c` |

## Last selection

The range after `71ed0d1076fec562c1b74ee353121a8d00f75382` through
`c1c0a32802223f4be824112dd83d33ad29a8b26c` was reviewed. Four commits touched
`pstack/`.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `f8abeddd1862dc73704e3d719dd73df0d51b8c71` | select | The Writing the reply rule that every claim carries its evidence or its label. |
| `f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d` | adapt | Operator-neutral pronouns and the in-chat status tick. Applied to the fork's Graphite wording because `23a56e2` stays deferred. |
| `889ec4b68fa5aab0e867dad71ec3fdf386ae48f3` | defer | Listed below. |
| `5bf2b1544db739998121a306340631963c2ff3de` | defer | Listed below. |

Version `0.15.2` matches upstream after the two ported commits. Upstream reverted
its `0.15.3` bump inside `889ec4b`.

## Earlier selections

The range through `71ed0d1076fec562c1b74ee353121a8d00f75382` was reviewed on
`2026-09-08`.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `73f8be4873ea4ba2b7378243a036d3360c69e04d` | select | Invocation safety metadata for five skills. |
| `e8d856f0273b42ebafe0ec3546bd645709e7c1b0` | adapt | Two new principles were ported. The upstream density and critique-mode edits remain excluded below. |
| `d7cde2b84eadbcd6fd890302c876f4436ccb6d82` | skip | Punctuation-only prose sweep. Fork-specific wording takes precedence where it overlaps. |
| `71ed0d1076fec562c1b74ee353121a8d00f75382` | select | Version `0.15.0` and corrected principle/playbook counts. |

## Explicitly skipped or deferred

| Upstream commit or area | Decision | Reason |
|---|---|---|
| `23a56e2` forge-neutral playbooks and Fable defaults | defer | Needs a separate runtime and model-mapping review. |
| `889ec4b` grok defaults for bug fix, perf, and hillclimb | defer | Belongs to the `23a56e2` model-mapping review. Fork playbooks name the runtime's configured role, and the Cursor-only `setup-pstack` table still predates the Fable 5.1 defaults. |
| `5bf2b15` `setup-pstack` budget ask | defer | Belongs to the `23a56e2` model-mapping review. The skill is unsupported on Codex and Claude Code, and its remap example assumes the Fable 5.1 slugs. |
| `659a636`, `93b00b8` Advisor plugin | skip | Separate Cursor plugin, outside pstack scope. |
| `458dd16` through `7314f72` marketplace and logo changes | skip | Unrelated marketplace plugins and assets. |
| `2b8ae2e` through `256a21a` Grok Voice and third-party MCP plugins | skip | Unrelated marketplace plugins outside `pstack/`. |
| Remaining prose and structural edits in `e8d856f` | defer | Requires a focused review against fork-specific Codex and Claude wording. |

## Validation from the last selection

- `node scripts/generate-plugin.mjs --target codex`
- `node scripts/generate-plugin.mjs --target claude-code`
- `node scripts/validate-plugin.mjs --all` passed for both targets with 48
  skills and 48 portability records. On Windows the validator's generated-skill
  walk filters on `/SKILL.md` and misses backslash paths, so the run used a copy
  that normalizes separators first. POSIX runs are inferred to be unaffected
  because `walkFiles` builds paths with `resolve()`.
- `node --test scripts/test/vocabulary.test.mjs` passed.
- Target smoke tests were not rerun. No runtime mapping or generated inventory
  changed.
