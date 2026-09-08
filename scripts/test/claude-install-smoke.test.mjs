import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../smoke/claude-install-smoke.sh", import.meta.url));
const cases = [
  ["accepts alphabetical order", "Agents (2)  comment-sicko, poteto-agent", 0],
  ["accepts the order from the failed CI run", "Agents (2)  poteto-agent, comment-sicko", 0],
  ["accepts whitespace around names", "Agents (2)\t poteto-agent \t,\t comment-sicko  ", 0],
  ["rejects a missing name", "Agents (2)  comment-sicko", 1],
  ["rejects an extra name", "Agents (2)  comment-sicko, poteto-agent, extra-agent", 1],
  ["rejects a wrong name", "Agents (2)  comment-sicko, wrong-agent", 1],
  ["rejects duplicate names", "Agents (2)  comment-sicko, poteto-agent, poteto-agent", 1],
  ["rejects a wrong reported count", "Agents (3)  comment-sicko, poteto-agent", 1],
  ["rejects an absent inventory", "", 1],
];

for (const [name, agents, status] of cases) {
  test(name, (t) => {
    const repo = mkdtempSync(join(tmpdir(), "pstack-install-test-"));
    t.after(() => rmSync(repo, { recursive: true, force: true }));
    const skills = ["alpha", "poteto-mode", "no-comments", "how", "swarm"];
    for (const skill of skills) {
      const directory = join(repo, "plugins/claude-code/pstack/skills", skill);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "SKILL.md"), "");
    }
    const bin = join(repo, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "claude"), `#!/usr/bin/env bash
case "$*" in
  "plugin marketplace add "*|"plugin install pstack@pstack-claude -s user") exit 0 ;;
  "plugin details pstack") printf '%s\\n' "$PSTACK_TEST_DETAILS" ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 });
    const result = spawnSync("bash", [script, repo], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PSTACK_TEST_DETAILS: `Skills (${skills.length})  ${skills.join(", ")}\n${agents}`,
      },
    });
    assert.equal(result.status, status, result.stderr || result.stdout);
    if (status === 0) assert.match(result.stdout, /ok: pstack@pstack-claude resolves/);
    else assert.match(result.stderr, /fail: agents line was/);
  });
}
