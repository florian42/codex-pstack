# Codex runtime mapping

Use only capabilities exposed in the current Codex task. Tool availability is
authoritative; do not assume a desktop-only tool exists in CLI or cloud tasks.

| Capability | Codex mapping |
|---|---|
| Delegate independent work | Use Codex subagent delegation (`spawn_agent`) and collect only successfully created workers with the collaboration wait capability. Agents share the checkout, so give writers disjoint files; use separate worktrees only when true git isolation is required. Respect the task's concurrency limit. If collaboration tools are absent or a spawn fails, do not wait on that worker. Continue the affected slice serially and disclose that independent delegation did not run. |
| Delegate an independent policy reviewer | For the `comment-sicko` policy, resolve the installed `no-comments` skill directory and give a fresh normal subagent the absolute path formed by that directory plus `/references/comment-sicko.md`, and only the requested scope. The worker may edit comments only inside the scope, then returns its report and diff. The parent validates that exact diff and rejects application-code edits or scope escapes. Wait for that exact worker. A missing resource, unavailable independent delegation, failed spawn, or failed wait is `blocked`; report it and stop before self-reviewing or editing. Never use the parent as fallback. |
| Ask a blocking question | In Plan mode, use the structured user-input capability when available. Otherwise ask one concise question in the final response and stop. Never invent a structured-question tool call. |
| Track a plan | Use Codex plan tracking (`update_plan`) when available, with at most one item in progress. Otherwise keep a concise phase checklist in commentary. |
| Create or update a skill | Use the installed `skill-creator` skill and follow its `SKILL.md`. If it is absent, stop the skill-authoring workflow and identify that dependency. Project-local output uses the location chosen by that skill; do not write `.cursor/skills/` by default. |
| Resolve the active conversation | Use the current Codex task's visible conversation. If compaction removed required detail, the parent writes and labels a concise digest for delegates. Do not inspect another task or guess a transcript path. If neither the visible context nor a sufficient digest is available, stop the dependent workflow. |
| Monitor long-running work | Use Codex wait capabilities for subagents, tasks, commands, and handoffs. Prefer bounded waits and status-change cursors. If no suitable wait capability exists, report the limitation instead of polling in a tight loop. |
| Schedule recurring work | Use Codex automation support when available: a thread heartbeat by default, or a project cron only when the user explicitly requests standalone project work. If automation support is absent, recurring scheduling is unsupported and the workflow must stop without claiming it was armed. |
| Select a model role | Prefer the parent task's configured model. Pass an explicit model only when the current Codex capability advertises that exact model and the role benefits from an override. Cursor model files and slugs are ignored. If a requested model is unavailable, inherit the parent rather than translating names by guesswork. |
| Verify in a browser | Use the installed in-app Browser control skill when available. Otherwise use a repository-owned Playwright or CDP harness. If neither can drive the required surface, report browser verification as blocked. Screenshots without the preceding interaction and resulting state are not proof. |

## Codex exclusions in the first release

Codex does not package Cursor agents, Benny, Cursor routines, Cursor transcript
directories, Cursor secret-request cards, or Cursor model configuration. A skill
that depends on one of those facilities must follow its explicit Codex stop gate
and must not imply that the operation completed.
