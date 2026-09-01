import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = process.env.ORCH_SCRIPT ?? join(import.meta.dir, "session-orch.ts");
const directories: string[] = [];

function git(repo: string, ...args: readonly string[]): string {
  const result = Bun.spawnSync(["git", "-C", repo, ...args]);
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

async function repository(): Promise<{ readonly root: string; readonly repo: string }> {
  const root = await mkdtemp(join(tmpdir(), "session-orch-cli-"));
  directories.push(root);
  const repo = join(root, "repo");
  await mkdir(repo);
  git(repo, "init", "--initial-branch=main");
  git(repo, "config", "user.name", "Orchestrate Test");
  git(repo, "config", "user.email", "orchestrate@example.com");
  await writeFile(join(repo, "README.md"), "base\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "base");
  return { root, repo };
}

function run(args: readonly string[]): { readonly code: number; readonly json: unknown; readonly stderr: string } {
  const result = Bun.spawnSync([process.execPath, SCRIPT, ...args]);
  const stdout = result.stdout.toString().trim();
  return {
    code: result.exitCode,
    json: stdout.length === 0 ? null : JSON.parse(stdout),
    stderr: result.stderr.toString(),
  };
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Codex Orchestrate CLI", () => {
  it("runs a durable exact-SHA program and recovers an interrupted attempt", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const report = join(root, "report.md");
    const receipt = join(root, "receipt.md");
    const brief = join(root, "brief.md");
    const worktree = join(root, "unit-worktree");
    await writeFile(brief, "GOAL inspect and implement\nACCEPTANCE tests pass\n");

    expect(run(["init", "--store", store, "--repo", repo, "--program", "demo"]).code).toBe(0);
    expect(run(["plan", "bad-code", "--store", store, "--worktree", repo, "--brief", brief]).stderr).toContain(
      "--worktree must be distinct from the integration checkout",
    );
    expect(run(["plan", "analysis", "--store", store, "--checkout", "read-only", "--brief", brief]).code).toBe(0);
    expect(run(["dispatch", "analysis", "--store", store, "--attempt", "analysis-1"]).json).toMatchObject({
      kind: "dispatch",
      brief: "GOAL inspect and implement\nACCEPTANCE tests pass\n",
    });
    expect(run(["recover", "--store", store, "--session", "session-2"]).json).toEqual({
      interrupted: ["analysis"],
    });

    git(repo, "worktree", "add", "-b", "orch/unit", worktree);
    await writeFile(join(worktree, "unit.txt"), "unit\n");
    git(worktree, "add", "unit.txt");
    git(worktree, "commit", "-m", "unit");
    const commit = git(worktree, "rev-parse", "HEAD");
    await writeFile(report, "implemented and tested\n");
    await writeFile(receipt, "tests passed\n");

    expect(run(["plan", "code", "--store", store, "--worktree", worktree, "--brief", brief]).code).toBe(0);
    expect(run(["dispatch", "code", "--store", store, "--attempt", "code-1"]).code).toBe(0);
    expect(run(["report", "code", "--store", store, "--attempt", "code-1", "--report", report, "--commit", commit]).code).toBe(0);
    expect(run(["verify", "code", "--store", store, "--commit", commit, "--receipt", receipt]).code).toBe(0);
    expect(run(["integrate", "code", "--store", store, "--actor", "coordinator"]).code).toBe(0);
    expect(run(["integrate", "code", "--store", store, "--actor", "coordinator"]).code).toBe(0);

    const status = run(["status", "--store", store]);
    expect(status.code).toBe(0);
    expect(status.json).toMatchObject({
      profile: "codex-local-session",
      counts: { integrated: 1, planned: 1 },
    });
    expect(git(repo, "rev-parse", "HEAD")).toBe(commit);
  });

  it("blocks recovery on repository drift without consuming the dispatch", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const brief = join(root, "brief.md");
    await writeFile(brief, "GOAL audit\n");
    expect(run(["init", "--store", store, "--repo", repo, "--program", "drift"]).code).toBe(0);
    expect(run(["plan", "audit", "--store", store, "--checkout", "read-only", "--brief", brief]).code).toBe(0);
    expect(run(["dispatch", "audit", "--store", store, "--attempt", "audit-1"]).code).toBe(0);

    git(repo, "switch", "-c", "unexpected");
    const blocked = run(["recover", "--store", store, "--session", "session-2"]);
    expect(blocked.code).toBe(1);
    expect(blocked.stderr).toContain("recovery blocked: expected branch main");

    git(repo, "switch", "main");
    expect(run(["recover", "--store", store, "--session", "session-3"]).json).toEqual({
      interrupted: ["audit"],
    });
  });

  it("reconciles a fast-forward that committed before its journal event", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const brief = join(root, "brief.md");
    const report = join(root, "report.md");
    const receipt = join(root, "receipt.md");
    const worktree = join(root, "unit-worktree");
    await writeFile(brief, "GOAL implement\n");
    await writeFile(report, "done\n");
    await writeFile(receipt, "passed\n");
    expect(run(["init", "--store", store, "--repo", repo, "--program", "crash"]).code).toBe(0);
    git(repo, "worktree", "add", "-b", "orch/crash", worktree);
    await writeFile(join(worktree, "change.txt"), "change\n");
    git(worktree, "add", "change.txt");
    git(worktree, "commit", "-m", "change");
    const commit = git(worktree, "rev-parse", "HEAD");
    expect(run(["plan", "code", "--store", store, "--worktree", worktree, "--brief", brief]).code).toBe(0);
    expect(run(["dispatch", "code", "--store", store, "--attempt", "code-1"]).code).toBe(0);
    expect(run(["report", "code", "--store", store, "--attempt", "code-1", "--report", report, "--commit", commit]).code).toBe(0);
    expect(run(["verify", "code", "--store", store, "--commit", commit, "--receipt", receipt]).code).toBe(0);

    git(repo, "merge", "--ff-only", commit);
    expect(run(["recover", "--store", store, "--session", "session-2"]).code).toBe(0);
    expect(run(["status", "--store", store]).json).toMatchObject({ counts: { integrated: 1 } });
  });

  it("dispatches two worktree units concurrently on claude-local-session", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const brief = join(root, "brief.md");
    const report = join(root, "report.md");
    const receipt = join(root, "receipt.md");
    const worktreeA = join(root, "unit-a");
    const worktreeB = join(root, "unit-b");
    await writeFile(brief, "GOAL implement\n");
    await writeFile(report, "done\n");
    await writeFile(receipt, "passed\n");

    const init = run([
      "init",
      "--store",
      store,
      "--repo",
      repo,
      "--program",
      "parallel",
      "--profile",
      "claude-local-session",
    ]);
    expect(init.code).toBe(0);
    expect(init.json).toMatchObject({
      profile: "claude-local-session",
      maxCodeDispatches: "unbounded",
    });

    git(repo, "worktree", "add", "-b", "orch/unit-a", worktreeA);
    git(repo, "worktree", "add", "-b", "orch/unit-b", worktreeB);
    expect(run(["plan", "unit-a", "--store", store, "--worktree", worktreeA, "--brief", brief]).code).toBe(0);
    expect(run(["plan", "unit-b", "--store", store, "--worktree", worktreeB, "--brief", brief]).code).toBe(0);

    // The claim under test: both code workers hold a dispatch at once.
    expect(run(["dispatch", "unit-a", "--store", store, "--attempt", "unit-a-1"]).code).toBe(0);
    const secondDispatch = run(["dispatch", "unit-b", "--store", store, "--attempt", "unit-b-1"]);
    expect(secondDispatch.stderr).toBe("");
    expect(secondDispatch.code).toBe(0);
    expect(run(["status", "--store", store]).json).toMatchObject({ counts: { dispatched: 2 } });

    await writeFile(join(worktreeA, "a.txt"), "a\n");
    git(worktreeA, "add", "a.txt");
    git(worktreeA, "commit", "-m", "a");
    const commitA = git(worktreeA, "rev-parse", "HEAD");
    expect(run(["report", "unit-a", "--store", store, "--attempt", "unit-a-1", "--report", report, "--commit", commitA]).code).toBe(0);
    expect(run(["verify", "unit-a", "--store", store, "--commit", commitA, "--receipt", receipt]).code).toBe(0);
    expect(run(["integrate", "unit-a", "--store", store, "--actor", "coordinator"]).code).toBe(0);

    // Integration stays serial and fast-forward only: the second writer
    // rebases onto the new head before its own commit is accepted.
    git(worktreeB, "merge", "--ff-only", "main");
    await writeFile(join(worktreeB, "b.txt"), "b\n");
    git(worktreeB, "add", "b.txt");
    git(worktreeB, "commit", "-m", "b");
    const commitB = git(worktreeB, "rev-parse", "HEAD");
    expect(run(["report", "unit-b", "--store", store, "--attempt", "unit-b-1", "--report", report, "--commit", commitB]).code).toBe(0);
    expect(run(["verify", "unit-b", "--store", store, "--commit", commitB, "--receipt", receipt]).code).toBe(0);
    const outsider = run(["integrate", "unit-b", "--store", store, "--actor", "someone-else"]);
    expect(outsider.code).toBe(1);
    expect(outsider.stderr).toContain("integration is owned by coordinator");
    expect(run(["integrate", "unit-b", "--store", store, "--actor", "coordinator"]).code).toBe(0);

    expect(run(["status", "--store", store]).json).toMatchObject({ counts: { integrated: 2 } });
    expect(git(repo, "rev-parse", "HEAD")).toBe(commitB);
  });

  it("keeps one code dispatch on the default codex profile", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const brief = join(root, "brief.md");
    const worktreeA = join(root, "unit-a");
    const worktreeB = join(root, "unit-b");
    await writeFile(brief, "GOAL implement\n");

    expect(run(["init", "--store", store, "--repo", repo, "--program", "serial"]).json).toMatchObject({
      profile: "codex-local-session",
      maxCodeDispatches: 1,
    });
    git(repo, "worktree", "add", "-b", "orch/unit-a", worktreeA);
    git(repo, "worktree", "add", "-b", "orch/unit-b", worktreeB);
    expect(run(["plan", "unit-a", "--store", store, "--worktree", worktreeA, "--brief", brief]).code).toBe(0);
    expect(run(["plan", "unit-b", "--store", store, "--worktree", worktreeB, "--brief", brief]).code).toBe(0);
    expect(run(["dispatch", "unit-a", "--store", store, "--attempt", "unit-a-1"]).code).toBe(0);
    const blocked = run(["dispatch", "unit-b", "--store", store, "--attempt", "unit-b-1"]);
    expect(blocked.code).toBe(1);
    expect(blocked.stderr).toContain("code dispatch limit reached: unit-a is already dispatched (limit 1)");
  });

  it("rejects an unknown profile", async () => {
    const { root, repo } = await repository();
    const store = join(root, "state", "program.sqlite");
    const rejected = run(["init", "--store", store, "--repo", repo, "--program", "x", "--profile", "cursor-local"]);
    expect(rejected.code).toBe(1);
    expect(rejected.stderr).toContain("--profile supports only codex-local-session or claude-local-session");
  });
});
