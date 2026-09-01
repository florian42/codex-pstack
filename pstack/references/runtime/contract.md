# Runtime compatibility contract

`pstack/skills/` is the canonical instruction tree for Cursor, Codex, and Claude Code. Shared
skills describe work as capabilities. The runtime-specific references map those
capabilities to real platform operations:

- [Cursor mapping](cursor.md)
- [Codex mapping](codex.md)
- [Claude Code mapping](claude-code.md)
- [Active skill portability](skill-portability.md)

## Resolution rule

Before a skill delegates work, asks a blocking question, tracks a plan, creates
or updates a skill, resolves the active conversation, monitors work, schedules
recurring work, selects a model, or drives a browser, identify the current runtime and read its mapping. Follow the
mapping instead of copying a tool name, model slug, configuration path, or
transcript path from the other runtime.

If the runtime is unknown, use only ordinary filesystem and shell operations.
Do not delegate, schedule, inspect private conversation history, or claim live
browser verification until the runtime is known.

## Shared capability rules

1. **Delegate independent work.** Give each worker a bounded brief and isolated
   write scope. Keep bulk findings out of the parent context. The parent reviews
   artifacts and owns the conclusion.
2. **Delegate an independent policy reviewer.** Request the policy and scope
   from the active runtime mapping. Its result is either `completed` with a
   report and scoped comment-only diff from the exact independent worker, or
   `blocked` with the reason. The parent inspects that diff and rejects
   application-code edits or scope escapes.
   Missing resource, unavailable independent delegation, spawn failure, or a
   failed wait is `blocked`. The parent must report `blocked` and stop before
   self-reviewing or editing; it never substitutes itself.
3. **Ask a blocking question.** Ask only when a missing product choice,
   credential, approval, or irreversible action prevents safe progress.
4. **Track a plan.** Keep one current phase and preserve named required steps.
   A missing plan tool does not remove the planning requirement.
5. **Create or update a skill.** Use the runtime's skill-authoring capability and
   canonical skill location. Never guess another runtime's path.
6. **Resolve the active conversation.** Use only the current task's visible
   context or an explicitly authorized runtime source. If compaction removed
   needed detail, use a parent-written digest and label it. Never guess a
   transcript path or search another task's history.
7. **Monitor long-running work.** Use the runtime's wait or monitor primitive.
   Do not busy-poll or report an unchanged state as progress.
8. **Schedule recurring work.** Use only a real scheduler exposed by the current
   runtime. If none is available, stop and state that recurring execution was
   not scheduled.
9. **Select a model role.** Choose by role and use only models the current
   runtime exposes. A model name from the other runtime is not a fallback.
10. **Verify in a browser.** Prefer the runtime's interactive browser capability.
   Otherwise use a repository-owned browser harness. If neither exists, report
   browser verification as blocked, not passed.

## Unsupported behavior

A mapping may mark a capability or workflow unsupported. On that runtime, stop
before its first side effect, name the missing capability, and point to the
follow-up in [the portability record](skill-portability.md). Never simulate a
successful delegation, schedule, secret handoff, transcript lookup, or browser
drive in prose.
