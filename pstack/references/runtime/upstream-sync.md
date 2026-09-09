# Upstream sync ledger

This file records selective sync decisions for `florian42/codex-pstack`. It is
content state, not a claim that the fork has the same Git history as
`cursor/plugins`.

## Boundary

| Field | Value |
|---|---|
| Upstream | `https://github.com/cursor/plugins.git` |
| Parent branch | `cursor/plugins:main` |
| Last reviewed upstream commit | `71ed0d1076fec562c1b74ee353121a8d00f75382` |
| Last reviewed on | `2026-09-08` |
| Next observed parent tip | `2b8ae2ee306f823d54879d3da7f8496b73c31d5d` |

## Last selection

The range through `71ed0d1076fec562c1b74ee353121a8d00f75382` was reviewed.

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
| `659a636`, `93b00b8` Advisor plugin | skip | Separate Cursor plugin, outside pstack scope. |
| `458dd16` through `7314f72` marketplace and logo changes | skip | Unrelated marketplace plugins and assets. |
| Remaining prose and structural edits in `e8d856f` | defer | Requires a focused review against fork-specific Codex and Claude wording. |

## Validation from the last selection

- `node scripts/generate-plugin.mjs --target codex`
- `node scripts/generate-plugin.mjs --target claude-code`
- `node scripts/validate-plugin.mjs --all`
- Focused Codex Orchestrate tests passed.
- Claude install smoke passed on the updated target.
