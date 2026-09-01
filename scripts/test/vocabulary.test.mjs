import assert from "node:assert/strict";
import test from "node:test";

import { findVocabularyMatches, resolveVocabularies, vocabularyNames } from "../lib/vocabulary.mjs";

/** The vocabularies the Codex target bans. */
const CODEX_BANNED = ["cursor-exclusive", "cursor-shared-with-claude", "claude-exclusive"];

/** What a Claude Code target would ban: the Cursor-only and Codex-only terms. */
const CLAUDE_BANNED = ["cursor-exclusive", "codex-exclusive"];

function matched(names, text) {
  return findVocabularyMatches(names, text).map((finding) => finding.match);
}

test("every named vocabulary resolves to fresh global regular expressions", () => {
  for (const name of vocabularyNames()) {
    const terms = resolveVocabularies([name]);
    assert.ok(terms.length > 0, `${name} must not be empty`);
    for (const [label, expression] of terms) {
      assert.equal(typeof label, "string");
      assert.ok(expression instanceof RegExp);
      assert.ok(expression.global, `${label} must be a global expression`);
      assert.equal(expression.lastIndex, 0);
    }
  }
});

test("spawn_agent matches for a target that bans codex-exclusive", () => {
  assert.deepEqual(matched(CLAUDE_BANNED, "Delegate with spawn_agent."), ["spawn_agent"]);
});

test("subagent_type does not match for a target that omits cursor-shared-with-claude", () => {
  assert.deepEqual(matched(CLAUDE_BANNED, "Delegate with subagent_type."), []);
  assert.deepEqual(matched(CODEX_BANNED, "Delegate with subagent_type."), ["subagent_type"]);
});

test("Cursor matches cursor-exclusive", () => {
  assert.deepEqual(matched(["cursor-exclusive"], "Run this in Cursor."), ["Cursor"]);
  assert.deepEqual(matched(CODEX_BANNED, "Run this in Cursor."), ["Cursor"]);
});

test("the Codex target does not ban its own vocabulary", () => {
  assert.deepEqual(matched(CODEX_BANNED, "Codex runs update_plan and spawn_agent."), []);
});

test("claude-exclusive terms are banned for the Codex target", () => {
  assert.deepEqual(matched(CODEX_BANNED, "Ask with AskUserQuestion."), ["AskUserQuestion"]);
  assert.deepEqual(matched(CODEX_BANNED, "Track work with TaskCreate and TaskUpdate."), [
    "TaskCreate",
    "TaskUpdate",
  ]);
  assert.deepEqual(matched(CODEX_BANNED, "Read ~/.claude/settings.json."), ["~/.claude/"]);
});

test("an unknown vocabulary is a hard error naming the known set", () => {
  assert.throws(
    () => resolveVocabularies(["nope"]),
    (error) => error.message.includes('unknown vocabulary "nope"') && error.message.includes("cursor-exclusive"),
  );
});
