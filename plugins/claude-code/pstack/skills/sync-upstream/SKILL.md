---
name: sync-upstream
description: Sync this fork selectively with its upstream plugin repository. Review relevant pstack changes, preserve every supported target, regenerate the distributions, and update the durable upstream sync ledger.
---

# Sync upstream

Use this skill when the upstream plugin repository has changed and this fork needs a selective pstack update.

Read [`../../references/runtime/upstream-sync.md`](../../references/runtime/upstream-sync.md) before inspecting commits. The ledger is the starting boundary. Do not re-review commits already recorded there unless new evidence shows that a previous decision was wrong.

## Boundary

This fork is intentionally not a full mirror of its parent. Review the upstream range, then select only changes that improve the shared pstack source or its runtime mappings. Keep unrelated marketplace plugins, runtime-specific integrations, and upstream commits that do not earn a place in this fork out of the change.

`pstack/` is the canonical source for every supported target. Edit it first. Generated target trees are outputs. Never hand-edit a generated target to solve source drift.

## Workflow

1. Inspect `git status --short --branch` and preserve unrelated work. A dirty tracked worktree is a stop for source edits.
2. Fetch `upstream/main` and identify commits after the ledger's reviewed boundary.
3. Read commit summaries and diffs limited to `pstack/`. Classify each commit as select, adapt, skip, or defer. Record the decision and its reason in the ledger.
4. Port selected changes into the canonical source. Keep runtime differences in the runtime references and portability table. A skill shared by every target must be marked portable only when its instructions are runtime-neutral.
5. Regenerate every target:

   ```bash
   node scripts/generate-plugin.mjs --target codex
   node scripts/generate-plugin.mjs --target claude-code
   ```

6. Validate generation, manifests, portability, and target compatibility:

   ```bash
   node scripts/validate-plugin.mjs --all
   ```

7. Run the focused tests affected by the port. Use the target smoke tests when a runtime mapping or generated inventory changed.
8. Update the ledger only after the selected changes and generated outputs pass validation. Record the full upstream SHA, not only its short form.
9. Review `git diff --check`, the complete diff, and the remaining untracked files. Commit the sync as one focused change. Push or merge only when the user explicitly asks.

## Selection rules

- A change to canonical pstack prose or a portable principle can be selected for all targets after checking its runtime references.
- A runtime-specific change needs an explicit decision for every supported target. Adapt it when the behavior exists across targets. Skip it when it depends on a primitive unavailable to this fork.
- A generated package change is evidence of source or generator drift. Find and change the source that owns it, then regenerate.
- A prose-only cleanup may be skipped when it conflicts with fork-specific runtime wording. Record the exact commit and the reason so it is not reconsidered on every run.
- A new skill or playbook needs a portability classification before it enters the canonical tree. Unsupported runtime routes require an explicit stop page and a generated-output check.
- Never infer that a commit was selected because it is an ancestor of the fork. Selection is a recorded decision about content, not a GitHub ahead/behind count.

## Completion record

The ledger must answer four questions:

- Which upstream commit was reviewed last?
- Which commits or file changes were selected?
- Which were adapted or skipped, and why?
- Which target generation and validation commands passed?

If fetching upstream fails, leave the previous ledger boundary unchanged and report the concrete access failure.
