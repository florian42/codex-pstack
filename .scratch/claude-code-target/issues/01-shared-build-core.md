# 01 — Extract a shared multi-target build core with a zero-diff Codex gate

**What to build:** A maintainer runs `node scripts/generate-plugin.mjs --target codex --check` and `node scripts/validate-plugin.mjs --target codex` and gets exactly today's results, while the old `generate-codex-pstack.mjs` and `validate-codex-pstack.mjs` names keep working as shims. The generator and validator share one core (portability parsing, frontmatter parsing, file-map building, stop-page rendering, comparison, manifest parity) selected by a target flag. The Codex build config gains the target-shape fields (target name, manifest source and destination, output root, marketplace path and source pointer, portability column, runtime mapping path, stop-page title and link, forbidden generated directories, required skills, required agents) with values that reproduce current behavior.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `git diff --exit-code .agents/plugins/pstack` is clean after regenerating with the new generator
- [x] Both new entry points and both shims exit 0 on the current tree with the same pass messages as today
- [x] The single shared portability parser uses the validator's alias map, reports duplicates, and hard-errors on an unrecognized status cell; the generator no longer has its own parser
- [x] Mutating one generated file makes the validator fail with the same `path:line: message` shape as today
- [x] CI workflow path filters include the shared core directory and the new entry points
- [x] The Codex guide's documented commands still run unchanged
