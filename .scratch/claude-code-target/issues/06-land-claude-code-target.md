# 06 — Land the Claude Code target: manifest, marketplace, build config, generated tree, guide

**What to build:** A Claude Code user runs `claude plugin marketplace add florian42/codex-pstack`, installs `pstack`, starts a fresh session, and `/pstack:poteto-mode` reads the Claude Code mapping and runs the Investigation playbook with delegation. The repository gains a root `.claude-plugin/marketplace.json` pointing at `./plugins/claude-code/pstack`, a hand-written Claude Code manifest beside the Cursor and Codex manifests (no `agents` field), a Claude Code build config, and the generated distribution with 41 skills, two agents, stop pages for the unsupported routes, the Orchestrate Bun runtime, and the decision-log helper. The generated `comment-sicko` agent has a normalized name and an injected read-only tool allowlist. A Claude Code guide mirrors the Codex guide, and the root and pstack READMEs link it.

**Blocked by:** 03 — Vocabulary term scan; 04 — Schemas and version parity; 05 — Claude Code runtime mapping.

**Status:** done

- [x] `node scripts/validate-plugin.mjs --all` passes; `--target claude-code --check` reports the tree current
- [x] `claude plugin validate --strict` passes on the generated tree and on the root marketplace
- [x] `claude --plugin-dir plugins/claude-code/pstack plugin details pstack` lists 41 skills and exactly the agents `comment-sicko` and `poteto-agent`
- [x] The four omitted skills, all `*.test.ts` files, `bootstrap.ts`, `package.json`, `bun.lock`, and Benny automations are absent from the generated tree
- [x] Each stop page reads "Unsupported on Claude Code" and links the Claude Code mapping
- [x] Claude Code target bans cursor-exclusive and codex-exclusive vocabularies and the scan passes
- [x] `git diff --exit-code .agents/plugins/pstack` is clean
- [x] Guide covers install, first use, boundary (five routes reduce to Graphite and transcript access), maintenance, and a numbered fresh-session smoke checklist
- [x] Version parity holds across all three manifests; marketplace entry omits `version`
