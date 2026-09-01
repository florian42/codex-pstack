#!/usr/bin/env bun

import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { initializeJournal, openJournal, sha256, type Journal } from "./journal.ts";
import type { Checkout, ProgramEvent, ProgramView } from "./program.ts";

interface Arguments {
  readonly command: string;
  readonly operands: readonly string[];
  readonly flags: ReadonlyMap<string, string>;
}

function parseArguments(values: readonly string[]): Arguments {
  const operands: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined) continue;
    if (!value.startsWith("--")) {
      operands.push(value);
      continue;
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`${value} requires a value`);
    }
    if (flags.has(value)) throw new Error(`${value} may appear only once`);
    flags.set(value, next);
    index += 1;
  }
  const [command, ...rest] = operands;
  if (command === undefined) throw new Error("a command is required");
  return { command, operands: rest, flags };
}

function flag(args: Arguments, name: string): string {
  const value = args.flags.get(name);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalFlag(args: Arguments, name: string): string | undefined {
  return args.flags.get(name);
}

function operand(args: Arguments, index: number, label: string): string {
  const value = args.operands[index];
  if (value === undefined || value.trim().length === 0) throw new Error(`${label} is required`);
  return value;
}

function git(repo: string, values: readonly string[]): string {
  const result = Bun.spawnSync(["git", "-C", repo, ...values]);
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString().trim();
    throw new Error(detail.length === 0 ? `git ${values.join(" ")} failed` : detail);
  }
  return result.stdout.toString().trim();
}

function isAncestor(repo: string, ancestor: string, descendant: string): boolean {
  const result = Bun.spawnSync([
    "git",
    "-C",
    repo,
    "merge-base",
    "--is-ancestor",
    ancestor,
    descendant,
  ]);
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  const detail = result.stderr.toString().trim();
  throw new Error(detail.length === 0 ? "git merge-base --is-ancestor failed" : detail);
}

function canonicalRepo(path: string): string {
  const root = git(path, ["rev-parse", "--show-toplevel"]);
  return realpathSync(root);
}

function commonGitDirectory(path: string): string {
  const value = git(path, ["rev-parse", "--git-common-dir"]);
  return realpathSync(isAbsolute(value) ? value : resolve(path, value));
}

function commitSha(repo: string, value: string): string {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("commit must be a full lowercase SHA");
  const resolved = git(repo, ["rev-parse", "--verify", `${value}^{commit}`]);
  if (resolved !== value) throw new Error("commit does not resolve to the supplied full SHA");
  return value;
}

function withJournal<T>(store: string, operation: (journal: Journal) => T): T {
  const journal = openJournal(store);
  try {
    return operation(journal);
  } finally {
    journal.close();
  }
}

function unit(program: ProgramView, id: string) {
  const value = program.units.get(id);
  if (value === undefined) throw new Error(`unknown unit ${id}`);
  return value;
}

function status(journal: Journal): unknown {
  const view = journal.view();
  const counts: Record<string, number> = {};
  const units = [...view.units.values()].map((entry) => {
    counts[entry.state.kind] = (counts[entry.state.kind] ?? 0) + 1;
    return { id: entry.spec.id, checkout: entry.spec.checkout, state: entry.state };
  });
  return {
    profile: journal.metadata.profile,
    program: journal.metadata.program,
    repo: journal.metadata.repo,
    integrationWriter: journal.metadata.integrationWriter,
    initialBranch: journal.metadata.initialBranch,
    expectedHead: view.integrationHead ?? journal.metadata.initialHead,
    counts,
    units,
  };
}

function append(journal: Journal, event: ProgramEvent, artifacts: readonly Uint8Array[] = []): unknown {
  journal.append(event, artifacts);
  return status(journal);
}

function run(args: Arguments): unknown {
  if (args.command === "init") {
    const store = flag(args, "--store");
    if (!isAbsolute(store)) throw new Error("--store must be an absolute path");
    const repo = canonicalRepo(flag(args, "--repo"));
    if (git(repo, ["status", "--porcelain"]).length !== 0) {
      throw new Error("repository must be clean at initialization");
    }
    const journal = initializeJournal({
      store,
      repo,
      program: flag(args, "--program"),
      integrationWriter: optionalFlag(args, "--integration-writer") ?? "coordinator",
      initialBranch: git(repo, ["branch", "--show-current"]),
      initialHead: commitSha(repo, git(repo, ["rev-parse", "HEAD"])),
    });
    try {
      return status(journal);
    } finally {
      journal.close();
    }
  }

  const store = resolve(flag(args, "--store"));
  return withJournal(store, (journal) => {
    switch (args.command) {
      case "plan": {
        const id = operand(args, 0, "unit id");
        const worktree = optionalFlag(args, "--worktree");
        const checkoutFlag = optionalFlag(args, "--checkout");
        if ((worktree === undefined) === (checkoutFlag === undefined)) {
          throw new Error("set exactly one of --checkout read-only or --worktree <absolute-path>");
        }
        let checkout: Checkout;
        if (worktree !== undefined) {
          if (!isAbsolute(worktree)) throw new Error("--worktree must be an absolute path");
          const worktreeRoot = canonicalRepo(worktree);
          if (worktreeRoot !== realpathSync(worktree)) {
            throw new Error("--worktree must name a Git worktree root");
          }
          if (worktreeRoot === journal.metadata.repo) {
            throw new Error("--worktree must be distinct from the integration checkout");
          }
          if (commonGitDirectory(worktree) !== commonGitDirectory(journal.metadata.repo)) {
            throw new Error("--worktree must belong to the program repository");
          }
          checkout = { kind: "isolated-worktree", path: worktree };
        } else {
          if (checkoutFlag !== "read-only") throw new Error("--checkout supports only read-only");
          checkout = { kind: "shared-read-only" };
        }
        const brief = readFileSync(flag(args, "--brief"));
        return append(
          journal,
          {
            id: `plan:${id}`,
            kind: "unit-planned",
            unit: { id, checkout, briefDigest: sha256(brief) },
          },
          [brief],
        );
      }
      case "dispatch": {
        const id = operand(args, 0, "unit id");
        const attemptId = flag(args, "--attempt");
        const before = unit(journal.view(), id);
        if (
          before.state.kind !== "planned" &&
          !(before.state.kind === "dispatched" && before.state.attemptId === attemptId)
        ) {
          throw new Error(`cannot dispatch ${id} from ${before.state.kind}`);
        }
        const event: ProgramEvent = {
          id: `dispatch:${attemptId}`,
          kind: "unit-dispatched",
          unitId: id,
          attemptId,
        };
        if (before.state.kind === "planned") journal.append(event, []);
        const plannedUnit = unit(journal.view(), id);
        return {
          kind: "dispatch",
          unitId: id,
          attemptId,
          checkout: plannedUnit.spec.checkout,
          brief: new TextDecoder().decode(journal.artifact(plannedUnit.spec.briefDigest)),
        };
      }
      case "report": {
        const id = operand(args, 0, "unit id");
        const attemptId = flag(args, "--attempt");
        const report = readFileSync(flag(args, "--report"));
        const current = unit(journal.view(), id);
        const rawCommit = optionalFlag(args, "--commit");
        if (current.spec.checkout.kind === "shared-read-only" && rawCommit !== undefined) {
          throw new Error(`read-only unit ${id} must not report a commit`);
        }
        if (current.spec.checkout.kind === "isolated-worktree" && rawCommit === undefined) {
          throw new Error(`code unit ${id} requires --commit`);
        }
        const commit = rawCommit === undefined
          ? undefined
          : commitSha(journal.metadata.repo, rawCommit);
        if (current.spec.checkout.kind === "isolated-worktree" && commit !== undefined) {
          if (git(current.spec.checkout.path, ["status", "--porcelain"]).length !== 0) {
            throw new Error(`worktree for ${id} must be clean before report acceptance`);
          }
          if (git(current.spec.checkout.path, ["rev-parse", "HEAD"]) !== commit) {
            throw new Error(`commit does not match ${id} worktree HEAD`);
          }
        }
        return append(
          journal,
          {
            id: `report:${attemptId}`,
            kind: "report-accepted",
            unitId: id,
            attemptId,
            reportDigest: sha256(report),
            ...(commit === undefined ? {} : { commit }),
          },
          [report],
        );
      }
      case "verify": {
        const id = operand(args, 0, "unit id");
        const commit = commitSha(journal.metadata.repo, flag(args, "--commit"));
        const receipt = readFileSync(flag(args, "--receipt"));
        return append(
          journal,
          {
            id: `verify:${id}:${commit}`,
            kind: "verification-recorded",
            unitId: id,
            commit,
            receiptDigest: sha256(receipt),
            verdict: "passed",
          },
          [receipt],
        );
      }
      case "integrate": {
        const id = operand(args, 0, "unit id");
        const actor = flag(args, "--actor");
        if (actor !== journal.metadata.integrationWriter) {
          throw new Error(`integration is owned by ${journal.metadata.integrationWriter}`);
        }
        const current = unit(journal.view(), id);
        if (current.state.kind === "integrated") return status(journal);
        if (current.state.kind !== "verified") {
          throw new Error(`cannot integrate ${id} from ${current.state.kind}`);
        }
        const repo = journal.metadata.repo;
        if (git(repo, ["branch", "--show-current"]) !== journal.metadata.initialBranch) {
          throw new Error(`integration checkout must stay on ${journal.metadata.initialBranch}`);
        }
        if (git(repo, ["status", "--porcelain"]).length !== 0) {
          throw new Error("integration checkout must be clean");
        }
        const source = current.state.commit;
        const expectedHead = journal.view().integrationHead ?? journal.metadata.initialHead;
        const actualHead = git(repo, ["rev-parse", "HEAD"]);
        if (actualHead !== expectedHead && actualHead !== source) {
          throw new Error(`integration checkout moved from ${expectedHead} to ${actualHead}`);
        }
        git(repo, ["merge", "--ff-only", source]);
        const head = commitSha(repo, git(repo, ["rev-parse", "HEAD"]));
        return append(journal, {
          id: `integrate:${id}:${source}`,
          kind: "unit-integrated",
          unitId: id,
          source,
          head,
        });
      }
      case "recover": {
        const repo = journal.metadata.repo;
        const branch = git(repo, ["branch", "--show-current"]);
        const head = git(repo, ["rev-parse", "HEAD"]);
        const expectedHead = journal.view().integrationHead ?? journal.metadata.initialHead;
        if (branch !== journal.metadata.initialBranch) {
          throw new Error(`recovery blocked: expected branch ${journal.metadata.initialBranch}, found ${branch}`);
        }
        if (git(repo, ["status", "--porcelain"]).length !== 0) {
          throw new Error("recovery blocked: integration checkout is dirty");
        }
        if (head !== expectedHead) {
          const candidates = [...journal.view().units.values()].filter(
            (candidate) =>
              candidate.state.kind === "verified" && candidate.state.commit === head,
          );
          if (candidates.length !== 1 || !isAncestor(repo, expectedHead, head)) {
            throw new Error(`recovery blocked: expected HEAD ${expectedHead}, found ${head}`);
          }
          const recovered = candidates[0];
          if (recovered === undefined || recovered.state.kind !== "verified") {
            throw new Error("recovery could not identify the integrated revision");
          }
          journal.append(
            {
              id: `integrate:${recovered.spec.id}:${recovered.state.commit}`,
              kind: "unit-integrated",
              unitId: recovered.spec.id,
              source: recovered.state.commit,
              head,
            },
            [],
          );
        }
        return { interrupted: journal.recover(flag(args, "--session")) };
      }
      case "status":
        return status(journal);
      default:
        throw new Error(`unknown command ${args.command}`);
    }
  });
}

try {
  const result = run(parseArguments(Bun.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
