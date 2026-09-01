# 07 — Hermetic install-resolution smoke test gating pull requests

**What to build:** CI proves end to end that the repository resolves as a Claude Code marketplace. A script under a scratch `CLAUDE_CONFIG_DIR` adds the repository as a marketplace, installs `pstack`, and prints the component inventory; it asserts the skill count equals the generated tree's `SKILL.md` count, exactly two agents are present, required skills are present, and the four omitted skills are absent. The same script automates the Codex marketplace listing where the Codex CLI is present. The workflow runs it as a pull-request gate.

**Blocked by:** 06 — Land the Claude Code target.

**Status:** ready-for-agent

- [ ] Script exits non-zero if any omitted skill appears or the agent set differs
- [ ] Script skips with a clear message when a CLI is absent, and CI installs the Claude Code CLI so it does not skip there
- [ ] Runs without any model call or API key
- [ ] Workflow job `install-smoke` gates pull requests and is documented in the Claude Code guide's maintenance section
