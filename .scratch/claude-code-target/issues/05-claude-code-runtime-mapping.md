# 05 — Claude Code runtime mapping and Orchestrate profile (documentation only)

**What to build:** A reader of the runtime contract finds a Claude Code mapping with one row per contract capability, a Claude Code Orchestrate profile written as a delta over the shared safety model, a populated Claude Code column in the portability table, and a Claude Code unsupported-route subsection listing `autopilot-full`, `autopilot-stack`, `shipping`, `eval`, and `session-pickup`, plus the routes held back until the prefactor lands (`babysit`, `worktree-cleanup`, `multi-phase-plan`). The Orchestrate runtime entry file is renamed to a target-neutral name and every reference updated. No generated tree changes except the renamed runtime resource.

**Blocked by:** 02 — Mapping-owned routes and per-target portability.

**Status:** ready-for-agent

- [ ] Mapping rows cover: delegation (Agent tool, `subagent_type`, background, worktree isolation), policy reviewer (`comment-sicko` agent, failures are `blocked`), blocking question (unavailable to subagents), plan tracking (task tools with prose fallback), skill authoring (skill-creator, project and personal directories), conversation resolution (visible context only; JSONL directory forbidden), monitoring, scheduling (`/loop`), model roles (aliases only, Cursor slugs ignored), browser (repository harness; Chrome integration plan-gated)
- [ ] Mapping lists first-release exclusions: agent teams, sticky-mode hook, transcript-dependent skills
- [ ] Orchestrate profile states concurrent worktree-isolated code units and a `/loop` coordinator tick, and otherwise defers to the shared safety model moved into the design document
- [ ] Contract index links the new mapping; the portability table's Claude Code column classifies all 45 skills
- [ ] Codex validation still passes; the renamed runtime file appears in the Codex `runtimeResources` and its tests still pass under `bun test`
- [ ] Every new document passes the link and backtick-reference checks
