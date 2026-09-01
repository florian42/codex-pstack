#!/usr/bin/env node
/**
 * Headless behavior smoke tests for the Claude Code pstack package.
 *
 * Each case drives `claude -p` with the generated plugin loaded and asserts on
 * the observed tool-call stream and the fixture working tree, never on prose
 * alone. Cases that call a model need credentials (ANTHROPIC_API_KEY for
 * --bare, or a logged-in session otherwise) and cost tokens; run them nightly
 * or on demand, not as a pull-request gate.
 *
 * Usage:
 *   node scripts/smoke/claude-behavior-smoke.mjs [--plugin-dir <dir>] [--case <name>]...
 *       [--bare] [--model <alias>] [--max-budget-usd <n>] [--list] [--eval]
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const options = { pluginDir: resolve(root, "plugins/claude-code/pstack"), cases: [], bare: false, model: null, budget: "3" };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--plugin-dir") options.pluginDir = resolve(argv[++i]);
  else if (arg === "--case") options.cases.push(argv[++i]);
  else if (arg === "--bare") options.bare = true;
  else if (arg === "--model") options.model = argv[++i];
  else if (arg === "--max-budget-usd") options.budget = argv[++i];
  else if (arg === "--list") options.list = true;
  else if (arg === "--eval") options.eval = true;
  else throw new Error(`unknown argument ${arg}`);
}

function fixture(name) {
  const dir = mkdtempSync(join(tmpdir(), `pstack-smoke-${name}-`));
  cpSync(resolve(root, "scripts/smoke/fixtures", name), dir, { recursive: true });
  run("git", ["init", "-q"], dir);
  run("git", ["-c", "user.name=smoke", "-c", "user.email=smoke@example.invalid", "add", "-A"], dir);
  run("git", ["-c", "user.name=smoke", "-c", "user.email=smoke@example.invalid", "commit", "-q", "-m", "fixture"], dir);
  return dir;
}

function run(command, args, cwd, input) {
  return spawnSync(command, args, { cwd, encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
}

/** Run one headless session and return {events, tools, result, init, exitCode}. */
function claude(prompt, { cwd, allowed = [], disallowed = [], maxTurns = 12, permissionMode = "dontAsk", appendSystem }) {
  const args = ["-p", "--plugin-dir", options.pluginDir, "--output-format", "stream-json", "--verbose",
    "--permission-mode", permissionMode, "--max-turns", String(maxTurns), "--max-budget-usd", options.budget];
  if (options.bare) args.unshift("--bare");
  if (options.model) args.push("--model", options.model);
  if (allowed.length) args.push("--allowedTools", allowed.join(","));
  if (disallowed.length) args.push("--disallowedTools", disallowed.join(","));
  if (appendSystem) args.push("--append-system-prompt", appendSystem);
  // The prompt goes on stdin: variadic flags such as --allowedTools would otherwise swallow a positional prompt.
  const proc = run("claude", args, cwd, prompt);
  const events = [];
  for (const line of (proc.stdout ?? "").split("\n")) {
    if (!line.trim()) continue;
    try { events.push(JSON.parse(line)); } catch { /* non-JSON line */ }
  }
  const tools = [];
  for (const event of events) {
    const content = event?.message?.content;
    if (event.type !== "assistant" || !Array.isArray(content)) continue;
    for (const block of content) if (block.type === "tool_use") tools.push({ name: block.name, input: block.input ?? {} });
  }
  const init = events.find((event) => event.type === "system" && event.subtype === "init") ?? null;
  const final = events.find((event) => event.type === "result") ?? null;
  return { events, tools, init, result: final?.result ?? "", isError: final?.is_error ?? proc.status !== 0, exitCode: proc.status, stderr: proc.stderr };
}

function bashCommands(tools) {
  return tools.filter((tool) => tool.name === "Bash").map((tool) => String(tool.input.command ?? ""));
}

function assertPluginLoaded(session, failures) {
  if (session.init === null) failures.push("no system/init event; the session did not start");
  else if (Array.isArray(session.init.plugin_errors) && session.init.plugin_errors.length > 0) failures.push(`plugin_errors: ${JSON.stringify(session.init.plugin_errors)}`);
  if (session.isError) failures.push(`session ended in error (exit ${session.exitCode}): ${session.result.slice(0, 300)} ${session.stderr?.slice(0, 300) ?? ""}`);
}

const CASES = {
  "orchestrate-init": {
    model: false,
    run() {
      const failures = [];
      const orch = join(options.pluginDir, "skills/poteto-mode/scripts/orch/session-orch.ts");
      if (!existsSync(orch)) return [`missing runtime ${orch}`];
      const repo = fixture("tiny-repo");
      const store = join(repo, "..", `pstack-smoke-store-${Date.now()}.sqlite`);
      const proc = run("bun", [orch, "init", "--store", store, "--repo", repo, "--program", "smoke", "--integration-writer", "coordinator"], repo);
      if (proc.status !== 0) failures.push(`init exited ${proc.status}: ${proc.stderr}`);
      try { JSON.parse(proc.stdout); } catch { failures.push(`init did not print JSON: ${proc.stdout.slice(0, 200)}`); }
      if (!existsSync(store)) failures.push("SQLite store was not created");
      rmSync(store, { force: true }); rmSync(repo, { recursive: true, force: true });
      return failures;
    },
  },
  discovery: {
    model: true,
    run() {
      const failures = [];
      const cwd = fixture("tiny-repo");
      const session = claude("Without using any tools, list every /pstack: slash command available in this session, one per line, and nothing else.", { cwd, maxTurns: 1 });
      assertPluginLoaded(session, failures);
      for (const skill of ["how", "why"]) if (!session.result.includes(`pstack:${skill}`)) failures.push(`expected /pstack:${skill} in the listing`);
      for (const skill of ["setup-pstack", "make-bot-ui", "recall", "automate-me"]) if (session.result.includes(`pstack:${skill}`)) failures.push(`omitted skill /pstack:${skill} is listed`);
      rmSync(cwd, { recursive: true, force: true });
      return failures;
    },
  },
  "readonly-investigation": {
    model: true,
    run() {
      const failures = [];
      const cwd = fixture("tiny-repo");
      const session = claude("/pstack:poteto-mode investigate how this repository validates changes. Do not edit anything. Name the files and commands and state which runtime mapping you used.", {
        cwd, maxTurns: 12, allowed: ["Read", "Glob", "Grep", "Agent", "TaskCreate", "TaskUpdate", "Bash(git status *)", "Bash(cat *)", "Bash(ls *)"], disallowed: ["Edit", "Write", "NotebookEdit"],
      });
      assertPluginLoaded(session, failures);
      const writes = session.tools.filter((tool) => ["Edit", "Write", "NotebookEdit"].includes(tool.name));
      if (writes.length) failures.push(`write tools were called: ${writes.map((tool) => tool.name).join(", ")}`);
      const status = run("git", ["status", "--porcelain"], cwd).stdout.trim();
      if (status) failures.push(`fixture tree is dirty after investigation:\n${status}`);
      if (!/check\.sh/.test(session.result)) failures.push("result does not name scripts/check.sh");
      if (!/claude[- ]code/i.test(session.result)) failures.push("result does not name the Claude Code runtime mapping");
      rmSync(cwd, { recursive: true, force: true });
      return failures;
    },
  },
  "unsupported-stop": {
    model: true,
    run() {
      const failures = [];
      const cwd = fixture("tiny-repo");
      const session = claude("/pstack:poteto-mode use the shipping playbook to land this repository's current branch. Merge whatever is green.", {
        cwd, maxTurns: 8, allowed: ["Read", "Glob", "Grep", "Bash(git status *)", "Bash(git log *)"], disallowed: ["Edit", "Write"],
      });
      assertPluginLoaded(session, failures);
      const dangerous = bashCommands(session.tools).filter((command) => /\bgh pr merge\b|\bgt\b|\bgit push\b|\bgit merge\b/.test(command));
      if (dangerous.length) failures.push(`merge or push commands were attempted: ${dangerous.join(" | ")}`);
      if (!/unsupported/i.test(session.result)) failures.push("result does not say the route is unsupported");
      rmSync(cwd, { recursive: true, force: true });
      return failures;
    },
  },
  "no-comments-delegation": {
    model: true,
    run() {
      const failures = [];
      const cwd = fixture("comment-repo");
      const session = claude("/pstack:no-comments src/greeter.mjs", { cwd, maxTurns: 16, allowed: ["Read", "Glob", "Grep", "Agent", "Edit", "Bash(git diff *)", "Bash(git status *)"] });
      assertPluginLoaded(session, failures);
      const reviewer = session.tools.find((tool) => tool.name === "Agent" && /comment-sicko/.test(String(tool.input.subagent_type ?? "")));
      if (!reviewer) failures.push(`no Agent call with subagent_type comment-sicko; agents called: ${session.tools.filter((tool) => tool.name === "Agent").map((tool) => tool.input.subagent_type).join(", ") || "none"}`);
      const file = readFileSync(join(cwd, "src/greeter.mjs"), "utf8");
      if (/Build the greeting string/.test(file)) failures.push("narration comment survived");
      if (!/Public API/.test(file)) failures.push("public API doc comment was removed");
      if (!/return `Hello, \$\{name\}!`/.test(file)) failures.push("application code changed");
      rmSync(cwd, { recursive: true, force: true });
      return failures;
    },
  },
};

if (options.list) { console.log(Object.keys(CASES).join("\n")); process.exit(0); }
if (options.eval) {
  // Early-access gate: an empty directory reports "No eval cases found" when enabled.
  const probe = run("claude", ["plugin", "eval"], mkdtempSync(join(tmpdir(), "pstack-eval-probe-")));
  if (/early access/i.test(`${probe.stdout}${probe.stderr}`)) { console.log("skip: claude plugin eval is gated by early access in this environment"); process.exit(0); }
  const copy = mkdtempSync(join(tmpdir(), "pstack-eval-plugin-"));
  cpSync(options.pluginDir, copy, { recursive: true });
  cpSync(resolve(root, "scripts/smoke/evals"), join(copy, "evals"), { recursive: true });
  const evalProc = spawnSync("claude", ["plugin", "eval", copy, "--no-publish", "--allow-tools", "Edit", ...(options.model ? ["--model", options.model] : [])], { cwd: fixture("comment-repo"), stdio: "inherit" });
  rmSync(copy, { recursive: true, force: true });
  process.exit(evalProc.status ?? 1);
}
const selected = options.cases.length ? options.cases : Object.keys(CASES);
let failed = 0;
for (const name of selected) {
  const definition = CASES[name];
  if (!definition) { console.error(`unknown case ${name}`); failed += 1; continue; }
  if (definition.model && !existsSync(options.pluginDir)) { console.error(`skip ${name}: plugin dir ${options.pluginDir} is missing`); failed += 1; continue; }
  const started = Date.now();
  let failures;
  try { failures = definition.run(); } catch (error) { failures = [`threw: ${error.message}`]; }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length === 0) console.log(`ok   ${name} (${seconds}s)`);
  else { failed += 1; console.log(`FAIL ${name} (${seconds}s)`); for (const failure of failures) console.log(`     - ${failure}`); }
}
process.exit(failed === 0 ? 0 : 1);
