# Active skill portability

Every top-level `pstack/skills/*/SKILL.md` appears once below with one
classification per runtime target. `portable` needs no runtime-sensitive edit.
`adapted` resolves its platform-sensitive operations through the runtime
contract. `unsupported` contains an explicit stop gate for that runtime and is
omitted from that runtime's distribution.

| Skill | Cursor | Codex | Claude Code | Boundary |
|---|---|---|---|---|
| `architect` | `adapted` | `adapted` | `adapted` | Plan, delegation, monitoring, and model roles are mapped. |
| `arena` | `adapted` | `adapted` | `adapted` | Delegation, isolation, judging, and model roles are mapped. |
| `automate-me` | `adapted` | `unsupported` | `unsupported` | Needs an approved runtime history source and personal skill destination. |
| `blast-radius` | `portable` | `portable` | `portable` | Repository evidence and executable checks only. |
| `bro` | `portable` | `portable` | `portable` | Pure response transformation. |
| `create-verification-skill` | `adapted` | `adapted` | `adapted` | Skill destination and browser driving are mapped. |
| `figure-it-out` | `adapted` | `adapted` | `adapted` | Plan, delegation, and skill authoring are mapped. |
| `how` | `adapted` | `adapted` | `adapted` | Exploration, monitoring, and model roles are mapped. |
| `interrogate` | `adapted` | `adapted` | `adapted` | Independent reviewers and model roles are mapped. |
| `maintain-verification-skill` | `adapted` | `adapted` | `adapted` | Skill location, delegation, and live driving are mapped. |
| `make-bot-ui` | `adapted` | `unsupported` | `unsupported` | Needs Cursor routines, secret cards, and webhook semantics. |
| `no-comments` | `adapted` | `adapted` | `adapted` | Uses independent policy-review delegation: a registered Comment Sicko agent where the runtime registers agents, otherwise an inert packaged reference. |
| `poteto-mode` | `adapted` | `adapted` | `adapted` | Runtime capabilities and unsupported routes are gated. |
| `principle-boundary-discipline` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-build-the-lever` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-encode-lessons-in-structure` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-exhaust-the-design-space` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-experience-first` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-fix-root-causes` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-foundational-thinking` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-guard-the-context-window` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-laziness-protocol` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-make-operations-idempotent` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-migrate-callers-then-delete-legacy-apis` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-minimize-reader-load` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-model-the-domain` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-never-block-on-the-human` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-outcome-oriented-execution` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-prove-it-works` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-redesign-from-first-principles` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-separate-before-serializing-shared-state` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-sequence-verifiable-units` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-subtract-before-you-add` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `principle-type-system-discipline` | `portable` | `portable` | `portable` | Platform-neutral principle. |
| `recall` | `adapted` | `unsupported` | `unsupported` | Needs an explicitly authorized task-history adapter for the runtime. |
| `reflect` | `adapted` | `adapted` | `adapted` | Active conversation, delegation, and skill authoring are mapped. |
| `setup-pstack` | `adapted` | `unsupported` | `unsupported` | Cursor `.mdc` model rules are ignored; other runtimes use their own model controls. |
| `show-me-your-work` | `adapted` | `adapted` | `adapted` | Active conversation and independent review are mapped. |
| `swarm` | `adapted` | `adapted` | `adapted` | Delegation, isolation, monitoring, and model roles are mapped. |
| `tdd` | `portable` | `portable` | `portable` | Repository tests and executable checks only. |
| `teach` | `portable` | `portable` | `portable` | Composes shared skills and inherits their gates. |
| `technical-writing` | `portable` | `portable` | `portable` | Platform-neutral writing guidance. |
| `typescript-best-practices` | `portable` | `portable` | `portable` | Platform-neutral language guidance. |
| `unslop` | `portable` | `portable` | `portable` | Pure prose transformation. |
| `why` | `adapted` | `adapted` | `adapted` | Evidence discovery, delegation, and model roles are mapped. |

## Unsupported Poteto Mode routes by runtime

Each runtime mapping owns its own list. The build for a runtime replaces each
listed route with an explicit stop page, and `poteto-mode` stops before entering
it and never reports its result as successful.

### Cursor

No route is unsupported. Cursor runs every playbook.

### Codex

`autonomous-run`, `autopilot-full`, `autopilot-stack`, `babysit`, `eval`,
`multi-phase-plan`, `session-pickup`, `shipping`, and `worktree-cleanup` depend
on excluded Cursor loops, cloud agents, transcripts, sidebar state, or scripts.

`orchestrate` is supported through the `codex-local-session` profile. It ships
only its Bun SQLite runtime and uses explicit worktrees, exact commit evidence,
one integration writer, and conservative restart recovery.

### Claude Code

`autopilot-full`, `autopilot-stack`, and `shipping` depend on Graphite stack
delivery. `eval` and `session-pickup` depend on an authorized transcript source.
Those five are the only unsupported routes. `babysit` is supported through the
packaged `watch-pr` utility plus `/loop`, `worktree-cleanup` through the
packaged worktree audit script whose `--transcripts` argument is optional, and
`multi-phase-plan` through the packaged plan checker. `autonomous-run` is
supported through `/loop`, and `orchestrate` through the
`claude-local-session` profile.

Packaged source may still contain excluded agents, automations, and utility files
for Cursor. No runtime mapping, supported skill, or generated playbook may invoke
those paths on a runtime that excludes them.
