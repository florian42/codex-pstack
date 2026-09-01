/**
 * Named vocabularies for the per-target term scan.
 *
 * `codex-banned-platform-terms` is the list the single-target validator carried
 * inline. It stays one undivided vocabulary here; splitting it into
 * cursor-exclusive, claude-exclusive and shared vocabularies is a later change.
 */
const VOCABULARIES = {
  "codex-banned-platform-terms": [
    ["Cursor name", /\bCursor(?:'s)?\b/g],
    ["Cursor path", /(?:~\/|\.)\.cursor\//g],
    ["Cursor AskQuestion", /\bAskQuestion\b/g],
    ["Cursor Task delegation", /`Task`|\bTask (?:tool|calls?|prompts?)\b/g],
    ["Cursor background flag", /\brun_in_background\b/g],
    ["Cursor agent type", /\b(?:subagent_type|generalPurpose)\b/g],
    ["Cursor model slug", /\b(?:claude-(?:fable|opus)|grok-)[a-z0-9.-]*\b/g],
    ["Cursor automation URL", /\bcursor\.sh\b/g],
    ["Cursor loop command", /`\/loop`/g],
    ["Cursor transcript path", /\bagent-transcripts\b/g],
  ],
  "codex-banned-playbook-terms": [
    ["Cursor-only plugin package", /\bcursor-team-kit\b/g],
    ["Cursor-only model slug", /\bgpt-5\.6-sol-max\b/g],
    ["destructive checkout recovery", /\bgit reset --hard\b/g],
    ["unsupported cleanup command", /`?\/deslop`?/g],
  ],
  "codex-delegation-terms": [["Cursor delegation term", /\bTask\b|\bsubagent_type\b/g]],
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
