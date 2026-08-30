---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

## Runtime boundary

Read the [runtime contract](../../references/runtime/contract.md). Use the current runtime's delegation, monitoring, model-role, blocking-question, skill-authoring, and active-conversation mappings. If compaction makes the active conversation incomplete, the parent writes a tight session digest and labels it as a digest. Never guess a history path or read another task's history.

Mine the current conversation for durable learnings, then route them into skill edits.

## When to invoke

- The user said "reflect" or "/reflect".
- A complex task (5+ tool calls) just landed cleanly and the recipe is worth keeping.
- The agent hit dead ends, found the working path, and the path generalizes.
- The user corrected the agent's approach mid-task.
- A non-trivial workflow emerged that isn't captured anywhere.

Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## Process

### 1. Prepare the active conversation

Resolve the active-conversation source through the runtime mapping. Pass that source or a parent-written digest through the delegation brief. Do not search filesystem history outside the current workspace or task. If the mapping cannot provide an authorized source, stop and report reflection as blocked.

### 2. Spawn three reviewers in parallel

Delegate three reviewers concurrently through the runtime mapping. Reviewers may need connector access for cited context lookups, so forbid file writes in the brief without selecting a mode that strips tools.

| Lens | Model role | Prompt template |
|---|---|---|
| Judgment | strong judgment | `references/judgment-reviewer.md` |
| Tooling | strong implementer | `references/tooling-reviewer.md` |
| Divergent | strong judgment | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the conversation source or digest where marked. Reviewers return findings through the runtime's delegation result.

### 3. Synthesize

Delegate one synthesis pass using the runtime's strong judgment role. Preserve connector access because the quality check spot-verifies citations, but forbid writes in the brief. Use `references/synthesizer.md` verbatim, with each reviewer's output inlined where marked. If this delegation cannot run, stop and report reflection as blocked rather than applying unreviewed skill edits.

### 4. Structural enforcement check

Sanity-check the synthesizer's Accepted list. For any item that would be enforced more reliably by a lint rule, script, metadata flag, or runtime check, move it from Accepted to Backlog. The synthesizer already applies this criterion; this is a final pass before edits land. See the **encode-lessons-in-structure** principle skill.

### 5. Apply

Before applying any Accepted edit, present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval. The user picks which subset to apply and may redirect routings. Skill changes affect every future agent in the org; do not auto-apply.

Backlog items file to whatever devex / backlog tracker your team uses automatically. Those are tracker submissions, not skill edits. Only the Accepted list waits for approval.

For each approved Accepted item, follow the Routing field exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): parent does directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the runtime's skill-authoring capability and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to the skill-authoring capability and run its description-optimization loop.
- `new skill via skill authoring: <kebab-name>`: hand creation to the skill-authoring capability. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

### 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
