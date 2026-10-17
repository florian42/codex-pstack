# Upstream sync ledger

This file records selective sync decisions for `florian42/codex-pstack`. It is
content state, not a claim that the fork has the same Git history as
`cursor/plugins`.

## Boundary

| Field | Value |
|---|---|
| Upstream | `https://github.com/cursor/plugins.git` |
| Parent branch | `cursor/plugins:main` |
| Last reviewed upstream commit | `101b274dd991f694e1f7024be2157e5f3adf07de` |
| Last reviewed on | `2026-10-17` |
| Next observed parent tip | `101b274dd991f694e1f7024be2157e5f3adf07de` |

## Last selection

The range after `12d587dfb20741cafc376c42c696c5f6e2a64487` through
`101b274dd991f694e1f7024be2157e5f3adf07de` was reviewed on `2026-10-17`. Forty-one commits touched
`pstack/`. Each changed file was merged three ways (fork, upstream at
`12d587d`, upstream tip) and every conflict was resolved by hand. Where
upstream's later edits were built on its `e8d856f` density pass, `why`,
`reflect`, and the touched principles now take that pass too, with the fork's
runtime layer and its own rules kept on top. `architect`, `arena`,
`figure-it-out`, `how`, and `unslop` keep their remaining `e8d856f` text,
listed below.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `23e4138daa01c42d4969f7a5465f82704e64f798` | adapt | New `principle-explain-the-number` and `benchmark-checklist` skills, wired into poteto-mode, perf-issue, and hillclimb. Fresh subagents by default, plain-words alternatives in place of a reply token, swarm worker respawn, push after every verifiable unit, `##` PR body headings, the built-in PR tool rule, the schema-first Zod example, and the technical-writing cut. The hourly autopilot tick is a recurring wake through the runtime mapping; the Cursor mapping names `/loop 1h`. `/goal` is dropped. The slug defaults in the Subagents section stay deferred. |
| `9511e60321f7e533a187d62854a3d53a53752874` | select | New `correct` skill, portable on every target. |
| `a58628271271837ef5f386adca29c0812683a19a` | select | Architect's agent-contributor screen and four new design red flags. |
| `e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a` | select | Bare performance mantras in perf-issue and hillclimb. |
| `4e5b1cf2ccb0ea3716f08c8ee0a5856b5ab93536` | adapt | New `poteto-help` skill. It documents the Cursor install, Custom Modes, and `setup-pstack`, so it is `adapted` on Cursor and `unsupported` on Codex and Claude Code, with a runtime gate that points to each runtime's own guide. |
| `00b52d954a99ff67802cad428ff19218659f76fd` | select | `poteto-help` is typed-only. |
| `807c031086fcf71c88c863b4a4e6938b6785c58f` | select | `poteto-help` prompting and recipe references. |
| `2cbf58508f40de470d7490b55c51d71241928fa2` | adapt | Cursor guide refresh. Pages that state the new model defaults or the reasoning budget keep the fork's defaults. |
| `1e56b2913469f05101e4ffd4d437c2e6fd2c1b8d` | select | `poteto-help` asks about `setup-pstack` when no model rule exists. |
| `df581122cde17e6e27686b5a448bde23e4ad4318` | defer | Drops Sol and moves defaults to Opus 5.5 xhigh and Grok. Belongs to the model-mapping review below. |
| `00b14f1df36b32a8dd1529324a3a459f6563b127` | adapt | Prompt distillation across 36 files, ported with the fork's capability wording. Model slugs and panel sizes stay in the runtime mappings. |
| `978ca6e9c0e012047cd5058b8e829240336e704e` | adapt | New `ketchup` skill. Its `/visualize` charts route through a new "Render a visual" capability in the contract and in every runtime mapping, so it is `adapted` on every target. |
| `ea32d9562a1c9f077d7cdd3be53d07383eb18866` | select | `ketchup` before-and-after visuals. |
| `08bd59b37834550f5e8fa0bb5e8852204a7534cf` | select | Section cuts in `how`, poteto-mode, `why`, and four principles. |
| `de2dba6ffa001bc3c97acf1f58bc7ab29d5fdc7a` | adapt | The Comment Sicko agent id is `comment-sicko`. The Cursor mapping dispatches that id; the Claude Code build's rename is now a no-op. |
| `87c810326a9a1dc727651b7d9bbfc5a116d68582` | select | `check-plan.mjs` skips fenced code blocks, with its new test. |
| `ff8f83da30af53de945acd0e1dc10a7b21a3187f` | select | `watch-pr` paginates review threads. |
| `bc697d0a5a163cec979e362b601e36f5616083fd` | select | `unslop` description drops "Must always apply." |
| `cf9a111eaf1eda5724abb607ef4c446ced843d65` | adapt | `worktree-audit.sh` default-branch detection, `-b`/`--base`, and `-h`/`--help`, merged with the fork's `--transcripts` option. |
| `2bd5dd4f22ef958435082c417c027079f8f4ddb7` | adapt | The chat that receives Poteto Mode runs the playbook; `poteto-agent` is a delegate. Written neutrally for the Claude Code agent copy. |
| `e5a02f8fb0409c2db7eb06eae9078b235a2b5009` | select | Agent Plugins `pstack/plugin.json`. It joins the version-parity manifest list. |
| `c49b37a2c0e7bede60a71ad7322e3f12c337a3da` | select | `create-verification-skill` readiness means the app is usable. |
| `364a77eb358f16292410a7295fd8d103fb7dd40e` | adapt | Leaf skills live at `../<name>/SKILL.md`, and every delegate brief carries poteto-mode's absolute path. |
| `b93e8117880f695bc49ef7b1ef72c09bfcc7c1de` | adapt | `poteto-agent` finds poteto-mode in the runtime's installed-plugin directory, named in the Cursor and Claude Code skill rows. Poteto-mode drops its `mode` and `reminder` keys, which no generator or mapping reads. |
| `7d8d9091e59a1fe9600bb317a1b7f69a31daa349` | select | New `in-your-own-words` skill, portable. |
| `d00ba6ee9b26ff3bb084b8a5051ff6436860cbdf` | select | Shorter `ketchup` replies built on real visuals. |
| `36cecbf2b5089b275254d59cb4612d6f96f00fbd` | select | `fix-root-causes` proposes a cheap always-on signal. |
| `dbf49813a39c1a5389c5e28cb8e4c1c2379e2454` | select | `in-your-own-words` rewording. |
| `c86f349b102feb91f1966f8a6a60882a4e601b50` | select | `ketchup` in `bro`'s voice. |
| `ce649c03ac3b75b6ae80cbd15b7e2c536caedb5a` | adapt | The Match the model to the job rule, written neutrally in poteto-mode with per-runtime mechanics in each mapping, and pointers from every routed skill. One full swarm per multi-phase PR, the store and `watch-pr` changes, and the playbook cuts. Shipping, Autopilot-full, and Autopilot-stack take only the forge-independent reasons, because their gh and Origin steps belong to the deferred `23a56e2`. The composer and `cursor-grok` family fallback is deferred with the model defaults. |
| `8043881e5cbb962f8948d1a1f8f8e28089d67c9a` | select | Autopilot loops catch the operator up with `ketchup`. |
| `79afd75d5bd51383fbb526b72f36db03180b8301` | select | New `sharpen` skill, portable. |
| `afd51cf66a3100a95f878d6c4b93a01f6508e3b0` | select | `ketchup` explains changes with screenshots, videos, and diagrams. |
| `e5136d82418d2db3165ea1050d17577cd618cc05` | select | Four principles restated as reasoning, with the summaries that cite them. `model-the-domain` and `test-behavior-not-implementation` keep the fork's guard and mock rules. |
| `99743e9c151c8537cbbf1f98bb38f34ef3368453` | select | Cuts in interrogate's lead judgment, swarm, and two principles. `type-system-discipline` keeps the fork's ownership, transport, and response-type rules. |
| `182f2ce414e83224915c190d2f63239c1608d0a5` | skip | Upstream's own Claude Code tree under `harness/pstack`. The fork generates its own Claude Code distribution. |
| `1b6d44ff26d4e242f4e8f68c391e6d2f7ca16def`, `997ffc7fe26bdaa6478a14e7f5b8d5f9ed747102`, `3177dab5d4057724e6a02a198596664707795444`, `1e5c90a4b6f249917bd21fe361b3a2a7deb741b8`, `6ce45c59b9301a638c1fe1a7b8dc2a82b650898f` | select | Version bumps, reached as `0.15.25`. |

Version `0.15.25` records the ported content. It does not carry upstream's new
model defaults.

## Earlier selections

The range after `c1c0a32802223f4be824112dd83d33ad29a8b26c` through
`12d587dfb20741cafc376c42c696c5f6e2a64487` was reviewed on `2026-09-24`.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `70b2dc8b4b85c8d5648624ca40d692c421fff32f` | adapt | Autopilot verification rounds from the code-ready head, merge-prep CI wait, approval countersigns, `children.tsv` stuck checks, patch-id noise rule, quieter plan tick prompt, full-autonomy call rule, swarm SHA and method briefs, `log.sh` append guard, and the instruction cuts. Applied to the fork's Graphite and restack wording because `23a56e2` stays deferred. The `show-me-your-work` rule "One row is one decision or checkpoint" stays, because the fork extends it with its own check. Autopilot-stack step 7 also takes upstream's unchanged context sentence that re-runs mergeability and CI after every rewritten push, because the patch-id rule it now points to assumes that check. The Opus 5.5 and Grok 4.7 default swap and the pre-0.15.3 upgrade help are deferred below. |
| `b42effe0aa50f59c693d7e2924714e015e00bf7c` | defer | Rewords the upgrade help that `70b2dc8` added. Belongs to the model-mapping review. |
| `b0b9c7a0baf8b6aa1d00bf77d4101e577d4ba411` | select | All 19 instruction cuts, matched to the fork's wording. |
| `12d587dfb20741cafc376c42c696c5f6e2a64487` | adapt | Force-with-lease publish for owners, owner babysit exception in `babysit.md` and `opening-a-pr.md`, append-only decision-log audit with `start` rows, and the `check-plan.mjs` lane regex. The per-skill `pstack-models.mdc` reading rules moved into the Cursor runtime mapping, because shared skills name runtime roles. The mapping keeps upstream's split: a rejected role slug falls back to the role's default, and a rejected panel entry falls back to the panel default of its family. `interrogate` now defers to that mapping fallback. The multi-phase plan's live-lane model is named by each runtime mapping. The Autopilot-stack root absorbs a babysit restack through the fork's `gt` flow instead of a plain push. The `opening-a-pr.md` wording drops the route to `babysit.md`, which Codex does not support. The `setup-pstack` retired-role drop is deferred because the fork still ships the `how critics` role. |

The range after `71ed0d1076fec562c1b74ee353121a8d00f75382` through
`c1c0a32802223f4be824112dd83d33ad29a8b26c` was reviewed on `2026-09-15`.

| Upstream commit | Decision | Ported content |
|---|---|---|
| `f8abeddd1862dc73704e3d719dd73df0d51b8c71` | select | The Writing the reply rule that every claim carries its evidence or its label. |
| `f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d` | adapt | Operator-neutral pronouns and the in-chat status tick. Applied to the fork's Graphite wording because `23a56e2` stays deferred. |
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
| `70b2dc8b4b85c8d5648624ca40d692c421fff32f` Opus 5.5 and Grok 4.7 defaults, upgrade help, and interrogate panel trim | defer | Belongs to the `23a56e2` model-mapping review. The Cursor runtime mapping and `setup-pstack` still list the older Fable defaults. |
| `b42effe0aa50f59c693d7e2924714e015e00bf7c` upgrade help wording | defer | Depends on the deferred upgrade help. |
| `12d587dfb20741cafc376c42c696c5f6e2a64487` `setup-pstack` retired-role drop | defer | The fork still ships `how critics`, which that change retires. |
| `889ec4b` grok defaults for bug fix, perf, and hillclimb | defer | Belongs to the `23a56e2` model-mapping review. Fork playbooks name the runtime's configured role, and the Cursor-only `setup-pstack` table still predates the Fable 5.1 defaults. |
| `5bf2b15` `setup-pstack` budget ask | defer | Belongs to the `23a56e2` model-mapping review. The skill is unsupported on Codex and Claude Code, and its remap example assumes the Fable 5.1 slugs. |
| `659a636`, `93b00b8` Advisor plugin | skip | Separate Cursor plugin, outside pstack scope. |
| `458dd16` through `7314f72` marketplace and logo changes | skip | Unrelated marketplace plugins and assets. |
| `2b8ae2e` through `256a21a` Grok Voice and third-party MCP plugins | skip | Unrelated marketplace plugins outside `pstack/`. |
| `f712c57` through `86ecc82` X, Google editors, Statsig, Excalidraw, Webull, Robinhood, Coinbase, eToro, finance, and X Money plugins | skip | Unrelated marketplace plugins outside `pstack/`. |
| Remaining prose and structural edits in `e8d856f` | defer | Now taken in `why`, `reflect`, and the touched principles. `architect`, `arena`, `figure-it-out`, `how` (Critique mode, `how critics`), and `unslop` (rules 32 and 33) still need a focused review against fork-specific wording. |
| `df581122cde17e6e27686b5a448bde23e4ad4318` Opus 5.5 xhigh and Grok defaults, Sol drop, and two-entry panels | defer | Belongs to the `23a56e2` model-mapping review. The Cursor mapping, `setup-pstack`, the README, and the guide keep the older defaults together. |
| `ce649c03ac3b75b6ae80cbd15b7e2c536caedb5a` gh and Origin steps in Shipping, Autopilot-full, Autopilot-stack, and the composer family fallback | defer | Built on the deferred `23a56e2` forge-neutral flow and the deferred model defaults. |
| `182f2ce414e83224915c190d2f63239c1608d0a5` `harness/pstack` Claude Code tree and `docs/harness/claude-code.md` | skip | The fork ships its own generated Claude Code distribution and guide. |
| `harness/`, `dyl-stack/`, `origin-apps/`, `third_party/`, and marketplace files after `12d587d` | skip | Outside `pstack/`. |

## Validation from the last selection

- `node scripts/generate-plugin.mjs --target codex`
- `node scripts/generate-plugin.mjs --target claude-code`
- `node scripts/validate-plugin.mjs --all` passed for both targets with 55
  skills and 55 portability records.
- `node --test scripts/test/*.test.mjs` passed 16 of 16.
- `node scripts/validate-plugins.mjs` passed.
- `bun test orch watch-pr check-plan.test.ts` in `pstack/skills/poteto-mode/scripts`
  passed 87 of 87, and the `watch-pr` typecheck passed.
- `scripts/smoke/claude-install-smoke.sh` installed 51 skills and both agents,
  with `poteto-help` among the omitted skills.
