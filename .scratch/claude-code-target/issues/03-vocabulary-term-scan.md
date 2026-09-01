# 03 — Per-target vocabulary-based platform-term scan

**What to build:** The validator's platform-term scan is driven by named vocabularies in the shared core (cursor-exclusive, codex-exclusive, claude-exclusive, cursor-shared-with-claude) and each target's build config lists the vocabularies it bans. The Codex target bans cursor-exclusive, cursor-shared-with-claude, and claude-exclusive and produces identical findings to today's scan on the current tree. The hardcoded delegation-vocabulary ban on the generated `no-comments` skill is removed because the scan subsumes it. Allowlist entries are shape-validated and stale entries still fail.

**Blocked by:** 01 — Extract a shared multi-target build core.

**Status:** ready-for-agent

- [ ] Codex validation passes on the current tree with the vocabulary-driven scan
- [ ] Injecting the word `Cursor`, `spawn_agent`, or `subagent_type` into a generated Codex skill each produces one scan failure naming the file and line
- [ ] Injecting `spawn_agent` into a generated skill of a target that bans codex-exclusive fails, while `subagent_type` passes for a target that does not ban cursor-shared-with-claude (covered by a unit-level check of the resolver)
- [ ] A malformed allowlist entry fails as a config error, not as a stale entry
- [ ] Regular expressions are code literals in the shared core, not strings in JSON
