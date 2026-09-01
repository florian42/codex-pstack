# 10 — Enable `babysit`, `worktree-cleanup`, and `multi-phase-plan` on Claude Code

**What to build:** A Claude Code user invoking Poteto Mode for a babysit, worktree cleanup, or multi-phase plan task gets the real playbook instead of a stop page. The Claude Code build config removes the three routes from `unsupportedResources`, adds the `watch-pr` file set, the plan checker, and the worktree audit to `runtimeResources`, and the mapping and portability subsections are updated. The one Cursor-specific line in the multi-phase plan playbook that names Cursor team-kit browser and CLI drivers is routed through the mapping's browser row so the supported-playbook scan passes.

**Blocked by:** 06 — Land the Claude Code target; 09 — `watch-pr` and worktree audit prefactor.

**Status:** ready-for-agent

- [ ] Generated tree contains the real playbooks for the three routes and no stop page for them
- [ ] Runtime resources pass the import-closure, mode, and no-test-file checks
- [ ] Supported-playbook scan passes with the multi-phase plan edit, and the Codex tree still renders that route as a stop page
- [ ] Behavior smoke gains a case that a babysit prompt invokes the packaged `watch-pr` entry without attempting a dependency install
- [ ] Guide's boundary section now lists only the five Graphite- and transcript-dependent routes
