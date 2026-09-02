/**
 * Named vocabularies for the per-target term scan.
 *
 * Every regular expression is a code literal here; a build config only names
 * the vocabularies its target bans. The platform vocabularies are split by
 * which platforms own a term:
 *
 * - `cursor-exclusive`: terms only Cursor understands.
 * - `cursor-shared-with-claude`: terms Cursor and Claude Code share, which no
 *   other target understands.
 * - `codex-exclusive`: terms only Codex understands.
 * - `claude-exclusive`: terms only Claude Code understands.
 *
 * A target bans the vocabularies belonging to the platforms it is not, so the
 * Codex target bans the three non-Codex vocabularies.
 *
 * `codex-banned-playbook-terms` stays a Codex-only bundle vocabulary: it is not
 * a platform vocabulary but the set of terms a *supported* Codex playbook must
 * not use.
 */
const VOCABULARIES = {
  "cursor-exclusive": [
    ["Cursor name", /\bCursor(?:'s)?\b/g],
    ["Cursor path", /(?:~\/|\.)\.cursor\//g],
    ["Cursor AskQuestion", /\bAskQuestion\b/g],
    ["Cursor agent type", /\bgeneralPurpose\b/g],
    ["Cursor automation URL", /\bcursor\.sh\b/g],
    ["Cursor-only plugin package", /\bcursor-team-kit\b/g],
    ["Cursor transcript path", /\bagent-transcripts\b/g],
    ["Cursor model slug", /\b(?:grok-|gpt-5\.6-sol)[a-z0-9.-]*\b/g],
    ["Cursor automation owner", /\bBenny\b/g],
    ["Cursor rule file extension", /\.mdc\b/g],
  ],
  "cursor-shared-with-claude": [
    ["Task delegation", /`Task`|\bTask (?:tool|calls?|prompts?)\b/g],
    ["background execution flag", /\brun_in_background\b/g],
    ["delegation agent type", /\bsubagent_type\b/g],
    ["loop command", /`\/loop`/g],
    ["Anthropic model slug", /\bclaude-(?:fable|opus)[a-z0-9.-]*\b/g],
  ],
  "codex-exclusive": [
    ["Codex name", /\bCodex\b/g],
    ["Codex delegation call", /\bspawn_agent\b/g],
    ["Codex plan tool", /\bupdate_plan\b/g],
    ["Codex path", /(?:~\/|\.)\.codex\//g],
    ["Codex orchestrate runtime", /\bcodex-orch\b/g],
  ],
  "claude-exclusive": [
    ["Claude Code question tool", /\bAskUserQuestion\b/g],
    ["Claude Code task tool", /\bTask(?:Create|Update)\b/g],
    ["Claude Code Agent delegation", /`Agent`|\bAgent tool\b/g],
    ["Claude Code path", /(?:~\/|\.)\.claude\//g],
    ["Claude Code worktree isolation", /\bisolation:\s*"worktree"/g],
  ],
  "codex-banned-playbook-terms": [
    ["Cursor-only plugin package", /\bcursor-team-kit\b/g],
    ["Cursor-only model slug", /\bgpt-5\.6-sol-max\b/g],
    ["destructive checkout recovery", /\bgit reset --hard\b/g],
    ["unsupported cleanup command", /`?\/deslop`?/g],
  ],
};

export function vocabularyNames() {
  return Object.keys(VOCABULARIES);
}

/** Resolve named vocabularies into a flat list of fresh `[label, regexp]` pairs. */
export function resolveVocabularies(names) {
  const terms = [];
  for (const name of names) {
    const vocabulary = VOCABULARIES[name];
    if (vocabulary === undefined) {
      throw new Error(
        `unknown vocabulary ${JSON.stringify(name)}; known vocabularies: ${vocabularyNames().join(", ")}`,
      );
    }
    for (const [label, expression] of vocabulary) {
      terms.push([label, new RegExp(expression.source, expression.flags)]);
    }
  }
  return terms;
}

/**
 * Every match of the named vocabularies in `text`, as
 * `{ label, match, index }`. The scan in the validator adds file and line.
 */
export function findVocabularyMatches(names, text) {
  const found = [];
  for (const [label, expression] of resolveVocabularies(names)) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression)) {
      found.push({ label, match: match[0], index: match.index });
    }
  }
  return found;
}
