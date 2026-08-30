# Orchestrate on Codex

The first supported profile is `codex-local-session`. It provides durable local state and conservative restart recovery. It does not promise cloud workers, unattended continuation, transcript recovery, pull request creation, or a standing background coordinator.

## Safety model

- Analysis units use the shared checkout read-only.
- Code units name an absolute isolated Git worktree.
- Only one code unit may be dispatched at a time in this first profile.
- The coordinator is the only integration writer for the shared checkout.
- Integration is fast-forward only. A conflict or non-fast-forward result becomes a new unit.
- A code report is accepted only with a full commit SHA that resolves in the program repository.
- Verification receipts bind to that SHA. Pull requests are optional metadata outside the first runtime.
- Recovery interrupts every outstanding dispatch. Start a fresh subagent from the stored brief and accepted artifacts.

Subagents share a checkout unless the coordinator creates an explicit worktree. Give analysis workers read-only instructions. Give a code worker only its named worktree. Do not let a subagent mutate the SQLite store.

## Runtime

The installed entry point is `skills/poteto-mode/scripts/orch/codex-orch.ts`. Set `ORCH` to its absolute path. Keep the store outside the repository checkout when possible.

```bash
command -v bun
bun --version
ORCH=/absolute/plugin/path/skills/poteto-mode/scripts/orch/codex-orch.ts
STORE=/absolute/durable/path/program.sqlite
```

Initialize a clean Git repository and name the integration writer.

```bash
bun "$ORCH" init --store "$STORE" --repo "$PWD" --program migration --integration-writer coordinator
```

Plan and dispatch an analysis unit. Attempt IDs are supplied by the coordinator so retrying an uncertain dispatch is idempotent.

```bash
bun "$ORCH" plan audit --store "$STORE" --checkout read-only --brief /absolute/path/audit-brief.md
bun "$ORCH" dispatch audit --store "$STORE" --attempt audit-1
bun "$ORCH" report audit --store "$STORE" --attempt audit-1 --report /absolute/path/audit.md
```

Plan a code unit only after creating its isolated worktree. The worker writes and commits there, then returns its report and full SHA.

```bash
git worktree add -b orch/unit-a /absolute/path/unit-a
bun "$ORCH" plan unit-a --store "$STORE" --worktree /absolute/path/unit-a --brief /absolute/path/unit-a-brief.md
bun "$ORCH" dispatch unit-a --store "$STORE" --attempt unit-a-1
bun "$ORCH" report unit-a --store "$STORE" --attempt unit-a-1 --report /absolute/path/unit-a.md --commit "$SHA"
```

Record independent evidence, then integrate as the configured writer.

```bash
bun "$ORCH" verify unit-a --store "$STORE" --commit "$SHA" --receipt /absolute/path/unit-a-verification.md
bun "$ORCH" integrate unit-a --store "$STORE" --actor coordinator
```

At the start of a later session, recover before dispatching. Use a new session ID for each recovery boundary.

```bash
bun "$ORCH" recover --store "$STORE" --session session-2
bun "$ORCH" status --store "$STORE"
```

Every command prints JSON. The SQLite journal stores immutable events and content-addressed report bytes in one transaction. Repeating the same event is a no-op. Reusing an event identity with different data fails.

`dispatch` returns the stored brief, assigned checkout, unit ID, and attempt ID as a JSON packet. Pass those facts to the subagent. Recovery can issue a fresh packet because the brief is stored by digest rather than left in chat history.

## Capability limits

Use bounded waits only for workers in the current task. A scheduled return may remind the coordinator to resume when the active surface supports it, but scheduling is not worker durability. After a restart, do not claim an old worker is running, inspectable, or resumable. The durable resume point is the store plus Git.
