# Claude Code runtime mapping

Use only capabilities exposed in the current Claude Code session. Tool
availability is authoritative; a tool that is absent from the session, denied by
permissions, or excluded for the active model does not exist for this mapping.

| Capability | Claude Code mapping |
|---|---|
| Delegate independent work | Use the `Agent` tool with an explicit `subagent_type` (`general-purpose` for writers, `Explore` for read-only search, or the registered `pstack:poteto-agent` for one bounded subtask in poteto's style). The parent session applies `poteto-mode` itself and never hands its whole task to a background agent; a headless session that ends after delegating loses the work. Set `run_in_background: true` for fan-out and collect results from completion notifications. When several writers would touch the same checkout, request `isolation: "worktree"` so each worker gets its own Git worktree; otherwise give writers disjoint files. Respect the session's concurrency and depth limits. If the `Agent` tool is absent or a spawn fails, continue the affected slice serially and disclose that independent delegation did not run. |
| Write across worktrees | A subagent's Edit and Write are pinned to the worktree it runs in. A writer that must change another worktree of the same repository first calls `EnterWorktree` with `path` set to that worktree (it must be under `.claude/worktrees/` and listed by `git worktree list`); the switch affects only that agent. Where the switch is unavailable, the worker returns a report and the parent applies it, and the parent records that the stage was applied by the parent rather than by the worker. Never escape the pin through Bash writes. |
| Delegate an independent policy reviewer | For the `comment-sicko` policy, use the registered plugin agent with `Agent(subagent_type: "pstack:comment-sicko")`. Pass only the requested scope and wait for that exact worker. The agent is restricted to read tools by its packaged definition, so its result is a report; the parent applies accepted comment-only edits inside the scope and rejects anything else. A missing agent, unavailable delegation, failed spawn, or failed wait is `blocked`; report it and stop before self-reviewing or editing. Never use the parent or a generic subagent as fallback. |
| Ask a blocking question | Use `AskUserQuestion` from the parent session. Subagents cannot ask; a delegate that needs a decision returns `blocked` with the question for the parent to raise. In a session where the tool is denied, ask one concise question in the final response and stop. |
| Track a plan | Use `TaskCreate` and `TaskUpdate` when they are available, with at most one item in progress. Those tools are excluded by default for some models; when they are absent, keep a concise phase checklist in the reply and preserve every required playbook step with its status. A missing plan tool does not remove the planning requirement. |
| Create or update a skill | Use the installed `skill-creator` skill and follow its `SKILL.md`. If it is absent, stop the skill-authoring workflow and name that dependency. Project skills live under `.claude/skills/`; personal skills live under `~/.claude/skills/`. Never write another runtime's skill directory. |
| Resolve the active conversation | Use the current session's visible context. If compaction removed required detail, the parent writes and labels a concise digest for delegates. Do not read the current session's own transcript file to reconstruct it; a hook-supplied transcript path is the only authorized file source for the active session, and no skill depends on it. Prior sessions are reachable only through the task-history row below. If neither the visible context nor a sufficient digest is available, stop the dependent workflow. |
| Resolve task history | Claude Code writes one transcript per session at `$CLAUDE_CONFIG_DIR/projects/<slug>/<session-id>.jsonl`, where `CLAUDE_CONFIG_DIR` defaults to `~/.claude` and `<slug>` is the workspace path with each `/` turned into `-`, leading dash kept (so `/Users/you/proj` becomes `-Users-you-proj`). When the workspace path holds other punctuation, list `projects/` and pick the directory whose lines carry the workspace as `cwd` rather than guessing the sanitization. Read only that directory's top-level `.jsonl` files; the sibling `<session-id>/` directories hold tool output and delegated agents and are noise. Every line is a JSON record with a `type`; the conversation is the `user` and `assistant` records, each with `message`, `cwd`, `sessionId`, `timestamp`, and `gitBranch`. Skip lines with `isSidechain` set to true, which belong to delegated agents, and skip the current session, the file holding this very request. The format is undocumented and changes between versions; when the layout or the records do not match this description, report history as unavailable rather than adapting the parse by guesswork. Order candidates by modification time, never by file name. Cite a finding by its session id, which `claude --resume <id>` reopens. To pick up one named session, open only `<session-id>.jsonl` for the id the user gave, or the newest top-level transcript by modification time for "the last one". A remote session URL is not a readable source on this runtime: say so and fall back to the pushed branch. |
| Read a delegate's trace | A delegated agent's transcript lives beside the parent's at `projects/<slug>/<session-id>/subagents/agent-<agent-id>.jsonl`, keyed to the parent by the directory name, and every line in it carries `isSidechain` true and the same `agentId`. A parent grading its own delegates reads only the files under its own `<session-id>/subagents/` directory, matching each candidate to its sanitized working directory by the `Agent` call's prompt, and reads the `assistant` records' `tool_use` blocks (`Read` with `file_path`, `Bash` with `command`) to see which files it actually opened. A candidate that instead ran as its own headless session in a sanitized directory is a root transcript under that directory's own `projects/` slug; read it through the task-history layout with that directory as the workspace. |
| Monitor long-running work | Use background-agent completion notifications, `TaskOutput` for background commands, and the `Monitor` tool for a script whose output lines signal progress. Prefer bounded waits. Do not busy-poll or report an unchanged state as progress. |
| Schedule recurring work | Use `/loop` (backed by `CronCreate`) only when the user requested recurring execution and the session exposes it. Loop tasks are session-scoped and expire; a scheduled fire cannot invoke a skill marked `disable-model-invocation`, so the loop prompt must carry the work itself. If no scheduler is exposed, recurring scheduling is unsupported and the workflow stops without claiming it was armed. |
| Select a model role | Prefer the parent session's model. Pass `model` on an `Agent` call only with an alias this install exposes (`opus`, `sonnet`, `haiku`, `fable`, or `inherit`), and only when the role benefits from an override. Cursor model files and slugs are ignored. If a requested alias is unavailable or substituted by policy, inherit the parent rather than translating names by guesswork. |
| Verify in a browser | Use the Claude in Chrome integration when the session reports it connected; it requires a direct subscription login and is unavailable under API-key or third-party-provider authentication. Otherwise use a repository-owned Playwright or CDP harness, or an installed browser-control MCP server. If none can drive the required surface, report browser verification as blocked. Screenshots without the preceding interaction and resulting state are not proof. |

## Unsupported Poteto Mode routes in the first Claude Code release

`autopilot-full`, `autopilot-stack`, and `shipping` depend on Graphite stack
delivery. Those three are the only unsupported routes. The Claude Code
distribution replaces each with an explicit stop page. `poteto-mode` stops
before entering them and never reports their result as successful.

`autonomous-run` is supported: its only runtime dependency is a recurring wake,
which `/loop` provides. `babysit` is supported through the packaged `watch-pr`
utility at `skills/poteto-mode/scripts/watch-pr/watch-pr`, rearmed under
`/loop` for `drive` and `background`. `worktree-cleanup` is supported through
the packaged audit script at `skills/poteto-mode/scripts/worktree-audit.sh`;
its `--transcripts` argument is optional and, when used, points at the
workspace's own `projects/<slug>` directory from the task-history row.
`multi-phase-plan` is supported
through the packaged plan checker at
`skills/poteto-mode/scripts/check-plan.mjs`. `orchestrate` is supported through
the `claude-local-session` profile in the [Orchestrate mapping](orchestrate-claude-code.md).
`session-pickup` and `eval` are supported through the task-history and
delegate-trace rows above; a remote session URL handoff still stops with a
pointer to the pushed branch.

## Claude Code exclusions in the first release

The Claude Code distribution does not package Benny, Cursor routines, Cursor
transcript directories, Cursor secret-request cards, Cursor model configuration,
or dependency installers. Agent teams are experimental and unavailable in
headless sessions; do not use them. A prompt-submit hook that re-injects the
Poteto Mode reminder each turn is not part of this release; the skill's rendered
content persists in context for the session instead. A skill that depends on an
excluded facility must follow its explicit stop gate and must not imply that the
operation completed.
