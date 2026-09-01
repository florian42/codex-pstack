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
});
