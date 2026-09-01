# 08 — Headless behavior smoke harness, nightly schedule, optional eval suite

**What to build:** A maintainer runs one script that drives headless Claude Code sessions with the generated plugin loaded and asserts on the tool-call stream and the working tree. Cases: discovery lists expected skills; a read-only investigation on a tiny fixture leaves the tree clean and creates a plan; an unsupported route prints the stop page and issues no merge or push call; `/pstack:no-comments` on a fixture spawns `comment-sicko`, removes the narration comment, and keeps the public-API doc comment; Orchestrate init creates the SQLite store. The workflow runs it nightly and on the `claude-smoke` label with an API key secret. A `claude plugin eval` suite with the same cases is checked in and skipped where early access is not enabled.

**Blocked by:** 06 — Land the Claude Code target.

**Status:** ready-for-agent

- [ ] Each case asserts on observed tool calls (Agent with `subagent_type`, absence of `gh pr merge`/`gt`/push) parsed from `stream-json`, never on prose alone
- [ ] Harness fails loudly if the plugin did not load (system init reports plugin errors)
- [ ] Documented that bare mode needs an API key; non-bare needs an OAuth token with pinned settings
- [ ] Workflow has a `schedule` trigger and a `behavior-smoke` job with cancel-in-progress concurrency that never gates ordinary pull requests
- [ ] Eval suite self-tests enablement and exits 0 with a skip message when gated
