# Orchestrate on Claude Code

The supported profile is `claude-local-session`. It reuses the shared Bun
SQLite runtime and the safety model in the [Orchestrate design](orchestrate-design.md).
This document records only where Claude Code differs from that model.

## Differences from the shared safety model

- Several code units may be dispatched concurrently. This is what
  `init --profile claude-local-session` buys: the profile is recorded in the
  journal, and the reducer then allows more than one `isolated-worktree`
  dispatch at a time (unbounded by default, or capped with
  `--max-code-dispatches N`). Each code worker is an `Agent` call with
  `isolation: "worktree"` or an explicit worktree the coordinator created, so
  workers never share a writable checkout. The coordinator is still the only
  integration writer and still integrates one unit at a time, fast-forward
  only, so a worker whose worktree has fallen behind rebases onto the new head
  before its commit is accepted.
- A coordinator tick may be scheduled with `/loop` when the user asked for a
  standing program. The tick recovers, drains reports, verifies, and integrates.
  Scheduling is not worker durability: after a restart or an expired loop, do
  not claim an old worker is running, inspectable, or resumable. The durable
  resume point is the store plus Git.
- Analysis units run as background `Explore` or read-only `general-purpose`
  agents on the shared checkout. Give them read-only instructions.
- Bounded waits use background-agent completion notifications. Do not poll the
  store in a tight loop.

Everything else is unchanged: briefs are stored by digest, a code report is
accepted only with a full commit SHA that resolves in the program repository,
verification receipts bind to that SHA, the coordinator is the only integration
writer, and recovery marks every outstanding dispatch interrupted.

## Runtime

The installed entry point is `skills/poteto-mode/scripts/orch/session-orch.ts`.
Set `ORCH` to its absolute path inside the installed plugin. Keep the store
outside the repository checkout when possible.

```bash
command -v bun
bun --version
ORCH=/absolute/plugin/path/skills/poteto-mode/scripts/orch/session-orch.ts
STORE=/absolute/durable/path/program.sqlite
bun "$ORCH" init --store "$STORE" --repo "$PWD" --program migration \
  --profile claude-local-session --integration-writer coordinator
```

Omitting `--profile` initializes the serial `codex-local-session` profile, which
refuses a second concurrent code dispatch. Add `--max-code-dispatches N` to cap
how many code units may hold a dispatch at once; `status` reports the profile
and the effective cap.

The command sequence for `plan`, `dispatch`, `report`, `verify`, `integrate`,
`recover`, and `status` is identical to the [Codex profile](orchestrate-codex.md).
Pass the JSON packet that `dispatch` returns to the worker as its brief.

## Capability limits

Do not let a subagent mutate the SQLite store. Do not accept a report without a
resolvable commit. Do not integrate a unit that lacks a verification receipt for
its exact commit.
