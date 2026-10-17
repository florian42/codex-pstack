---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

## Runtime boundary

Read the [runtime contract](../../references/runtime/contract.md). Use the current runtime's delegation, monitoring, model-role, blocking-question, skill-authoring, and active-conversation mappings. If compaction makes the active conversation incomplete, the parent writes a tight session digest and labels it as a digest. Never guess a history path or read another task's history.

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Prepare the active conversation

Before fanning out, resolve the active-conversation source through the runtime mapping. Pass that source or a parent-written digest through the delegation brief. Do not search filesystem history outside the current workspace or task. If the mapping cannot provide an authorized source, stop and report reflection as blocked.

## 2. Spawn three reviewers in parallel

Delegate three reviewers concurrently through the runtime mapping. Reviewers need connector access to look up the tickets, chat threads, and observability traces the conversation references, so forbid file writes in the brief without selecting a mode that strips tools.

Each reviewer and the synthesizer name a role in the runtime's model-role mapping. Use only models the current runtime exposes. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.

| Lens | Model role | Prompt template |
|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the conversation source or digest where marked. Reviewers return findings through the runtime's delegation result.

## 3. Synthesize

Delegate one synthesis pass with the `reflect judgment, divergent, synthesizer` role. Preserve connector access because it spot-verifies citations, but forbid writes in the brief. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list. If this delegation cannot run, stop and report reflection as blocked rather than applying unreviewed skill edits.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the runtime's skill-authoring capability and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to the skill-authoring capability and run its description-optimization loop.
- `new skill via skill authoring: <kebab-name>`: hand creation to the skill-authoring capability. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
