# Upstream sync ledger

This file records selective sync decisions for `florian42/codex-pstack`. It is
content state, not a claim that the fork has the same Git history as
`cursor/plugins`.

## Boundary

| Field | Value |
|---|---|
| Upstream | `https://github.com/cursor/plugins.git` |
| Parent branch | `cursor/plugins:main` |
| Last reviewed upstream commit | `12d587dfb20741cafc376c42c696c5f6e2a64487` |
| Last reviewed on | `2026-09-24` |
| Next observed parent tip | `12d587dfb20741cafc376c42c696c5f6e2a64487` |

## Last selection

The range after `c1c0a32802223f4be824112dd83d33ad29a8b26c` through
`12d587dfb20741cafc376c42c696c5f6e2a64487` was reviewed. Four commits touched
`pstack/`. The fork's prose has diverged, so every hunk was ported by hand.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `70b2dc8b4b85c8d5648624ca40d692c421fff32f` | adapt | Autopilot verification rounds from the code-ready head, merge-prep CI wait, approval countersigns, `children.tsv` stuck checks, patch-id noise rule, quieter plan tick prompt, full-autonomy call rule, swarm SHA and method briefs, `log.sh` append guard, and the instruction cuts. Applied to the fork's Graphite and restack wording because `23a56e2` stays deferred. The Opus 5.5 and Grok 4.7 default swap and the pre-0.15.3 upgrade help are deferred below. |
| `b42effe0aa50f59c693d7e2924714e015e00bf7c` | defer | Rewords the upgrade help that `70b2dc8` added. Belongs to the model-mapping review. |
| `b0b9c7a0baf8b6aa1d00bf77d4101e577d4ba411` | select | All 19 instruction cuts, matched to the fork's wording. |
| `12d587dfb20741cafc376c42c696c5f6e2a64487` | adapt | Force-with-lease publish for owners, owner babysit exception in `babysit.md` and `opening-a-pr.md`, append-only decision-log audit with `start` rows, and the `check-plan.mjs` lane regex. The per-skill `pstack-models.mdc` reading rules moved into the Cursor runtime mapping, because shared skills name runtime roles. The `opening-a-pr.md` wording drops the route to `babysit.md`, which Codex does not support. The `setup-pstack` retired-role drop is deferred because the fork still ships the `how critics` role. |

Version `0.15.5` records the ported content. It does not carry upstream's new
model defaults.

## Earlier selections

The range after `71ed0d1076fec562c1b74ee353121a8d00f75382` through
`c1c0a32802223f4be824112dd83d33ad29a8b26c` was reviewed on `2026-09-15`.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `f8abeddd1862dc73704e3d719dd73df0d51b8c71` | select | The Writing the reply rule that every claim carries its evidence or its label. |
| `f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d` | adapt | Operator-neutral pronouns and the in-chat status tick, on the fork's Graphite wording. |
| `889ec4b68fa5aab0e867dad71ec3fdf386ae48f3` | defer | Listed below. |
| `5bf2b1544db739998121a306340631963c2ff3de` | defer | Listed below. |

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
| `70b2dc8` Opus 5.5 and Grok 4.7 defaults, upgrade help, and interrogate panel trim | defer | Belongs to the `23a56e2` model-mapping review. The Cursor runtime mapping and `setup-pstack` still list the older Fable defaults. |
| `b42effe` upgrade help wording | defer | Depends on the deferred upgrade help. |
| `12d587d` `setup-pstack` retired-role drop | defer | The fork still ships `how critics`, which that change retires. |
| `889ec4b` grok defaults for bug fix, perf, and hillclimb | defer | Belongs to the `23a56e2` model-mapping review. Fork playbooks name the runtime's configured role, and the Cursor-only `setup-pstack` table still predates the Fable 5.1 defaults. |
| `5bf2b15` `setup-pstack` budget ask | defer | Belongs to the `23a56e2` model-mapping review. The skill is unsupported on Codex and Claude Code, and its remap example assumes the Fable 5.1 slugs. |
| `659a636`, `93b00b8` Advisor plugin | skip | Separate Cursor plugin, outside pstack scope. |
| `458dd16` through `7314f72` marketplace and logo changes | skip | Unrelated marketplace plugins and assets. |
| `2b8ae2e` through `256a21a` Grok Voice and third-party MCP plugins | skip | Unrelated marketplace plugins outside `pstack/`. |
| `f712c57` through `86ecc82` X, Google editors, Statsig, Excalidraw, Webull, Robinhood, Coinbase, eToro, finance, and X Money plugins | skip | Unrelated marketplace plugins outside `pstack/`. |
| Remaining prose and structural edits in `e8d856f` | defer | Requires a focused review against fork-specific Codex and Claude wording. |

## Validation from the last selection

- `node scripts/generate-plugin.mjs --target codex`
- `node scripts/generate-plugin.mjs --target claude-code`
- `node scripts/validate-plugin.mjs --all` passed for both targets with 48
  skills and 48 portability records. The first run caught a Codex route to the
  unsupported `babysit.md`, fixed in the source.
- `node --test scripts/test/vocabulary.test.mjs` passed.
- `node --test scripts/test/claude-install-smoke.test.mjs` passed.
