import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeJournal, openJournal, sha256 } from "./journal.ts";

const directories: string[] = [];

async function temporaryStore(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-orch-journal-"));
  directories.push(directory);
  return join(directory, "program.sqlite");
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Codex Orchestrate journal", () => {
  it("persists an event and its content-addressed artifact atomically", async () => {
    const store = await temporaryStore();
    const journal = initializeJournal({
      store,
      repo: "/tmp/repo",
      program: "program-a",
      integrationWriter: "coordinator",
      initialBranch: "main",
      initialHead: "0000000000000000000000000000000000000000",
    });
    const report = new TextEncoder().encode("report body\n");
    const digest = sha256(report);
    const brief = new TextEncoder().encode("brief body\n");

    journal.append(
      {
        id: "plan-a",
        kind: "unit-planned",
        unit: { id: "unit-a", checkout: { kind: "shared-read-only" }, briefDigest: sha256(brief) },
      },
      [brief],
    );
    journal.append(
      {
        id: "dispatch-a",
        kind: "unit-dispatched",
        unitId: "unit-a",
        attemptId: "attempt-a",
      },
      [],
    );
    journal.append(
      {
        id: "report-a",
        kind: "report-accepted",
        unitId: "unit-a",
        attemptId: "attempt-a",
        reportDigest: digest,
      },
      [report],
    );
    journal.close();

    const reopened = openJournal(store);
    expect(reopened.view().units.get("unit-a")?.state.kind).toBe("reported");
    expect(new TextDecoder().decode(reopened.artifact(digest))).toBe("report body\n");
    reopened.close();
  });

  it("accepts the same event twice and rejects a changed duplicate", async () => {
    const store = await temporaryStore();
    const journal = initializeJournal({
      store,
      repo: "/tmp/repo",
      program: "program-a",
      integrationWriter: "coordinator",
      initialBranch: "main",
      initialHead: "0000000000000000000000000000000000000000",
    });
    const event = {
      id: "plan-a",
      kind: "unit-planned" as const,
      unit: { id: "unit-a", checkout: { kind: "shared-read-only" as const }, briefDigest: sha256(new TextEncoder().encode("brief-a")) },
    };

    const brief = new TextEncoder().encode("brief-a");
    journal.append(event, [brief]);
    journal.append(event, [brief]);
    expect(() =>
      journal.append(
        {
          ...event,
          unit: { id: "unit-b", checkout: { kind: "shared-read-only" }, briefDigest: sha256(brief) },
        },
        [brief],
      )
    ).toThrow("event plan-a already exists with different data");
    journal.close();
  });

  it("interrupts outstanding attempts during recovery", async () => {
    const store = await temporaryStore();
    const journal = initializeJournal({
      store,
      repo: "/tmp/repo",
      program: "program-a",
      integrationWriter: "coordinator",
      initialBranch: "main",
      initialHead: "0000000000000000000000000000000000000000",
    });
    journal.append(
      {
        id: "plan-a",
        kind: "unit-planned",
        unit: { id: "unit-a", checkout: { kind: "shared-read-only" }, briefDigest: sha256(new TextEncoder().encode("brief-a")) },
      },
      [new TextEncoder().encode("brief-a")],
    );
    journal.append(
      {
        id: "dispatch-a",
        kind: "unit-dispatched",
        unitId: "unit-a",
        attemptId: "attempt-a",
      },
      [],
    );

    expect(journal.recover("session-b")).toEqual(["unit-a"]);
    expect(journal.view().units.get("unit-a")?.state).toEqual({ kind: "planned" });
    journal.close();
  });
});
