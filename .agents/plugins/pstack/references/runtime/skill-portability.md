# Active skill portability

Every top-level `pstack/skills/*/SKILL.md` shipped by the Codex manifest appears
once below. `portable` needs no runtime-sensitive edit. `adapted` resolves its
platform-sensitive operations through the runtime contract. `unsupported`
contains an explicit Codex stop gate and is omitted from the Codex distribution.

| Skill | Classification | Boundary |
|---|---|---|
| `architect` | `adapted` | Plan, delegation, monitoring, and model roles are mapped. |
| `arena` | `adapted` | Delegation, isolation, judging, and model roles are mapped. |
| `automate-me` | `unsupported` | Needs an approved Codex history source and personal skill destination. |
| `blast-radius` | `portable` | Repository evidence and executable checks only. |
| `bro` | `portable` | Pure response transformation. |
| `create-verification-skill` | `adapted` | Skill destination and browser driving are mapped. |
| `figure-it-out` | `adapted` | Plan, delegation, and skill authoring are mapped. |
| `how` | `adapted` | Exploration, monitoring, and model roles are mapped. |
| `interrogate` | `adapted` | Independent reviewers and model roles are mapped. |
| `maintain-verification-skill` | `adapted` | Skill location, delegation, and live driving are mapped. |
| `make-bot-ui` | `unsupported` | Needs Cursor routines, secret cards, and webhook semantics. |
| `no-comments` | `adapted` | Uses independent policy-review delegation with an inert packaged Comment Sicko reference. |
| `poteto-mode` | `adapted` | Runtime capabilities and unsupported routes are gated. |
| `principle-boundary-discipline` | `portable` | Platform-neutral principle. |
| `principle-build-the-lever` | `portable` | Platform-neutral principle. |
| `principle-encode-lessons-in-structure` | `portable` | Platform-neutral principle. |
| `principle-exhaust-the-design-space` | `portable` | Platform-neutral principle. |
| `principle-experience-first` | `portable` | Platform-neutral principle. |
| `principle-fix-root-causes` | `portable` | Platform-neutral principle. |
| `principle-foundational-thinking` | `portable` | Platform-neutral principle. |
| `principle-guard-the-context-window` | `portable` | Platform-neutral principle. |
| `principle-laziness-protocol` | `portable` | Platform-neutral principle. |
| `principle-make-operations-idempotent` | `portable` | Platform-neutral principle. |
| `principle-migrate-callers-then-delete-legacy-apis` | `portable` | Platform-neutral principle. |
| `principle-minimize-reader-load` | `portable` | Platform-neutral principle. |
| `principle-model-the-domain` | `portable` | Platform-neutral principle. |
| `principle-never-block-on-the-human` | `portable` | Platform-neutral principle. |
| `principle-outcome-oriented-execution` | `portable` | Platform-neutral principle. |
| `principle-prove-it-works` | `portable` | Platform-neutral principle. |
| `principle-redesign-from-first-principles` | `portable` | Platform-neutral principle. |
| `principle-separate-before-serializing-shared-state` | `portable` | Platform-neutral principle. |
| `principle-sequence-verifiable-units` | `portable` | Platform-neutral principle. |
| `principle-subtract-before-you-add` | `portable` | Platform-neutral principle. |
| `principle-type-system-discipline` | `portable` | Platform-neutral principle. |
| `recall` | `unsupported` | Needs an explicitly authorized Codex task-history adapter. |
| `reflect` | `adapted` | Active conversation, delegation, and skill authoring are mapped. |
| `setup-pstack` | `unsupported` | Cursor `.mdc` model rules are ignored; Codex uses runtime-exposed task and delegation model controls. |
| `show-me-your-work` | `adapted` | Active conversation and independent review are mapped. |
| `swarm` | `adapted` | Delegation, isolation, monitoring, and model roles are mapped. |
| `tdd` | `portable` | Repository tests and executable checks only. |
| `teach` | `portable` | Composes shared skills and inherits their gates. |
| `technical-writing` | `portable` | Platform-neutral writing guidance. |
| `typescript-best-practices` | `portable` | Platform-neutral language guidance. |
| `unslop` | `portable` | Pure prose transformation. |
| `why` | `adapted` | Evidence discovery, delegation, and model roles are mapped. |

## Unsupported Poteto Mode routes in the first Codex release

`autonomous-run`, `autopilot-full`, `autopilot-stack`, `babysit`, `eval`,
`multi-phase-plan`, `session-pickup`, `shipping`, and `worktree-cleanup` depend on excluded Cursor
loops, cloud agents, transcripts, sidebar state, or scripts. The Codex
distribution replaces each with an explicit stop stub. `poteto-mode` stops before
entering them and never reports their result as successful.

`orchestrate` is supported through the `codex-local-session` profile. It ships
only its Bun SQLite runtime and uses explicit worktrees, exact commit evidence,
one integration writer, and conservative restart recovery.

Packaged source may still contain excluded agents, automations, and utility files
for Cursor. No Codex mapping, supported skill, or generated Codex playbook may
invoke those paths.
