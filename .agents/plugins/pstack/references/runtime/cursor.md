# Cursor runtime mapping

This mapping preserves pstack's existing Cursor behavior. Cursor-specific names
belong here or in a deliberately Cursor-only skill, not in shared workflow prose.

| Capability | Cursor mapping |
|---|---|
| Delegate independent work | Use the `Task` tool. Use `generalPurpose` unless a routed skill explicitly names another shipped agent. `run_in_background: true` is the default. Use `readonly: true` only when the worker does not need MCP access. Cloud workers use `environment: "cloud"`; local-only work uses `environment: "local"`. |
| Delegate an independent policy reviewer | For the `comment-sicko` policy, use the existing `Comment Sicko` agent with `Task(subagent_type: "Comment Sicko")`. Pass only the requested scope and wait for that exact worker. Its report is `completed`; spawn or wait failure is `blocked`. |
| Ask a blocking question | Use `AskQuestion` when it is available. A plain concise user question is the fallback. |
| Track a plan | Use Cursor's todo list. Preserve every required playbook step and mark a skipped step with its reason. |
| Create or update a skill | Use Cursor's built-in `create-skill` capability. Project skills live under `.cursor/skills/`; personal skills live under `~/.cursor/skills/`. |
| Resolve the active conversation | Use only the active workspace transcript path supplied by Cursor's system context. If it is unavailable or incomplete, the parent writes and labels a concise digest. Never glob other workspaces or guess a transcript path. |
| Monitor long-running work | Use the available task result or terminal notification mechanism. A user-requested recurring local wake may use Cursor's `/loop`. |
| Schedule recurring work | Use Cursor routines or `/loop` only when the corresponding runtime capability is present and the user requested recurring execution. |
| Select a model role | Read `~/.cursor/rules/pstack-models.mdc` when present. Otherwise use the defaults documented by the calling skill. Validate every explicit slug against the current `Task` tool before spawning. |
| Verify in a browser | Use `cursor-team-kit`'s `control-ui` when installed, or the repository's own Playwright/CDP harness. Use `control-cli` for CLI and TUI surfaces. |

No Poteto Mode route is unsupported on Cursor. `orchestrate` runs through the
Cursor profile in the [Orchestrate mapping](orchestrate-cursor.md).

Cursor agents under `pstack/agents/` and Benny under `pstack/automations/` remain
Cursor-only. This mapping does not add them to the Codex package.

## Default Cursor model roles

`~/.cursor/rules/pstack-models.mdc` overrides these values. When no override is
present, preserve the existing pstack defaults below. Panel rows are ordered
lists; one runner uses each entry.

| Role | Default |
|---|---|
| feature, refactoring | `grok-4.6-fast-xhigh` |
| bug-fix, perf-issue, hillclimb | `gpt-5.6-sol-max` |
| judgment and prose, hardest tasks | `claude-fable-5-thinking-max` |
| how explorer | `grok-4.6-fast-xhigh` |
| how explainer | `claude-fable-5-thinking-max` |
| how critics | `claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh` |
| why investigators | `grok-4.6-fast-xhigh` |
| why synthesizer | `claude-fable-5-thinking-max` |
| reflect tooling | `gpt-5.6-sol-max` |
| reflect judgment, divergent, synthesizer | `claude-fable-5-thinking-max` |
| arena runners | `claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh` |
| arena cross-judge pool | `claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh` |
| swarm workers | `grok-4.6-fast-xhigh` |
| architect runners | `claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh` |
| interrogate reviewers | `claude-fable-5-thinking-max`, `gpt-5.6-sol-max`, `grok-4.6-fast-xhigh`, `claude-opus-5-thinking-xhigh` |
