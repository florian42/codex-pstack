# 02 — Runtime mappings own their unsupported-route lists; portability table gains per-target columns

**What to build:** A Cursor or Claude Code user reading `poteto-mode` no longer sees the Codex unsupported-route list stated as fact. The Poteto Mode skill's runtime-boundary paragraph is replaced by one paragraph saying the current runtime mapping owns that list. The Codex mapping carries its nine routes; the Cursor mapping states none. The portability table has one classification column per target (Cursor, Codex, with Claude Code added empty-ready by header), per-target unsupported-route subsections, and the shared parser locates a column by header name. The validator cross-checks a target's `unsupportedResources` against that target's mapping file instead of the Poteto Mode skill.

**Blocked by:** 01 — Extract a shared multi-target build core.

**Status:** done

- [x] The Poteto Mode skill edit is a single replaced paragraph with no reflow of neighboring text
- [x] Validator fails if a route in the Codex build config is missing from the Codex mapping's route list, and passes on the current set
- [x] Portability parser resolves the `Codex` column by header; removing a column header fails validation with a clear message
- [x] `git diff --exit-code .agents/plugins/pstack` is clean apart from the regenerated Poteto Mode skill and runtime references, and the freshness check passes after regeneration
- [x] The maintenance-contract note in the Codex guide records that this canonical edit is fork-owned
